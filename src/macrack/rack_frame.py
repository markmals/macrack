"""Measured assembly of the original Rack Pro frame: base, six slotted rails, top panel.

Canonical assembly axes, millimetres: +X right (seen from the front), +Y rear, +Z up,
Z=0 at the base underside (the surface the rack stands on).
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

import numpy as np
import trimesh

from macrack.rack_interface import BODY_HALF_WIDTH, FRONT_DEPTH, SLIDE_HALF_WIDTH, U
from macrack.source_profile import SourcePlacement, SourceProfile

GROUND_Z = 0.0
# Source panels/rails are authored on exact 0.1 mm features; anything looser is a changed source.
FIT_TOL = 1e-3
# Pocket mouths and panel edges are chamfered, so probes land a few tenths below a face
# plane without that face being a pocket.
RIM_RELIEF = 0.5

BASE_NAME = "Rack Base"
BASE_EXTENTS = (175.0, 10.0, 172.6)
TOP_NAME = "Rack Lid with Logo"
TOP_EXTENTS = (150.0, 10.0, 172.6)
RAIL_SIZES = {
    "full": {"name": "Rail", "instances": 6, "extents": (25.0, 254.0, 10.0), "slots": 10},
    "short": {
        "name": "Rail - Short.stl",
        "instances": 6,
        "extents": (25.0, 177.8, 10.0),
        "slots": 7,
    },
}

# Local axes of the source parts expressed in assembly axes (rows map local -> assembly).
# Panels are authored lying down with their 10 mm thickness on local Y; the base keeps that
# face up, the top panel is turned over onto the rail ends.
BASE_ROTATION = np.array([[0.0, 0.0, -1.0], [-1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
# Yaw chosen from the engraved logo: its leaf points along local -X and its bite faces local
# +Z, so this puts the leaf toward the rack rear and the bite to the right.
TOP_ROTATION = np.array([[0.0, 0.0, 1.0], [-1.0, 0.0, 0.0], [0.0, -1.0, 0.0]])
# Rails stand on their local +Y axis; the slotted local -Z face has to turn inward, which is a
# 180 degree yaw between the two sides - a rotation, never a mirror.
RAIL_ROTATION_RIGHT = np.array([[0.0, 0.0, 1.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
RAIL_ROTATION_LEFT = np.array([[0.0, 0.0, -1.0], [-1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])

DEPTH_LABELS = ("front", "mid", "rear")


@dataclass(frozen=True)
class RailMeasurement:
    """Rail features in rail-local coordinates (X across the post, Y along it, Z thickness)."""

    length: float
    section: tuple[float, float]
    slot_floors: tuple[float, ...]
    slot_pitch: float
    slot_height: float
    slot_depth: float


@dataclass(frozen=True)
class Pocket:
    depth: tuple[float, float]
    width: tuple[float, float]
    floor: float

    @property
    def size(self) -> tuple[float, float]:
        return (self.depth[1] - self.depth[0], self.width[1] - self.width[0])

    @property
    def centre(self) -> tuple[float, float]:
        return ((self.depth[0] + self.depth[1]) / 2, (self.width[0] + self.width[1]) / 2)


@dataclass(frozen=True)
class PanelMeasurement:
    """Panel features in panel-local coordinates (X depth, Y thickness, Z width)."""

    mouth: float
    sockets: tuple[Pocket, ...]
    recesses: tuple[Pocket, ...]
    open_cells: tuple[tuple[tuple[float, float], tuple[float, float]], ...]
    solid_cells: tuple[tuple[tuple[float, float], tuple[float, float]], ...]


@dataclass(frozen=True)
class FrameLayout:
    placements: list[SourcePlacement]
    slot_origins: tuple[float, ...]
    module_y: float
    measurements: dict


# --- mesh measurement helpers ---


def _axis_planes(
    mesh: trimesh.Trimesh, axis: int, sign: int, min_area: float
) -> dict[float, float]:
    """Offsets of planes normal to `axis` facing `sign`, mapped to their total facet area."""
    normals = mesh.face_normals
    selected = np.abs(normals[:, axis] - sign) < 1e-6
    if not selected.any():
        return {}
    offsets = np.round(mesh.triangles[selected][:, 0, axis], 6)
    areas = mesh.area_faces[selected]
    totals: dict[float, float] = {}
    for offset, area in zip(offsets, areas, strict=True):
        totals[float(offset)] = totals.get(float(offset), 0.0) + float(area)
    return {offset: area for offset, area in sorted(totals.items()) if area >= min_area}


def _first_hit(mesh: trimesh.Trimesh, points: np.ndarray, axis: int, start: float) -> np.ndarray:
    """Downward (-axis) ray cast from `start`; NaN where the ray misses the solid entirely."""
    others = [index for index in range(3) if index != axis]
    origins = np.zeros((len(points), 3))
    origins[:, others[0]] = points[:, 0]
    origins[:, others[1]] = points[:, 1]
    origins[:, axis] = start
    directions = np.zeros_like(origins)
    directions[:, axis] = -1.0
    locations, ray_index, _ = mesh.ray.intersects_location(origins, directions, multiple_hits=True)
    hits = np.full(len(points), np.nan)
    for location, ray in zip(locations, ray_index, strict=True):
        value = location[axis]
        if np.isnan(hits[ray]) or value > hits[ray]:
            hits[ray] = value
    return hits


def _intervals(mesh: trimesh.Trimesh, axis: int, min_area: float) -> list[tuple[float, float]]:
    edges = sorted(
        set(_axis_planes(mesh, axis, 1, min_area)) | set(_axis_planes(mesh, axis, -1, min_area))
    )
    return [(low, high) for low, high in zip(edges, edges[1:], strict=False) if high - low > 1.0]


def measure_rail(mesh: trimesh.Trimesh, label: str) -> RailMeasurement:
    extents = mesh.extents
    long_axis = int(np.argmax(extents))
    thickness_axis = int(np.argmin(extents))
    across_axis = 3 - long_axis - thickness_axis
    if (long_axis, thickness_axis) != (1, 2):
        raise ValueError(
            f"{label}: expected the post axis on local Y and thickness on local Z, measured "
            f"extents {np.round(extents, 4).tolist()}"
        )

    low, high = mesh.bounds[0][long_axis], mesh.bounds[1][long_axis]
    candidate_floors = sorted(
        offset for offset in _axis_planes(mesh, long_axis, 1, 10.0) if abs(offset - high) > FIT_TOL
    )
    candidate_ceilings = sorted(
        offset for offset in _axis_planes(mesh, long_axis, -1, 10.0) if abs(offset - low) > FIT_TOL
    )
    # A slot is a floor plane and the first ceiling plane above it; the rails also carry
    # blind end-screw pockets, whose faces must fall outside the slotted span.
    pairs = []
    for floor in candidate_floors:
        above = [value for value in candidate_ceilings if value > floor + FIT_TOL]
        if above:
            pairs.append((floor, above[0]))
    if len(pairs) < 2:
        raise ValueError(f"{label}: found {len(pairs)} slots; the source rail is not slotted")
    heights = np.array([ceiling - floor for floor, ceiling in pairs])
    if np.ptp(heights) > FIT_TOL:
        raise ValueError(
            f"{label}: slot heights vary ({np.round(heights, 4).tolist()}); remeasure the rail"
        )
    floors = [floor for floor, _ in pairs]
    pitches = np.diff(floors)
    if np.ptp(pitches) > FIT_TOL:
        raise ValueError(f"{label}: slot pitch is not uniform ({np.round(pitches, 4).tolist()})")
    slotted_span = (floors[0] - FIT_TOL, pairs[-1][1] + FIT_TOL)
    strays = [
        offset
        for offset in set(candidate_floors) | set(candidate_ceilings)
        if slotted_span[0] <= offset <= slotted_span[1]
        and not any(abs(offset - value) <= FIT_TOL for pair in pairs for value in pair)
    ]
    if strays:
        raise ValueError(
            f"{label}: unexpected transverse faces inside the slotted span at {sorted(strays)}"
        )

    # The slotted face is the thickness face that also carries the recessed slot floors.
    outward = mesh.bounds[0][thickness_axis]
    recesses = [
        offset
        for offset in _axis_planes(mesh, thickness_axis, -1, 10.0)
        if abs(offset - outward) > FIT_TOL
    ]
    if len(recesses) != 1:
        raise ValueError(f"{label}: expected one recessed slot floor plane, measured {recesses}")
    return RailMeasurement(
        length=float(extents[long_axis]),
        section=(float(extents[across_axis]), float(extents[thickness_axis])),
        slot_floors=tuple(float(value) for value in floors),
        slot_pitch=float(pitches[0]),
        slot_height=float(heights[0]),
        slot_depth=float(recesses[0] - outward),
    )


def measure_panel(
    mesh: trimesh.Trimesh, label: str, section: tuple[float, float]
) -> PanelMeasurement:
    """Classify the panel's pockets by probing each rectangle the face planes carve out."""
    extents = mesh.extents
    thickness_axis = int(np.argmin(extents))
    if thickness_axis != 1:
        raise ValueError(
            f"{label}: expected panel thickness on local Y, measured extents "
            f"{np.round(extents, 4).tolist()}"
        )
    depth_axis, width_axis = 0, 2
    mouth = float(mesh.bounds[1][thickness_axis])

    depth_cells = _intervals(mesh, depth_axis, 50.0)
    width_cells = _intervals(mesh, width_axis, 50.0)
    if not depth_cells or not width_cells:
        raise ValueError(f"{label}: no face planes to divide the panel into cells")

    probes = []
    cells = []
    for depth in depth_cells:
        for width in width_cells:
            cells.append((depth, width))
            for fraction_d in (0.25, 0.5, 0.75):
                for fraction_w in (0.25, 0.5, 0.75):
                    probes.append(
                        (
                            depth[0] + fraction_d * (depth[1] - depth[0]),
                            width[0] + fraction_w * (width[1] - width[0]),
                        )
                    )
    hits = _first_hit(mesh, np.array(probes), thickness_axis, mouth + 1.0).reshape(len(cells), 9)

    sockets: list[Pocket] = []
    recesses: list[Pocket] = []
    open_cells: list[tuple[tuple[float, float], tuple[float, float]]] = []
    solid_cells: list[tuple[tuple[float, float], tuple[float, float]]] = []
    for (depth, width), cell_hits in zip(cells, hits, strict=True):
        reached = cell_hits[~np.isnan(cell_hits)]
        if reached.size == 0:
            open_cells.append((depth, width))
            continue
        floor = float(Counter(np.round(reached, 4)).most_common(1)[0][0])
        if mouth - floor <= RIM_RELIEF:
            solid_cells.append((depth, width))
            continue
        above = reached[reached > floor + FIT_TOL]
        if above.size:
            raise ValueError(
                f"{label}: cell {depth}x{width} has material at {np.round(above, 4).tolist()} "
                f"above its {floor} mm floor; the panel's pocket layout changed"
            )
        pocket = Pocket(depth=depth, width=width, floor=floor)
        fits_rail = all(0.0 <= pocket.size[index] - section[index] <= 0.4 for index in range(2))
        (sockets if fits_rail else recesses).append(pocket)
    return PanelMeasurement(
        mouth=mouth,
        sockets=tuple(sockets),
        recesses=tuple(recesses),
        open_cells=tuple(open_cells),
        solid_cells=tuple(solid_cells),
    )


# --- placement ---


def _affine(rotation: np.ndarray, translation: tuple[float, float, float]) -> np.ndarray:
    matrix = np.eye(4)
    matrix[:3, :3] = rotation
    matrix[:3, 3] = translation
    if abs(np.linalg.det(rotation) - 1.0) > 1e-9:
        raise ValueError(f"placement rotation is not a proper rotation:\n{rotation}")
    return matrix


def _centred(mesh: trimesh.Trimesh, axis: int, label: str) -> None:
    low, high = mesh.bounds[0][axis], mesh.bounds[1][axis]
    if abs(low + high) > FIT_TOL:
        raise ValueError(f"{label}: axis {axis} is not centred on its origin ({low}..{high})")


def build_frame(profile: SourceProfile, rail_size: str = "full") -> FrameLayout:
    """Place the original frame on the ground datum and read its slot table off the rails.

    `slot_origins` are assembly Z heights of the rail slot floors, i.e. where a module's
    canonical Z=0 lands; `module_y` is what a canonical template's Y must be shifted by.
    """
    if rail_size not in RAIL_SIZES:
        raise ValueError(f"rail_size must be one of {sorted(RAIL_SIZES)}, got {rail_size!r}")
    spec = RAIL_SIZES[rail_size]

    base_id = profile.require_object(BASE_NAME, 1)
    top_id = profile.require_object(TOP_NAME, 1)
    rail_id = profile.require_object(spec["name"], spec["instances"])
    base = profile.mesh(base_id)
    top = profile.mesh(top_id)
    rail = profile.mesh(rail_id)
    for mesh, label, expected in (
        (base, BASE_NAME, BASE_EXTENTS),
        (top, TOP_NAME, TOP_EXTENTS),
        (rail, spec["name"], spec["extents"]),
    ):
        if not np.allclose(mesh.extents, expected, atol=FIT_TOL):
            raise ValueError(
                f"{label}: source bounds changed, measured {np.round(mesh.extents, 4).tolist()} "
                f"mm against {list(expected)}; remeasure the frame before placing it"
            )
        if not mesh.is_watertight:
            raise ValueError(f"{label}: source mesh is not watertight; refusing to place it")

    rail_measure = measure_rail(rail, spec["name"])
    if len(rail_measure.slot_floors) != spec["slots"]:
        raise ValueError(
            f"{spec['name']}: measured {len(rail_measure.slot_floors)} slots, "
            f"expected {spec['slots']}"
        )
    base_measure = measure_panel(base, BASE_NAME, rail_measure.section)
    top_measure = measure_panel(top, TOP_NAME, rail_measure.section)
    for label, panel in ((BASE_NAME, base_measure), (TOP_NAME, top_measure)):
        if len(panel.sockets) != 6:
            raise ValueError(f"{label}: measured {len(panel.sockets)} rail sockets, expected 6")
    for axis in (0, 2):
        _centred(base, axis, BASE_NAME)
        _centred(top, axis, TOP_NAME)

    # Base: local +Y up, underside on the ground datum.
    base_transform = _affine(BASE_ROTATION, (0.0, 0.0, GROUND_Z - base.bounds[0][1]))

    socket_floor = base_measure.sockets[0].floor
    if any(abs(socket.floor - socket_floor) > FIT_TOL for socket in base_measure.sockets):
        raise ValueError(f"{BASE_NAME}: rail sockets have different floors")
    socket_floor_z = float(socket_floor + base_transform[2, 3])
    socket_clearance = tuple(
        round(base_measure.sockets[0].size[index] - rail_measure.section[index], 4)
        for index in range(2)
    )

    rail_z0 = socket_floor_z - rail.bounds[0][1]
    rail_top_z = rail_z0 + rail.bounds[1][1]

    # Rail positions come from the base sockets: local X runs front-to-rear, local Z across.
    seats = []
    for socket in base_measure.sockets:
        depth_centre, width_centre = socket.centre
        seats.append(
            (
                float(BASE_ROTATION[0, 2] * width_centre),
                float(BASE_ROTATION[1, 0] * depth_centre),
            )
        )
    # 3MF vertices round-trip through float32, so authored 0.1 mm features land ~2e-6 off.
    depths = sorted({round(y, 4) + 0.0 for _, y in seats})
    sides = sorted({round(x, 4) + 0.0 for x, _ in seats})
    if len(depths) != 3 or len(sides) != 2 or abs(sides[0] + sides[1]) > FIT_TOL:
        raise ValueError(
            f"{BASE_NAME}: sockets are not three depths on two symmetric sides ({seats})"
        )

    placements = [
        SourcePlacement(
            name="rack_base",
            object_id=base_id,
            transform=base_transform,
            note="frame datum: underside on the ground plane",
        )
    ]
    for side_x in sides:
        rotation = RAIL_ROTATION_RIGHT if side_x > 0 else RAIL_ROTATION_LEFT
        for label, depth_y in zip(DEPTH_LABELS, depths, strict=True):
            placements.append(
                SourcePlacement(
                    name=f"rail_{'right' if side_x > 0 else 'left'}_{label}",
                    object_id=rail_id,
                    transform=_affine(rotation, (side_x, depth_y, rail_z0)),
                    note=f"{rail_size} rail seated in its base socket, slotted face inward",
                )
            )

    # Top: turned over, its sockets bottoming on the rail ends.
    top_floor = top_measure.sockets[0].floor
    if any(abs(socket.floor - top_floor) > FIT_TOL for socket in top_measure.sockets):
        raise ValueError(f"{TOP_NAME}: rail sockets have different floors")
    top_transform = _affine(TOP_ROTATION, (0.0, 0.0, rail_top_z + top_floor))
    placements.append(
        SourcePlacement(
            name="rack_top",
            object_id=top_id,
            transform=top_transform,
            note="inverted onto the rail ends; engraved logo upward",
        )
    )

    top_seats = sorted(
        (
            round(float(TOP_ROTATION[0, 2] * socket.centre[1]), 4),
            round(float(TOP_ROTATION[1, 0] * socket.centre[0]), 4),
        )
        for socket in top_measure.sockets
    )
    if top_seats != sorted((round(x, 4), round(y, 4)) for x, y in seats):
        raise ValueError(
            f"{TOP_NAME}: socket grid {top_seats} does not land on the base sockets "
            f"{sorted(seats)}; the frame does not close"
        )

    slot_origins = tuple(
        round(float(floor + rail_z0), 4) + 0.0 for floor in rail_measure.slot_floors
    )
    base_top_z = float(base.bounds[1][1] + base_transform[2, 3])
    if slot_origins[0] < base_top_z:
        raise ValueError(
            f"lowest slot {slot_origins[0]} mm sits below the base top face {base_top_z} mm"
        )

    # Interface planes the modules meet: inner rail faces, slot floors behind them, and the
    # front rail faces a module's rack ear lands on.
    inner_face_x = abs(sides[0]) - rail_measure.section[1] / 2
    slot_floor_x = inner_face_x + rail_measure.slot_depth
    module_y = min(
        float(BASE_ROTATION[1, 0] * edge)
        for socket in base_measure.sockets
        for edge in socket.depth
    )
    top_front_y = float(TOP_ROTATION[1, 0] * top.bounds[1][0])
    if abs((module_y - FRONT_DEPTH) - top_front_y) > FIT_TOL:
        raise ValueError(
            f"a {FRONT_DEPTH} mm rack ear on the front rail face at y={module_y} would end at "
            f"{module_y - FRONT_DEPTH}, but the top panel's front edge is at {top_front_y}"
        )

    socket_floor_local = top_measure.sockets[0].floor
    interior = [pocket for pocket in top_measure.recesses if pocket.floor > socket_floor_local]
    if not interior:
        raise ValueError(f"{TOP_NAME}: no interior recess to read the ceiling from")
    if np.ptp([pocket.floor for pocket in interior]) > FIT_TOL:
        raise ValueError(f"{TOP_NAME}: interior ceiling is stepped, not one plane")
    plate_underside_z = float(top_transform[2, 3] - interior[0].floor)
    # The skirt hangs below the plate all round the perimeter and overhangs every module's
    # full body width, so it - not the plate - is the ceiling a bay has to clear.
    usable_ceiling_z = float(top_transform[2, 3] - top_measure.mouth)
    interior_width = interior[0].width
    end_skirts = [depth for depth, width in top_measure.solid_cells if width == interior_width]
    if not end_skirts:
        raise ValueError(f"{TOP_NAME}: no front/rear skirt measured across the bay opening")
    skirt_inner_half_depth = min(abs(edge) for depth in end_skirts for edge in depth)
    skirt_inner_half_width = min(
        abs(edge) for _, width in top_measure.solid_cells for edge in width
    )

    if not base_measure.recesses:
        raise ValueError(f"{BASE_NAME}: no cross ribs measured under the bay opening")
    rib_floors = [pocket.floor for pocket in base_measure.recesses]
    if np.ptp(rib_floors) > FIT_TOL:
        raise ValueError(f"{BASE_NAME}: cross ribs sit at different heights ({rib_floors})")
    rib_top_local = rib_floors[0]
    # The ribs span the bay opening between the side members, so their width edges are also
    # the clear span a module's ground-bearing feet have to stay inside.
    rib_half_span_x = min(abs(edge) for pocket in base_measure.recesses for edge in pocket.width)

    bays = {}
    for units in (1, 2, 3):
        height = units * U
        usable = [
            index
            for index, origin in enumerate(slot_origins)
            if origin + height <= usable_ceiling_z + FIT_TOL
        ]
        bays[f"{units}U"] = {
            "start_slots": len(usable),
            "lowest_floor_z": slot_origins[usable[0]] if usable else None,
            "highest_floor_z": slot_origins[usable[-1]] if usable else None,
        }

    measurements = {
        "source_sha256": profile.sha256,
        "rail_size": rail_size,
        "rail_object": {"name": spec["name"], "object_id": rail_id, "instances": spec["instances"]},
        "ground_z": GROUND_Z,
        "rack_outer": {
            "width_x": float(base.extents[2]),
            "depth_y": float(base.extents[0]),
            "height_z": round(float(top_transform[2, 3] - top.bounds[0][1]), 4),
        },
        "base": {
            "object_id": base_id,
            "thickness_z": float(base.extents[1]),
            "top_face_z": base_top_z,
            "socket_floor_z": socket_floor_z,
            "socket_size_mm": [round(value, 4) for value in base_measure.sockets[0].size],
            "socket_clearance_mm": list(socket_clearance),
            "base_cross_ribs_y": sorted(
                [
                    round(float(BASE_ROTATION[1, 0] * pocket.depth[1]), 4),
                    round(float(BASE_ROTATION[1, 0] * pocket.depth[0]), 4),
                ]
                for pocket in base_measure.recesses
            ),
            "base_rib_top_z": round(float(rib_top_local + base_transform[2, 3]), 4),
            "base_rib_span_x": [
                -round(float(rib_half_span_x), 4),
                round(float(rib_half_span_x), 4),
            ],
        },
        "rails": {
            "length_mm": round(rail_measure.length, 4),
            "section_mm": [round(value, 4) for value in rail_measure.section],
            "seat_x": sides,
            "seat_y": depths,
            "bottom_z": round(rail_z0 + rail.bounds[0][1], 4),
            "top_z": round(rail_top_z, 4),
            "inner_face_x": round(inner_face_x, 4),
            "slot_floor_x": round(slot_floor_x, 4),
            "slot_pitch_mm": round(rail_measure.slot_pitch, 4),
            "slot_height_mm": round(rail_measure.slot_height, 4),
            "slot_depth_mm": rail_measure.slot_depth,
            "slot_count": len(slot_origins),
        },
        "top": {
            "object_id": top_id,
            "plate_underside_z": round(plate_underside_z, 4),
            "usable_ceiling_z": round(usable_ceiling_z, 4),
            "skirt_inner_half_width_x": round(float(skirt_inner_half_width), 4),
            "skirt_inner_half_depth_y": round(float(skirt_inner_half_depth), 4),
        },
        "slot_origins_z": list(slot_origins),
        "module_y": module_y,
        # Slot positions a full-height 1U module can occupy; fewer than slot_count, because
        # the top slots run into the lid skirt.
        "usable_full_units": bays["1U"]["start_slots"],
        "bays": bays,
        "module_interface_clearance": {
            "body_half_width_mm": round(inner_face_x - BODY_HALF_WIDTH, 4),
            "slide_half_width_mm": round(slot_floor_x - SLIDE_HALF_WIDTH, 4),
            "unit_height_mm": round(rail_measure.slot_pitch - U, 4),
            "ear_face_y": round(module_y - FRONT_DEPTH, 4),
        },
    }
    return FrameLayout(
        placements=placements,
        slot_origins=slot_origins,
        module_y=module_y,
        measurements=measurements,
    )
