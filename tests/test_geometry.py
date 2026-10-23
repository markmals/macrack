from dataclasses import replace
from pathlib import Path

import pytest

from macrack.assembly import build_assembly
from macrack.carriers import check_device
from macrack.model import Artifact
from macrack.parameters import Design, Envelope, Parameters, load_parameters
from macrack.rack_interface import block, interface_check, template
from macrack.validation import validate_artifacts

SOURCE = Path(__file__).resolve().parents[1] / "assets" / "rack-pro"


@pytest.fixture(scope="module")
def assembly():
    return build_assembly(SOURCE, Parameters())


def test_reference_assembly_preserves_source_and_air_gap(assembly):
    artifacts, _, metadata = assembly
    assert validate_artifacts(artifacts)["ok"]
    by_name = {part.name: part for part in artifacts}
    for name, units in (("hdd_carrier", 2), ("sata_ssd_carrier", 1), ("dual_nvme_carrier", 1)):
        shape = by_name[name].shape
        interface_check(shape, SOURCE, units, 3)
        assert shape.bounding_box().size.X == pytest.approx(166.8)
        assert shape.is_valid
        assert len(shape.solids()) == 1
        floor_probe = block(4, 4, 3, y=40)
        assert (shape & floor_probe).volume == pytest.approx(floor_probe.volume)
    cooling = by_name["Mac_1U_airflow_reservation"].placed().bounding_box()
    nvme = by_name["dual_nvme_carrier"].placed().bounding_box()
    assert cooling.min.Z == pytest.approx(nvme.max.Z)
    assert cooling.size.Z == pytest.approx(25)
    assert metadata["allocation"]["total_U"] == 8
    assert by_name["hdd_carrier"].placed().bounding_box().min.Z == pytest.approx(0)


@pytest.mark.parametrize("added_material", [False, True])
def test_interface_check_rejects_damaged_slide(assembly, added_material):
    artifacts, _, _ = assembly
    shape = next(part.shape for part in artifacts if part.name == "sata_ssd_carrier")
    probe = block(4, 10, 4, x=76, y=30, z=2)
    damaged = shape + probe if added_material else shape - probe
    with pytest.raises(ValueError, match="Rack interface changed"):
        interface_check(damaged, SOURCE, 1, 3)


def test_source_pockets_are_blind_and_absent_on_1u():
    pocket_probe = block(1, 1, 1, x=75, y=12, z=3.5)
    backing_probe = block(1, 1, 1, x=72, y=12, z=3.5)
    assert (template(SOURCE, 1) & pocket_probe).volume == pytest.approx(1)
    pocket_material = template(SOURCE, 2) & pocket_probe
    assert pocket_material is None or pocket_material.volume < 1e-6
    assert (template(SOURCE, 2) & backing_probe).volume == pytest.approx(1)


def test_oversized_devices_require_more_units_and_space():
    with pytest.raises(ValueError, match="at least 3U"):
        check_device(replace(Parameters().hdd, height=45), Design(), 2)
    with pytest.raises(ValueError, match="carrier has"):
        check_device(
            Envelope(71.1, 132, 22.8, "OWC reference", "provisional"), Design(), 2, count=2
        )


def test_taller_hdd_moves_every_bay_without_losing_cooling():
    parameters = replace(
        Parameters(),
        design=replace(Design(), hdd_units=3),
        hdd=replace(Parameters().hdd, height=45),
    )
    artifacts, _, metadata = build_assembly(SOURCE, parameters)
    assert validate_artifacts(artifacts)["ok"]
    by_name = {part.name: part for part in artifacts}
    assert by_name["sata_ssd_carrier"].position[2] == pytest.approx(83)
    assert by_name["Mac_1U_airflow_reservation"].position[2] == pytest.approx(133)
    assert metadata["allocation"]["total_U"] == 9


def test_explicit_nvme_envelopes_are_checked_as_devices():
    # Synthetic dimensions exercise the configurable path; they are not hardware defaults.
    parameters = replace(Parameters(), nvme=Envelope(40, 110, 12, "test fixture", "provisional"))
    artifacts, _, _ = build_assembly(SOURCE, parameters)
    assert validate_artifacts(artifacts)["ok"]
    devices = {part.name: part for part in artifacts if part.name.startswith("nvme_enclosure_")}
    assert devices["nvme_enclosure_1"].position[0] == pytest.approx(-20.5)
    assert devices["nvme_enclosure_2"].placed().bounding_box().size.Y == pytest.approx(110)


def test_collision_validation_rejects_overlap_but_allows_contact():
    first = Artifact("first", block(10, 10, 10))
    touching = Artifact("touching", block(10, 10, 10), position=(10, 0, 0))
    assert validate_artifacts([first, touching])["ok"]
    overlapping = replace(touching, position=(9, 0, 0))
    report = validate_artifacts([first, overlapping])
    assert not report["ok"]
    assert report["interference"]["pairs"][0]["common_volume_mm3"] == pytest.approx(100)


@pytest.mark.parametrize(
    "settings",
    [
        "[design]\nfloor = nan\n",
        "[design]\nhdd_units = 2.0\n",
        "[nvme]\nwidth = 40\n",
        "[design]\nside_wall = 1\n",
        "[unknown]\nwidth = 4\n",
        "[sata]\nsource = 12\n",
    ],
)
def test_invalid_configuration_is_rejected(tmp_path, settings):
    path = tmp_path / "invalid.toml"
    path.write_text(settings)
    with pytest.raises(ValueError):
        load_parameters(path)


def test_vent_parameters_must_leave_room_for_floor_openings():
    parameters = replace(Parameters(), design=replace(Design(), vent_width=90, vent_pitch=94))
    with pytest.raises(ValueError, match="vent"):
        build_assembly(SOURCE, parameters)


def test_strap_positions_must_remain_separate():
    parameters = replace(Parameters(), sata=replace(Parameters().sata, depth=20))
    with pytest.raises(ValueError, match="strap"):
        build_assembly(SOURCE, parameters)
