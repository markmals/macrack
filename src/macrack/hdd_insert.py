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
from macrack.rack_interface import block


def build_hdd_insert(source: Path, parameters: Parameters) -> Shape:
    design = parameters.design
    envelope = parameters.hdd
    check_device(envelope, design, design.hdd_units)
    depth = carrier_depth(envelope, design)
    body = ventilated_carrier(source, design, design.hdd_units, depth)
    body = support_pads(body, envelope, design)
    body = strap_slots(body, envelope, design)
    # Ground skids support the rear extension independently of the unverified rack rails.
    for x in (-envelope.width / 2 + 5, envelope.width / 2 - 5):
        body += block(10, depth + 3, design.hdd_feet, x=x, y=-3, z=-design.hdd_feet)
    return body
