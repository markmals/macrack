from pathlib import Path

from build123d import Shape

from macrack.carriers import check_device, support_pads, ventilated_carrier
from macrack.parameters import Parameters
from macrack.rack_interface import BODY_HALF_WIDTH, DEPTH, block


def device_front(parameters: Parameters) -> float:
    design = parameters.design
    return design.device_front + design.strap_width + design.clearance + 3


def enclosure_centers(parameters: Parameters) -> tuple[float, float]:
    envelope = parameters.nvme
    if envelope is None:
        offset = (BODY_HALF_WIDTH - parameters.design.side_wall) / 2
    else:
        offset = (envelope.width + parameters.design.clearance) / 2
    return (-offset, offset)


def build_nvme_insert(source: Path, parameters: Parameters) -> Shape:
    from dataclasses import replace

    design = parameters.design
    envelope = parameters.nvme
    depth = DEPTH
    front = device_front(parameters)
    if envelope is not None:
        check_device(envelope, design, design.nvme_units, count=2)
        depth = max(DEPTH, front + envelope.depth + design.clearance + design.strap_width + 3)
    body = ventilated_carrier(source, design, design.nvme_units, depth)
    for x in enclosure_centers(parameters):
        if envelope is not None:
            body = support_pads(body, envelope, replace(design, device_front=front), x)
        for y in (design.device_front, depth - design.strap_width - 3):
            body += block(20, design.strap_width + 6, design.floor, x=x, y=y - 3)
            body -= block(design.strap_length, design.strap_width, design.floor + 2, x=x, y=y, z=-1)
    return body
