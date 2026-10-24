import zipfile
from pathlib import Path

import numpy as np
import pytest
import trimesh

from macrack.rack_frame import BASE_NAME, build_frame, measure_rail
from macrack.source_profile import SourceProfile

SOURCE = Path(__file__).resolve().parents[1] / "assets" / "rack-pro" / "rack-pro.3mf"

CORE_NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
PRODUCTION_NS = "http://schemas.microsoft.com/3dmanufacturing/production/2015/06"


def _mesh_xml(mesh: trimesh.Trimesh) -> str:
    vertices = "".join(f'<vertex x="{x}" y="{y}" z="{z}"/>' for x, y, z in mesh.vertices)
    triangles = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in mesh.faces)
    return f"<mesh><vertices>{vertices}</vertices><triangles>{triangles}</triangles></mesh>"


def write_3mf(
    path: Path, *, unit: str = "millimeter", subtype: str = "normal_part", inline: bool = False
) -> Path:
    """A one-object 3MF shaped like the vendor source: 2 mm cube, plated 100 mm off origin."""
    cube = trimesh.creation.box(extents=(2.0, 2.0, 2.0))
    body = (
        _mesh_xml(cube)
        if inline
        else (
            '<components><component p:path="/3D/Objects/object_1.model" objectid="1" '
            'transform="1 0 0 0 1 0 0 0 1 0 0 0"/></components>'
        )
    )
    model = (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<model xmlns="{CORE_NS}" xmlns:p="{PRODUCTION_NS}" unit="{unit}">'
        f'<metadata name="Title">synthetic</metadata>'
        f'<resources><object id="2" type="model">{body}</object></resources>'
        f'<build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 100 100 0"/></build>'
        f"</model>"
    )
    part = (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<model xmlns="{CORE_NS}" unit="{unit}">'
        f'<resources><object id="1" type="model">{_mesh_xml(cube)}</object></resources>'
        f"</model>"
    )
    settings = (
        '<?xml version="1.0" encoding="UTF-8"?><config>'
        '<object id="2"><metadata key="name" value="Widget"/>'
        f'<metadata face_count="{len(cube.faces)}"/>'
        f'<part id="1" subtype="{subtype}"><metadata key="name" value="Widget"/></part>'
        "</object>"
        '<plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value="Plate"/>'
        '<model_instance><metadata key="object_id" value="2"/></model_instance></plate>'
        "</config>"
    )
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("3D/3dmodel.model", model)
        archive.writestr("3D/Objects/object_1.model", part)
        archive.writestr("Metadata/model_settings.config", settings)
    return path


@pytest.fixture(scope="module")
def profile():
    return SourceProfile(SOURCE)


@pytest.fixture(scope="module")
def layouts(profile):
    return {size: build_frame(profile, size) for size in ("full", "short")}


def test_reads_vendor_source_without_build_placement(profile):
    assert profile.unit == "millimeter"
    assert profile.metadata["ProfileTitle"] == "Rack Essentials, Mac mini M4, and Equipment Modules"
    assert profile.objects_named("Rail") == (2, 9, 12, 15, 18, 21)
    assert profile.objects_named("Rail - Short.stl") == (36, 37, 38, 39, 40, 41)

    base = profile.mesh(profile.require_object(BASE_NAME, 1))
    # The plate item for this object translates it hundreds of mm; local coordinates stay centred.
    assert base.bounds[0] == pytest.approx([-87.5, -5.0, -86.3])
    assert base.bounds[1] == pytest.approx([87.5, 5.0, 86.3])
    assert len(base.faces) == 3760 and base.is_watertight

    inventory = profile.inventory()
    assert inventory["source"]["sha256"] == profile.sha256
    assert [plate["name"] for plate in inventory["plates"]][:3] == [
        "Rack Rails",
        "Rack Top with Apple Logo",
        "Rack Base",
    ]
    assert inventory["non_printable_volumes"] == []
    for entry in inventory["objects"]:
        assert entry["faces"] == entry["declared_faces"]
        assert entry["watertight"]


def test_mesh_hands_out_independent_copies(profile):
    first = profile.mesh(2)
    first.apply_translation([5.0, 0.0, 0.0])
    assert profile.mesh(2).bounds[0][0] == pytest.approx(-12.5)


def test_rejects_non_millimetre_units(tmp_path):
    source = write_3mf(tmp_path / "inch.3mf", unit="inch")
    with pytest.raises(ValueError, match="unit is 'inch'"):
        SourceProfile(source)


def test_rejects_inline_mesh_and_unknown_object(tmp_path):
    with pytest.raises(ValueError, match="inline mesh"):
        SourceProfile(write_3mf(tmp_path / "inline.3mf", inline=True))
    profile = SourceProfile(write_3mf(tmp_path / "plain.3mf"))
    with pytest.raises(ValueError, match="no object 99"):
        profile.mesh(99)


def test_non_printable_volume_is_inventoried_not_printed(tmp_path):
    profile = SourceProfile(write_3mf(tmp_path / "negative.3mf", subtype="negative_part"))
    with pytest.raises(ValueError, match="no printable volume"):
        profile.mesh(2)
    assert profile.inventory()["non_printable_volumes"] == [
        {"object_id": 2, "object_name": "Widget", "volume": "Widget", "subtype": "negative_part"}
    ]


def test_rail_slot_table_is_measured_not_assumed(profile):
    full = measure_rail(profile.mesh(2), "Rail")
    short = measure_rail(profile.mesh(36), "Rail - Short.stl")
    assert full.slot_pitch == pytest.approx(25.4, abs=1e-4)
    assert short.slot_pitch == pytest.approx(25.4, abs=1e-4)
    assert len(full.slot_floors) == 10
    assert len(short.slot_floors) == 7
    assert full.slot_height == pytest.approx(8.2, abs=1e-4)
    assert full.slot_depth == pytest.approx(4.0, abs=1e-4)


def test_frame_placements_are_rigid_rotations(layouts):
    for layout in layouts.values():
        names = [placement.name for placement in layout.placements]
        assert names[0] == "rack_base" and names[-1] == "rack_top"
        assert sum(name.startswith("rail_") for name in names) == 6
        for placement in layout.placements:
            rotation = placement.transform[:3, :3]
            assert np.linalg.det(rotation) == pytest.approx(1.0)
            assert rotation @ rotation.T == pytest.approx(np.eye(3))


def test_frame_lands_source_geometry_on_measured_coordinates(layouts, profile):
    layout = layouts["full"]
    placed = {
        placement.name: placement.apply(profile.mesh(placement.object_id))
        for placement in layout.placements
    }
    assert placed["rack_base"].bounds[0] == pytest.approx([-86.3, -87.5, 0.0])
    assert placed["rack_base"].bounds[1] == pytest.approx([86.3, 87.5, 10.0])
    # Right-hand rails stand in their sockets with the slotted face turned inward.
    assert placed["rail_right_front"].bounds[0] == pytest.approx([73.2, -71.9, 4.0])
    assert placed["rail_right_front"].bounds[1] == pytest.approx([83.2, -46.9, 258.0])
    assert placed["rail_left_rear"].bounds[0] == pytest.approx([-83.2, 46.9, 4.0])
    assert placed["rack_top"].bounds[0] == pytest.approx([-86.3, -75.0, 252.0])
    assert placed["rack_top"].bounds[1] == pytest.approx([86.3, 75.0, 262.0])


def test_frame_slot_table_and_capacity(layouts):
    full, short = layouts["full"], layouts["short"]
    assert full.module_y == pytest.approx(-72.0) == short.module_y
    assert full.slot_origins == pytest.approx(
        (12.6, 38.0, 63.4, 88.8, 114.2, 139.6, 165.0, 190.4, 215.8, 241.2)
    )
    assert short.slot_origins == pytest.approx(full.slot_origins[:7])
    assert full.measurements["top"]["usable_ceiling_z"] == pytest.approx(252.0)
    assert short.measurements["top"]["usable_ceiling_z"] == pytest.approx(175.8)
    # Ten slot positions, but a 1U module in the top one would run into the lid skirt.
    assert full.measurements["bays"]["1U"]["start_slots"] == 9
    assert full.measurements["bays"]["3U"]["start_slots"] == 7
    assert short.measurements["bays"]["1U"]["start_slots"] == 6
    assert full.measurements["base"]["base_cross_ribs_y"] == [[-72.0, -46.8], [46.8, 72.0]]
    assert full.measurements["base"]["base_rib_top_z"] == pytest.approx(4.0)
    assert full.measurements["module_interface_clearance"] == {
        "body_half_width_mm": 0.2,
        "slide_half_width_mm": 0.2,
        "unit_height_mm": 0.4,
        "ear_face_y": -75.0,
    }


def test_build_frame_rejects_changed_source(profile, monkeypatch):
    base_id = profile.require_object(BASE_NAME, 1)
    original = profile.mesh

    def resized(object_id):
        mesh = original(object_id)
        if object_id == base_id:
            mesh.apply_scale(1.01)
        return mesh

    monkeypatch.setattr(profile, "mesh", resized)
    with pytest.raises(ValueError, match="source bounds changed"):
        build_frame(profile)


def test_build_frame_rejects_unknown_rail_size(profile):
    with pytest.raises(ValueError, match="rail_size must be"):
        build_frame(profile, "medium")
