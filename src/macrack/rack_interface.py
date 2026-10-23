from functools import lru_cache
from hashlib import sha256
from pathlib import Path

from build123d import Align, Axis, Box, GeomType, Shape, import_step

U = 25.0
BODY_HALF_WIDTH = 73.0
FRONT_HALF_WIDTH = 83.4
SLIDE_HALF_WIDTH = 77.0
DEPTH = 100.0
FRONT_DEPTH = 3.0


def block(width: float, depth: float, height: float, x=0.0, y=0.0, z=0.0) -> Shape:
    return Box(width, depth, height, align=(Align.CENTER, Align.MIN, Align.MIN)).translate(
        (x, y, z)
    )


@lru_cache(maxsize=3)
def template(source: Path, units: int) -> Shape:
    if units not in (1, 2, 3):
        raise ValueError("Only the supplied 1U/2U/3U STEP templates are supported")
    path = source / f"{units}U Template.step"
    shape = import_step(path).rotate(Axis.X, 90)
    bounds = shape.bounding_box()
    expected_min = (-FRONT_HALF_WIDTH, -FRONT_DEPTH, 0)
    expected_max = (FRONT_HALF_WIDTH, DEPTH, units * U)
    for actual, expected in zip(
        (*bounds.min, *bounds.max), (*expected_min, *expected_max), strict=True
    ):
        if abs(actual - expected) > 1e-6:
            raise ValueError(f"{path}: changed source bounds; remeasure the interface before use")
    if not shape.is_valid or len(shape.solids()) != 1:
        raise ValueError(f"{path}: template must be a valid single solid")
    return shape


def protected_interface(source: Path, units: int, side_wall: float) -> Shape:
    original = template(source, units)
    inner = BODY_HALF_WIDTH - side_wall
    middle = block(inner * 2, DEPTH + FRONT_DEPTH + 2, units * U + 2, y=-4, z=-1)
    return original - middle


def interface_check(shape: Shape, source: Path, units: int, side_wall: float) -> dict:
    expected = protected_interface(source, units, side_wall)
    missing = expected - shape
    missing_volume = missing.volume if missing is not None else 0.0
    inner = BODY_HALF_WIDTH - side_wall
    side_zone = block(200, 106, units * U + 2, y=-4, z=-1) - block(
        inner * 2, 108, units * U + 4, y=-5, z=-2
    )
    added = (shape & side_zone) - expected
    added_volume = added.volume if added is not None else 0.0
    if missing_volume > 1e-5 or added_volume > 1e-5:
        raise ValueError(
            f"Rack interface changed: missing {missing_volume}, added {added_volume} mm^3"
        )
    return {
        "missing_source_interface_mm3": missing_volume,
        "added_interface_interference_mm3": added_volume,
        "rail_clearance": "unknown: mating rail source and physical fit test absent",
    }


def inspect_sources(source: Path) -> dict:
    measurements = {}
    for units in (1, 2, 3):
        shape = template(source, units)
        pocket_faces = [
            face for face in shape.faces() if face.geom_type == GeomType.CYLINDER and face.area > 40
        ]
        measurements[f"{units}U"] = {
            "file": f"{units}U Template.step",
            "sha256": sha256((source / f"{units}U Template.step").read_bytes()).hexdigest(),
            "size_mm": list(shape.bounding_box().size),
            "volume_mm3": shape.volume,
            "lateral_pocket_faces": [
                {"min_mm": list(face.bounding_box().min), "max_mm": list(face.bounding_box().max)}
                for face in pocket_faces
            ],
        }
    return {
        "units": "mm",
        "transform": "source.rotate(Axis.X, 90): X=width, +Y=rear, +Z=up",
        "templates": measurements,
        "missing_sources": ["rails/frame", "Mac cradle", "OWC dual enclosure module"],
    }


def interface_coupon(source: Path, units: int) -> Shape:
    # A full-depth slice preserves the original entrance and blind pocket, if present.
    return template(source, units) & block(16, 103, 10, x=75.4, y=-3)
