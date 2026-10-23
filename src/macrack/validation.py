"""Geometric checks over an artifact list.

Interference here is an exact OpenCascade Boolean common volume between solids.
It says nothing about fit: tolerances, print shrinkage, fasteners, assembly order
and every device absent from the artifact list are outside this model.
"""

from __future__ import annotations

import math
from collections import Counter
from itertools import combinations, product

from build123d import Shape

from macrack.model import Artifact

# Interference below this is treated as surface contact: coincident faces of two
# touching solids can report a sliver volume at OCC's ~1e-7 mm modelling tolerance.
COLLISION_VOLUME_TOL_MM3 = 1e-5

KINDS = ("printable", "keepout", "reservation")
PHYSICAL_KINDS = ("printable", "keepout")

NOT_VALIDATED = (
    "Rail/slide fit is unproven: the mating rail, frame and original cradle geometry are not modelled here.",
    "Wall thickness, minimum feature size, overhangs, orientation and bed fit are not checked.",
    "Structural load, drive mass, vibration, retention and rack stability are not modelled.",
    "Thermal and airflow behaviour is not modelled; a cooling reservation only reserves volume.",
    "Fastener engagement (heat-set inserts, M3 screws, drive screws) is not checked against real hardware.",
    "Clearance between solids is geometric only: no tolerance stack, press fit, cable bend radius or service access is evaluated.",
)

_ABSENT_HARDWARE_NOTE = (
    "Interference checks cover only the solids listed in this report. Devices, enclosures, "
    "bridges, hubs, cables, connectors, fasteners and power supplies that are not listed are "
    "absent from the model and are therefore neither cleared nor validated."
)


def _r(value: float) -> float:
    return round(float(value), 6)


Bounds = tuple[tuple[float, float, float], tuple[float, float, float]]


def _bounds(shape: Shape) -> Bounds:
    """Full-precision (min, max) corners; report values are rounded, these are not."""
    bbox = shape.bounding_box()
    return (bbox.min.X, bbox.min.Y, bbox.min.Z), (bbox.max.X, bbox.max.Y, bbox.max.Z)


def _bbox_report(bounds: Bounds) -> dict:
    low, high = bounds
    size = tuple(high[i] - low[i] for i in range(3))
    return {
        "min": [_r(v) for v in low],
        "max": [_r(v) for v in high],
        "size": [_r(v) for v in size],
        "volume_mm3": _r(size[0] * size[1] * size[2]),
    }


def inspect_shape(shape: Shape) -> dict:
    """Measured facts about one shape: CAD validity, solid count, volume, bounding box."""
    return {
        "is_valid": bool(shape.is_valid),
        "solid_count": len(shape.solids()),
        "volume_mm3": _r(shape.volume),
        "bbox": _bbox_report(_bounds(shape)),
    }


def _bbox_is_finite(bounds: Bounds) -> bool:
    low, high = bounds
    return all(math.isfinite(v) for v in (*low, *high)) and all(high[i] > low[i] for i in range(3))


def _overlap(a: Bounds, b: Bounds) -> bool:
    """True when the two bounding boxes share volume; touching faces are not overlap.

    Exact corner values only: a rounded comparison would discard a submicron overlap
    that still exceeds the collision tolerance over a rack-sized face.
    """
    return all(a[0][i] < b[1][i] and b[0][i] < a[1][i] for i in range(3))


def _common_volume(a: Shape, b: Shape) -> float:
    common = a.intersect(b)
    if common is None:
        return 0.0
    if isinstance(common, (list, tuple)):
        return sum(shape.volume for shape in common)
    return common.volume


def _envelope(bounds: list[Bounds]) -> dict | None:
    if not bounds:
        return None
    low = tuple(min(b[0][i] for b in bounds) for i in range(3))
    high = tuple(max(b[1][i] for b in bounds) for i in range(3))
    return _bbox_report((low, high))


def validate_artifacts(artifacts: list[Artifact]) -> dict:
    """Check every artifact and every interfering pair; return a JSON-serialisable report.

    Checks: declared kind, CAD validity, exactly one solid of positive volume for
    printables, a finite non-degenerate bounding box, and the Boolean common volume of
    each placed pair (printable/keepout against each other, and both against
    reservations; reservation pairs are skipped because they may share space).

    Never raises on a geometric failure: ``report["ok"]`` is False and ``report["issues"]``
    lists every failure. Callers are expected to stop on ``ok`` being False.
    """
    issues: list[str] = []
    entries: list[dict] = []
    placed: list[tuple[Artifact, Shape, Bounds]] = []

    for name, count in sorted(Counter(a.name for a in artifacts).items()):
        if count > 1:
            issues.append(f"{name}: duplicate artifact name used {count} times")

    for artifact in artifacts:
        item_issues: list[str] = []
        if artifact.kind not in KINDS:
            item_issues.append(
                f"unknown kind {artifact.kind!r}, expected one of {', '.join(KINDS)}"
            )
        local = inspect_shape(artifact.shape)
        placed_shape = artifact.placed()
        placed_bounds = _bounds(placed_shape)

        if not local["is_valid"]:
            item_issues.append("shape fails OpenCascade validity check")
        if local["volume_mm3"] <= 0:
            item_issues.append(f"non-positive volume {local['volume_mm3']} mm^3")
        if artifact.kind == "printable" and local["solid_count"] != 1:
            item_issues.append(
                f"printable part must be a single solid, found {local['solid_count']}"
            )
        elif local["solid_count"] < 1:
            item_issues.append("shape contains no solid")
        if not _bbox_is_finite(placed_bounds):
            item_issues.append("bounding box is not finite or is degenerate")

        entries.append(
            {
                "name": artifact.name,
                "kind": artifact.kind,
                "position": [_r(v) for v in artifact.position],
                "note": artifact.note,
                "is_valid": local["is_valid"],
                "solid_count": local["solid_count"],
                "volume_mm3": local["volume_mm3"],
                "local_bbox": local["bbox"],
                "placed_bbox": _bbox_report(placed_bounds),
                "issues": item_issues,
            }
        )
        issues.extend(f"{artifact.name}: {text}" for text in item_issues)
        placed.append((artifact, placed_shape, placed_bounds))

    physical = [item for item in placed if item[0].kind in PHYSICAL_KINDS]
    reservations = [item for item in placed if item[0].kind == "reservation"]
    pairs = [*combinations(physical, 2), *product(physical, reservations)]

    interferences: list[dict] = []
    skipped = 0
    for (art_a, shape_a, bounds_a), (art_b, shape_b, bounds_b) in pairs:
        if not _overlap(bounds_a, bounds_b):
            skipped += 1
            continue
        pair = {
            "a": art_a.name,
            "b": art_b.name,
            "kinds": [art_a.kind, art_b.kind],
            "method": "boolean_common",
        }
        try:
            volume = _common_volume(shape_a, shape_b)
        except Exception as error:  # OCC Boolean failure is a validation failure, not a pass
            pair["status"] = "error"
            pair["error"] = f"{type(error).__name__}: {error}"
            issues.append(f"{art_a.name} vs {art_b.name}: Boolean common failed: {error}")
        else:
            pair["common_volume_mm3"] = _r(volume)
            if volume > COLLISION_VOLUME_TOL_MM3:
                pair["status"] = "interference"
                issues.append(
                    f"{art_a.name} vs {art_b.name}: Boolean common volume {volume:.6g} mm^3 "
                    f"exceeds {COLLISION_VOLUME_TOL_MM3:g} mm^3"
                )
            else:
                pair["status"] = "contact"
        interferences.append(pair)

    by_kind = {kind: [e["name"] for e in entries if e["kind"] == kind] for kind in KINDS}
    placed_bounds_by_kind = {
        kind: [bounds for artifact, _, bounds in placed if artifact.kind == kind] for kind in KINDS
    }

    return {
        "schema": "macrack.validation/1",
        "ok": not issues,
        "tolerances": {
            "collision_volume_mm3": COLLISION_VOLUME_TOL_MM3,
            "contact_allowed": True,
        },
        "counts": {kind: len(names) for kind, names in by_kind.items()},
        "coverage": {**by_kind, "note": _ABSENT_HARDWARE_NOTE},
        "artifacts": entries,
        "envelope": {
            "all": _envelope([bounds for _, _, bounds in placed]),
            "physical": _envelope(
                placed_bounds_by_kind["printable"] + placed_bounds_by_kind["keepout"]
            ),
            "printable": _envelope(placed_bounds_by_kind["printable"]),
        },
        "interference": {
            "pairs_evaluated": len(interferences),
            "pairs_skipped_disjoint_bbox": skipped,
            "pairs": interferences,
        },
        "not_validated": list(NOT_VALIDATED),
        "issues": issues,
    }
