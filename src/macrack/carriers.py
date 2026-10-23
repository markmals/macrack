from math import ceil
from pathlib import Path

from build123d import Shape

from macrack.parameters import Design, Envelope
from macrack.rack_interface import BODY_HALF_WIDTH, DEPTH, U, block, template


def required_units(envelope: Envelope, design: Design) -> int:
    return ceil((design.floor + design.stand_off + envelope.height + design.top_clearance) / U)


def check_device(envelope: Envelope, design: Design, units: int, count: int = 1) -> None:
    inner_width = 2 * (BODY_HALF_WIDTH - design.side_wall)
    needed_width = count * envelope.width + (count + 1) * design.clearance
    if needed_width > inner_width:
        raise ValueError(f"Device needs {needed_width:.2f} mm; carrier has {inner_width:.2f} mm")
    needed_units = required_units(envelope, design)
    if needed_units > units:
        raise ValueError(
            f"Device requires at least {needed_units}U with configured vertical allowances"
        )
    if min(envelope.width, envelope.depth) < 20:
        raise ValueError("This carrier requires device width/depth >=20 mm for its support pads")


def carrier_depth(envelope: Envelope | None, design: Design) -> float:
    if envelope is None:
        return DEPTH
    return max(DEPTH, design.device_front + envelope.depth + design.clearance)


def ventilated_carrier(source: Path, design: Design, units: int, depth: float) -> Shape:
    if 12 + design.vent_width >= depth - 8:
        raise ValueError("Carrier depth leaves no room for the configured floor vents")
    inner_width = 2 * (BODY_HALF_WIDTH - design.side_wall)
    body = template(source, units) - block(
        inner_width, DEPTH + 5, units * U + 1, y=-4, z=design.floor
    )
    if depth > DEPTH:
        body += block(inner_width, depth - DEPTH + 1, design.floor, y=DEPTH - 1)
    y = 12.0
    while y + design.vent_width < depth - 8:
        for x in (-inner_width / 4, inner_width / 4):
            body -= block(inner_width / 2 - 18, design.vent_width, design.floor + 2, x=x, y=y, z=-1)
        y += design.vent_pitch
    return body


def support_pads(body: Shape, envelope: Envelope, design: Design, center_x=0.0) -> Shape:
    pad_width = 6.0
    for x in (
        center_x - envelope.width / 2 + pad_width / 2,
        center_x + envelope.width / 2 - pad_width / 2,
    ):
        body += block(
            pad_width, envelope.depth, design.stand_off, x=x, y=design.device_front, z=design.floor
        )
    return body


def strap_slots(body: Shape, envelope: Envelope, design: Design, center_x=0.0) -> Shape:
    if envelope.depth / 2 < design.strap_length + 3:
        raise ValueError("Device depth must leave a 3 mm web between the two strap positions")
    inner = BODY_HALF_WIDTH - design.side_wall
    slot_offset = envelope.width / 2 + design.clearance + design.strap_width / 2
    if abs(center_x) + slot_offset + design.strap_width / 2 + 3 > inner:
        raise ValueError("Device leaves insufficient side web for configured strap slots")
    for y in (
        design.device_front + envelope.depth * 0.25,
        design.device_front + envelope.depth * 0.75,
    ):
        body += block(
            inner * 2, design.strap_length + 6, design.floor, y=y - design.strap_length / 2 - 3
        )
    for x in (center_x - slot_offset, center_x + slot_offset):
        for y in (
            design.device_front + envelope.depth * 0.25,
            design.device_front + envelope.depth * 0.75,
        ):
            body -= block(
                design.strap_width,
                design.strap_length,
                design.floor + 2,
                x=x,
                y=y - design.strap_length / 2,
                z=-1,
            )
    return body
