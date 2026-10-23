from pathlib import Path

from build123d import Shape

from macrack.carriers import (
    carrier_depth,
    check_device,
    strap_slots,
    support_pads,
    ventilated_carrier,
)
from macrack.parameters import Parameters


def build_sata_insert(source: Path, parameters: Parameters) -> Shape:
    design = parameters.design
    check_device(parameters.sata, design, design.sata_units)
    body = ventilated_carrier(
        source, design, design.sata_units, carrier_depth(parameters.sata, design)
    )
    body = support_pads(body, parameters.sata, design)
    return strap_slots(body, parameters.sata, design)
