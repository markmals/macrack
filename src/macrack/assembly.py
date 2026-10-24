from pathlib import Path

from macrack.device_envelopes import device_keepout
from macrack.hdd_insert import build_hdd_insert
from macrack.model import Artifact
from macrack.nvme_insert import build_nvme_insert, device_front, enclosure_centers
from macrack.parameters import Parameters
from macrack.rack_interface import U, block, interface_check, interface_coupon
from macrack.sata_ssd_insert import build_sata_insert

LIMITATIONS = [
    "Candidate geometry only; no physical fit, thermal, vibration or load validation.",
    "Carrier-only study at nominal 25 mm module heights; use the rack command for measured 25.4 mm slots and the original frame.",
    "Selected NVMe enclosures, SATA bridges, hubs, cables and power supplies are unresolved and absent from collision checks.",
    "Samsung, future HDD and future Mac envelopes are reference assumptions, not verified owner hardware.",
    "HDD strap retention and printed ground skids require engineering and physical validation; no screw/grommet pattern is claimed.",
    "This study excludes the frame and original modules; its ground-skid datum is not the full-rack base-support datum.",
]


def build_assembly(
    source: Path, parameters: Parameters
) -> tuple[list[Artifact], list[Artifact], dict]:
    parameters.validate()
    design = parameters.design
    hdd_z = design.hdd_feet
    sata_z = hdd_z + design.hdd_units * U
    nvme_z = sata_z + design.sata_units * U
    cooling_z = nvme_z + design.nvme_units * U
    mac_z = cooling_z + U
    if parameters.mac.width > 146 or parameters.mac.height > 3 * U:
        raise ValueError("Mac reference envelope exceeds the reserved original 3U bay")
    modules = [
        ("hdd_carrier", build_hdd_insert(source, parameters), design.hdd_units, hdd_z),
        ("sata_ssd_carrier", build_sata_insert(source, parameters), design.sata_units, sata_z),
        ("dual_nvme_carrier", build_nvme_insert(source, parameters), design.nvme_units, nvme_z),
    ]
    checks = {}
    artifacts = []
    for name, shape, units, z in modules:
        checks[name] = interface_check(shape, source, units, design.side_wall)
        note = "Provisional carrier; imported source slide geometry retained. Device fasteners and operational fit unvalidated."
        if name == "dual_nvme_carrier" and parameters.nvme is None:
            note += " Empty dual carrier: no enclosure dimensions selected; no enclosure fit claim."
        artifacts.append(Artifact(name, shape, position=(0, 0, z), note=note))
    device_z = design.floor + design.stand_off
    artifacts.extend(
        [
            device_keepout(
                "reference_hdd_NOT_SELECTED",
                parameters.hdd,
                (0, design.device_front, hdd_z + device_z),
            ),
            device_keepout(
                "reference_samsung_NOT_CONFIRMED",
                parameters.sata,
                (0, design.device_front, sata_z + device_z),
            ),
            device_keepout(
                "reference_M4_NOT_SELECTED",
                parameters.mac,
                (0, design.device_front, mac_z + (3 * U - parameters.mac.height) / 2),
            ),
            Artifact(
                "Mac_1U_airflow_reservation",
                block(146, max(100, design.device_front + parameters.mac.depth), U),
                "reservation",
                (0, 0, cooling_z),
                "Unoccupied 1U below reserved Mac bay; airflow and cradle position remain unvalidated.",
            ),
        ]
    )
    if parameters.nvme is not None:
        for index, x in enumerate(enclosure_centers(parameters), start=1):
            artifacts.append(
                device_keepout(
                    f"nvme_enclosure_{index}",
                    parameters.nvme,
                    (x, device_front(parameters), nvme_z + device_z),
                )
            )
    coupons = [
        Artifact(
            f"rail_coupon_{units}U",
            interface_coupon(source, units),
            note="Exact right-hand source interface slice; test with real rail. No mating rail is fabricated.",
        )
        for units in (1, 2)
    ]
    allocated_units = design.hdd_units + design.sata_units + design.nvme_units + 1 + 3
    return (
        artifacts,
        coupons,
        {
            "parameters": parameters.metadata(),
            "interface_checks": checks,
            "allocation": {
                "storage_U": allocated_units - 4,
                "Mac_airflow_U": 1,
                "Mac_bay_U": 3,
                "total_U": allocated_units,
                "allocated_height_with_ground_skids_mm": allocated_units * U + design.hdd_feet,
                "nominal_module_height_mm": U,
                "complete_external_enclosure_dimensions": "not evaluated by the carrier-only study; see the rack command",
            },
            "limitations": LIMITATIONS,
        },
    )
