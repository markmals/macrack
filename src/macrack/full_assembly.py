from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory

from build123d import Shape

from macrack.hdd_insert import build_hdd_insert
from macrack.nvme_insert import build_nvme_insert, device_front, enclosure_centers
from macrack.parameters import Envelope, Parameters
from macrack.rack_frame import build_frame
from macrack.rack_interface import U, block, inspect_sources, interface_check
from macrack.rack_output import MANIFEST_NAME, invalidate_rack, owned_path, write_geometry
from macrack.rack_scene import SceneComponent, cad_mesh, inspect_scene, translation
from macrack.sata_ssd_insert import build_sata_insert
from macrack.source_modules import (
    mac_cradle_measurements,
    mac_placements,
    mac_reference_origin,
    owc_placement,
    owc_reference_origins,
    owc_shelf_measurements,
)
from macrack.source_profile import SourcePlacement, SourceProfile


def source_component(
    profile: SourceProfile, placement: SourcePlacement, role: str
) -> SceneComponent:
    return SceneComponent(
        placement.name,
        role,
        profile.mesh(placement.object_id),
        placement.transform,
        f"source/object_{placement.object_id}.stl",
        placement.note,
    )


def cad_component(
    name: str, shape: Shape, role: str, position: tuple, note: str, cad_shapes: dict
) -> SceneComponent:
    if not shape.is_valid or len(shape.solids()) != 1 or shape.volume <= 0:
        raise ValueError(f"{name}: expected a valid, positive single CAD solid")
    directory = "candidates" if role == "candidate" else "references"
    path = f"{directory}/{name}.step"
    cad_shapes[path] = shape
    return SceneComponent(name, role, cad_mesh(shape), translation(*position), path, note)


def reference_component(
    name: str, envelope: Envelope, position: tuple, cad_shapes: dict
) -> SceneComponent:
    return cad_component(
        name,
        block(envelope.width, envelope.depth, envelope.height),
        "reference",
        position,
        f"Conservative body envelope only; not vendor CAD or a hardware selection. {envelope.source}",
        cad_shapes,
    )


def supported_hdd(source: Path, parameters: Parameters, frame, floor_z: float) -> Shape:
    skid_height = floor_z - frame.measurements["base"]["base_rib_top_z"]
    if skid_height <= 0:
        raise ValueError("HDD floor must sit above the base bearing surfaces")
    adjusted = replace(parameters, design=replace(parameters.design, hdd_feet=skid_height))
    return build_hdd_insert(source, adjusted)


def carrier_components(source, parameters, frame, z, nvme_mount, shapes):
    design = parameters.design
    candidates = [
        (
            "hdd_carrier",
            supported_hdd(source, parameters, frame, z["hdd"]),
            design.hdd_units,
            "hdd",
        ),
        ("sata_ssd_carrier", build_sata_insert(source, parameters), design.sata_units, "sata"),
    ]
    if nvme_mount == "generic":
        candidates.append(
            ("dual_nvme_carrier", build_nvme_insert(source, parameters), design.nvme_units, "nvme")
        )
    components = []
    interfaces = {}
    for name, shape, units, bay in candidates:
        interfaces[name] = interface_check(shape, source, units, design.side_wall)
        components.append(
            cad_component(
                name,
                shape,
                "candidate",
                (0, frame.module_y, z[bay]),
                "Parametric candidate with exact STEP-template side geometry; hardware retention unvalidated.",
                shapes,
            )
        )
    return components, interfaces


def device_components(profile, parameters, frame, z, nvme_mount, shapes):
    design = parameters.design
    components = []
    device_height = design.floor + design.stand_off
    for name, envelope, bay in (
        ("reference_HDD_NOT_SELECTED", parameters.hdd, "hdd"),
        ("reference_Samsung_NOT_CONFIRMED", parameters.sata, "sata"),
    ):
        components.append(
            reference_component(
                name,
                envelope,
                (0, frame.module_y + design.device_front, z[bay] + device_height),
                shapes,
            )
        )
    components.append(
        reference_component(
            "reference_Mac_NOT_SELECTED",
            parameters.mac,
            mac_reference_origin(profile, z["mac"], frame.module_y),
            shapes,
        )
    )
    if parameters.nvme is not None:
        if nvme_mount == "owc-reference":
            origins = owc_reference_origins(profile, z["nvme"], frame.module_y)
        else:
            origins = [
                (x, frame.module_y + device_front(parameters), z["nvme"] + device_height)
                for x in enclosure_centers(parameters)
            ]
        for index, position in enumerate(origins, start=1):
            components.append(
                reference_component(
                    f"reference_NVMe_enclosure_{index}_NOT_SELECTED",
                    parameters.nvme,
                    position,
                    shapes,
                )
            )
    components.append(
        cad_component(
            "Mac_airflow_reservation",
            block(146, max(146.4, parameters.mac.depth), z["mac"] - z["air"]),
            "reservation",
            (0, frame.module_y, z["air"]),
            "One measured rail pitch kept empty below the original Mac module; airflow untested.",
            shapes,
        )
    )
    return components


def assemble_rack(
    source: Path, profile: SourceProfile, parameters: Parameters, rail_size: str, nvme_mount: str
) -> tuple[list[SceneComponent], dict, dict]:
    parameters.validate()
    if nvme_mount not in {"generic", "owc-reference"}:
        raise ValueError(f"Unknown NVMe mount: {nvme_mount}")
    if nvme_mount == "owc-reference" and parameters.nvme is None:
        raise ValueError("OWC comparison requires an explicit [nvme] enclosure envelope")
    if parameters.mac.width > 146 or parameters.mac.depth > 146.4 or parameters.mac.height > 3 * U:
        raise ValueError("Mac reference envelope exceeds the original 3U cradle's outer allocation")
    frame = build_frame(profile, rail_size)
    design = parameters.design
    indices = {
        "hdd": 0,
        "sata": design.hdd_units,
        "nvme": design.hdd_units + design.sata_units,
        "air": design.hdd_units + design.sata_units + design.nvme_units,
    }
    indices["mac"] = indices["air"] + 1
    required_units = indices["mac"] + 3
    if required_units > frame.measurements["usable_full_units"]:
        raise ValueError(
            f"{rail_size} rails provide {frame.measurements['usable_full_units']} full U; "
            f"this layout requires {required_units} U"
        )
    z = {name: frame.slot_origins[index] for name, index in indices.items()}
    components = [source_component(profile, part, "source_frame") for part in frame.placements]
    mac_parts = mac_placements(profile, z["mac"], frame.module_y)
    components.extend(source_component(profile, part, "source_module") for part in mac_parts)
    shapes = {}
    if nvme_mount == "owc-reference":
        components.append(
            source_component(
                profile, owc_placement(profile, z["nvme"], frame.module_y), "source_module"
            )
        )
    carriers, interfaces = carrier_components(source, parameters, frame, z, nvme_mount, shapes)
    components.extend(carriers)
    components.extend(device_components(profile, parameters, frame, z, nvme_mount, shapes))
    metadata = {
        "source_profile": profile.inventory(),
        "source_templates": inspect_sources(source),
        "parameters": parameters.metadata(),
        "frame": frame.measurements,
        "source_module_measurements": {
            "mac": mac_cradle_measurements(profile),
            "owc": owc_shelf_measurements(profile) if nvme_mount == "owc-reference" else None,
        },
        "nvme_mount": nvme_mount,
        "purchases_assumed": False,
        "allocation": {
            "required_units": required_units,
            "bay_floor_z_mm": z,
            "module_y_mm": frame.module_y,
        },
        "hdd_support": {
            "base_contact_z_mm": frame.measurements["base"]["base_rib_top_z"],
            "effective_skid_height_mm": z["hdd"] - frame.measurements["base"]["base_rib_top_z"],
            "bearing_ribs_y_mm": frame.measurements["base"]["base_cross_ribs_y"],
            "note": "Continuous skids rest nominally on base ribs and slide over them; load, wear and vibration untested.",
        },
        "interface_checks": interfaces,
        "cutaway_hide": [part.name for part in mac_parts]
        + [part.name for part in frame.placements if part.name == "rack_top"],
    }
    return components, shapes, metadata


def export_rack(
    source: Path,
    profile_path: Path,
    parameters: Parameters,
    output: Path,
    rail_size: str = "full",
    nvme_mount: str = "generic",
) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    invalidate_rack(output)
    profile = SourceProfile(profile_path)
    components, shapes, metadata = assemble_rack(source, profile, parameters, rail_size, nvme_mount)
    report = inspect_scene(components)
    if not report["physical_geometry_ok"]:
        raise ValueError(
            f"Full rack has physical-part intersections: {report['physical_interferences']}"
        )
    with TemporaryDirectory(prefix=".rack-", dir=output) as temporary:
        staging = Path(temporary)
        manifest = write_geometry(staging, components, shapes, report, metadata)
        for relative in manifest["files"]:
            target = owned_path(output, relative)
            if target.exists():
                raise ValueError(f"Unowned rack output exists: {relative}")
            if target.parent.exists() and not target.parent.is_dir():
                raise ValueError(f"Rack output directory is occupied by a file: {target.parent}")
        for relative in manifest["files"]:
            target = owned_path(output, relative)
            target.parent.mkdir(parents=True, exist_ok=True)
            (staging / relative).replace(target)
        (staging / MANIFEST_NAME).replace(output / MANIFEST_NAME)
    return manifest
