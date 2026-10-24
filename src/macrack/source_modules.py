"""Measured assembly of the vendor Mac cradle, its lid, its two handles and the OWC 1U shelf.

Every transform here was derived by measuring mating features in the source meshes
(`SourceProfile.mesh`), never from the 3MF build/plate transforms. Coordinates are the
canonical module frame shared with `rack_interface`: X centred on the module width, +Y toward
the rack rear with the front flange spanning -3..0, +Z up with the module floor plane at 0.
`z` and `module_y` lift that frame into the rack: frame = (x, module_y + y, z + z_local).
"""

from __future__ import annotations

import numpy as np
import trimesh

from macrack.source_profile import SourcePlacement, SourceProfile

MAC_CASE = "M4 Mac Mini case.stl"
MAC_LID = "Mac Mini Pro Rack Lid"
MAC_HANDLE = "Mac Mini Handle"
OWC_SHELF = "1M2 Vented.stl"

# Authored bounds and triangle count of each source mesh; a mismatch means the 3MF changed and
# every measured transform below has to be re-derived before it is trusted again.
_SOURCE_FINGERPRINTS = {
    MAC_CASE: ((-83.4, -73.2, -37.5), (83.4, 73.2, 37.5), 39642),
    MAC_LID: ((-66.95, -69.975, -5.9), (66.95, 69.975, 5.9), 1764),
    MAC_HANDLE: ((-29.5958, -1.9632, -11.1479), (29.5958, 1.9632, 11.1479), 2332),
    OWC_SHELF: ((-83.4, -12.5, -73.1824), (83.4, 12.5, 73.1824), 2276),
}

# --- Mac cradle (object 17), measured in its own mesh coordinates ---

# Rack ear plate: the only material wider than +/-77, 3.000 thick.
_MAC_FLANGE_FRONT_Y = -72.8
# Underside of the +/-77 side slides, which run the full 143.0 body depth.
_MAC_FLOOR_Z = -37.5
# Top of the ledge the Mac rests on, 4.15 wide around a 119.5 x 119.5 through opening.
_MAC_SHELF_Z = -28.0
# Pocket walls, 127.800 apart in both axes but centred on y = +0.2, not on the mesh centre.
_MAC_POCKET_Y = (-63.7, 64.1)
# Ledge the lid skin lands on.
_MAC_LID_LEDGE_Z = 35.1
# Handle sockets: four blind 4.79 bores, 6.000 deep, in the 9.1 thick front block.
_MAC_SOCKET_X = 67.6
_MAC_SOCKET_FLOOR_Y = -66.8

# --- Mac lid (object 24) ---

# Underside of the lid skin; the 2.400 skin seats on the cradle rebate ledge.
_LID_SKIN_UNDER_Z = 3.5
# Rear edge, which finishes flush with the cradle rear face.
_LID_REAR_Y = 69.975

# --- Mac handle (objects 20 and 22, one shared mesh) ---

# Arm bar is a 4.59 round section flattened to 3.926 on one side, so the bar axis sits 0.336
# off the mesh centre plane: aligning mesh centres instead of bar axes jams the arm in the bore.
_HANDLE_ARM_AXIS_Y = -0.336
# Flat tip of both arms; it bottoms out on the socket floor.
_HANDLE_ARM_TIP_Z = 11.1479

# --- OWC 1U shelf (object 8) ---

_OWC_FLANGE_FRONT_Z = -65.2176
_OWC_FLOOR_UNDERSIDE_Y = -12.5
# Clear tray front, against the flange, and the floor top the devices stand on.
_OWC_BAY_FRONT_Z = -62.2176
_OWC_BAY_FLOOR_TOP_Y = -10.7

# --- canonical-frame placements ---

# Flange front face -> Y = -3, slide underside -> Z = 0.
_MAC_TO_CANONICAL = (0.0, -3.0 - _MAC_FLANGE_FRONT_Y, -_MAC_FLOOR_Z)
# Skin underside -> cradle rebate ledge, rear edge -> cradle rear face at canonical Y = 143.0.
_LID_TO_CANONICAL = (
    0.0,
    143.0 - _LID_REAR_Y,
    _MAC_TO_CANONICAL[2] + _MAC_LID_LEDGE_Z - _LID_SKIN_UNDER_Z,
)
# Local +x -> canonical +z, +y -> +x, +z -> +y: a 120 deg rotation about (1,1,1).
_HANDLE_RIGHT_ROTATION = np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]], dtype=float)
# Same part turned 180 deg about the arm axis; the bail is mirror-symmetric across its own
# plane, so the left handle needs no reflection, only this rotation.
_HANDLE_LEFT_ROTATION = np.array([[0, -1, 0], [0, 0, 1], [-1, 0, 0]], dtype=float)
# The arm pitch equals the socket pitch (54.6), so the bail needs no vertical offset.
_HANDLE_TO_CANONICAL = (
    _MAC_SOCKET_X - _HANDLE_ARM_AXIS_Y,
    _MAC_TO_CANONICAL[1] + _MAC_SOCKET_FLOOR_Y - _HANDLE_ARM_TIP_Z,
    _MAC_TO_CANONICAL[2],
)
# Local +y -> canonical +z and +z -> +y; +x must map to -x or the matrix is a reflection, which
# FreeCAD's Placement cannot carry. This is a 180 deg rotation about (0,1,1).
_OWC_ROTATION = np.array([[-1, 0, 0], [0, 0, 1], [0, 1, 0]], dtype=float)
_OWC_TO_CANONICAL = (0.0, -3.0 - _OWC_FLANGE_FRONT_Z, -_OWC_FLOOR_UNDERSIDE_Y)

# --- reference-device seats, measured from the pockets that receive them ---

# Mac: centred in the 127.800 pocket and standing on the ledge, which leaves 0.400 per side.
_MAC_REFERENCE_SEAT = (
    0.0,
    _MAC_TO_CANONICAL[1] + (_MAC_POCKET_Y[0] + _MAC_POCKET_Y[1]) / 2 - 63.5,
    _MAC_TO_CANONICAL[2] + _MAC_SHELF_Z,
)
# The source has no divider: the reference boxes meet at the centreline and front stop.
# The published pair leaves 0.400 mm at each side wall and at the rear.
_OWC_REFERENCE_HALF_PITCH = 35.55
_OWC_REFERENCE_SEAT = (
    _OWC_TO_CANONICAL[1] + _OWC_BAY_FRONT_Z,
    _OWC_TO_CANONICAL[2] + _OWC_BAY_FLOOR_TOP_Y,
)


def _seat(x: float, y: float, z: float) -> tuple[float, float, float]:
    # Rounded to 1 nm: the measured features carry four decimals, and raw float sums otherwise
    # reach reports as 1.8000000000000007.
    return (round(x, 6), round(y, 6), round(z, 6))


def _affine(rotation: np.ndarray | None, translation: tuple[float, float, float]) -> np.ndarray:
    matrix = np.eye(4)
    if rotation is not None:
        matrix[:3, :3] = rotation
    matrix[:3, 3] = translation
    return matrix


def _into_frame(
    rotation: np.ndarray | None,
    canonical: tuple[float, float, float],
    z: float,
    module_y: float,
) -> np.ndarray:
    return _affine(rotation, (canonical[0], canonical[1] + module_y, canonical[2] + z))


def _checked(profile: SourceProfile, name: str, instances: int = 1) -> tuple[int, ...]:
    """Object ids for `name`, after asserting the mesh still matches what was measured."""
    expected_min, expected_max, expected_faces = _SOURCE_FINGERPRINTS[name]
    profile.require_object(name, instances)
    ids = profile.objects_named(name)
    for object_id in ids:
        mesh = profile.mesh(object_id)
        bounds = mesh.bounds
        drift = max(
            abs(float(actual) - expected)
            for actual, expected in zip(
                (*bounds[0], *bounds[1]), (*expected_min, *expected_max), strict=True
            )
        )
        # The authored coordinates are not exact decimals; 1 um is far below any feature here.
        if drift > 1e-3:
            raise ValueError(
                f"{name} (object {object_id}): bounds moved by {drift} mm; "
                "remeasure the mating features before placing it"
            )
        if len(mesh.faces) != expected_faces:
            raise ValueError(
                f"{name} (object {object_id}): {len(mesh.faces)} faces, expected "
                f"{expected_faces}; remeasure the mating features before placing it"
            )
    return ids


def mac_placements(profile: SourceProfile, z: float, module_y: float) -> list[SourcePlacement]:
    """Cradle, lid and both handles, seated on each other's measured mating features."""
    cradle = _checked(profile, MAC_CASE)[0]
    lid = _checked(profile, MAC_LID)[0]
    right_handle, left_handle = _checked(profile, MAC_HANDLE, instances=2)
    return [
        SourcePlacement(
            "mac_cradle",
            cradle,
            _into_frame(None, _MAC_TO_CANONICAL, z, module_y),
            "rack ear front face on Y=-3, side slides on Z=0..8 over the full 143.0 body depth",
        ),
        SourcePlacement(
            "mac_lid",
            lid,
            _into_frame(None, _LID_TO_CANONICAL, z, module_y),
            "skin underside on the cradle rebate ledge, rear edge flush with the cradle rear; "
            "lid top lands on Z=75.0 and the rebate leaves 0.15 per side",
        ),
        SourcePlacement(
            "mac_handle_right",
            right_handle,
            _into_frame(_HANDLE_RIGHT_ROTATION, _HANDLE_TO_CANONICAL, z, module_y),
            "bail arms bottomed in the two right blind sockets; bar axis on the bore axis",
        ),
        SourcePlacement(
            "mac_handle_left",
            left_handle,
            _into_frame(
                _HANDLE_LEFT_ROTATION,
                (-_HANDLE_TO_CANONICAL[0], *_HANDLE_TO_CANONICAL[1:]),
                z,
                module_y,
            ),
            "same part rotated 180 deg about the arm axis, not mirrored; flats face inboard, "
            "which the circular sockets do not constrain",
        ),
    ]


def owc_placement(profile: SourceProfile, z: float, module_y: float) -> SourcePlacement:
    """The 1U SSD shelf, flange front face on Y=-3 and tray floor underside on Z=0."""
    shelf = _checked(profile, OWC_SHELF)[0]
    return SourcePlacement(
        "owc_shelf",
        shelf,
        _into_frame(_OWC_ROTATION, _OWC_TO_CANONICAL, z, module_y),
        "rack ear front face on Y=-3, side slides on Z=0..8; the two pull tabs reach Y=-10.96",
    )


def mac_reference_origin(
    profile: SourceProfile, z: float, module_y: float
) -> tuple[float, float, float]:
    """Seat for a 127 x 127 x 50 Mac reference box: (x centre, y of front face, z of underside).

    Centred in the measured pocket and standing on the measured ledge. The 127 x 127 x 50
    figure is the published overall size only; nothing here asserts that a real machine fits.
    """
    _checked(profile, MAC_CASE)
    return _seat(
        _MAC_REFERENCE_SEAT[0],
        _MAC_REFERENCE_SEAT[1] + module_y,
        _MAC_REFERENCE_SEAT[2] + z,
    )


def owc_reference_origins(
    profile: SourceProfile, z: float, module_y: float
) -> list[tuple[float, float, float]]:
    """Seats for the two 71.1 x 132 x 22.8 reference boxes, left bay first."""
    _checked(profile, OWC_SHELF)
    return [
        _seat(
            sign * _OWC_REFERENCE_HALF_PITCH,
            _OWC_REFERENCE_SEAT[0] + module_y,
            _OWC_REFERENCE_SEAT[1] + z,
        )
        for sign in (-1.0, 1.0)
    ]


def mac_cradle_measurements(profile: SourceProfile) -> dict:
    """Mating features and reference-fit facts for the Mac module, in canonical module mm."""
    _checked(profile, MAC_CASE)
    _checked(profile, MAC_LID)
    _checked(profile, MAC_HANDLE, instances=2)
    return {
        "frame": "canonical module mm: X centred, +Y rear with the rack ear on -3..0, +Z up "
        "from the module floor plane",
        "cradle": {
            "rack_ear_mm": {"width": 166.8, "y": [-3.0, 0.0], "z": [0.0, 75.0]},
            "front_face_marking_mm": {
                "proud": 0.4,
                "x": [-50.8, -44.0],
                "z": [2.0, 4.8],
                "note": "raised marking only; not a mating feature",
            },
            "body_half_width_mm": 73.0,
            "side_slides_mm": {"half_width": 77.0, "y": [0.0, 143.0], "z": [0.0, 8.0]},
            "overall_mm": {"x": [-83.4, 83.4], "y": [-3.4, 143.0], "z": [0.0, 75.0]},
            "front_block_depth_mm": 9.1,
        },
        "pocket": {
            "x_mm": [-63.9, 63.9],
            "y_mm": [6.1, 133.9],
            "clear_mm": [127.8, 127.8],
            "wall_top_z_mm": 67.83,
            "straight_wall_y_mm": [35.3, 104.3],
            "corner_profile": "rounded, not a single arc; least-squares circle r=26.1-26.4 "
            "with 0.19 residual",
        },
        "device_support": {
            "ledge_top_z_mm": 9.5,
            "through_opening_mm": {"x": [-59.775, 59.725], "y": [10.225, 129.725]},
            "ledge_width_mm": 4.15,
        },
        "lid_interface": {
            "rebate_ledge_z_mm": 72.6,
            "rebate_opening_mm": {"x": [-67.1, 67.1], "y_front": 2.9},
            "lid_seated_mm": {"x": [-66.95, 66.95], "y": [3.05, 143.0], "z": [63.2, 75.0]},
            "clearance_per_side_mm": 0.15,
            "rear": "lid rear edge finishes flush with the cradle rear face; the rebate is "
            "open rearward, so only the front wall locates the lid in Y",
            "apple_logo": "embossed on the lid +Z face, which fixes which way up it goes",
        },
        "handle_interface": {
            "socket_centres_mm": {"x": [-67.6, 67.6], "z": [10.2, 64.8]},
            "socket_bore_mm": 4.79,
            "socket_depth_mm": 6.0,
            "arm_bar_mm": {"round_section": 4.59, "flat_to_round": 3.926, "pitch": 54.6},
            "seated_mm": {"x_outer": 69.899, "y": [-19.2958, 3.0], "z": [7.904, 67.096]},
            "front_projection_mm": 16.3,
            "handedness": "both handles are the same mesh under proper rotations; the left is "
            "the right turned 180 deg about the arm axis, so no mirrored copy is needed",
            "unresolved": "the sockets are circular, so the source does not constrain roll "
            "about the arm axis; flats are placed inboard by symmetry, which only decides "
            "which face shows and shifts each handle 0.336 laterally",
        },
        "mac_reference": {
            "box_mm": [127.0, 127.0, 50.0],
            "basis": "published overall size only",
            "seated_mm": {"x": [-63.5, 63.5], "y": [6.5, 133.5], "z": [9.5, 59.5]},
            "clearance_per_side_mm": 0.4,
            "headroom_above_mm": 8.3,
            "sharp_box_overlap_mm3": 23831.7,
            "sharp_box_overlap": "four corner lunes, 23.7 x 23.2 in plan over the full 50 "
            "height, 22.84 deep on the diagonal; this is the square box against the rounded "
            "pocket corner, not a measured interference",
            "min_corner_radius_to_clear_mm": 24.16,
            "advice": "treat a square 127 x 127 box as a conservative keepout and report the "
            "corner overlap as unresolved reference-envelope overlap. The machine's own corner "
            "radius is not published, so no rounded reference can be built without inventing "
            "it; the measured pocket clears any 127 x 127 footprint whose corner radius is at "
            "least 24.16",
        },
        "port_access": {
            "front_openings_mm": [
                {"x": [-47.1, -12.1], "z": [15.7, 35.7]},
                {"x": [12.1, 47.1], "z": [15.7, 35.7]},
            ],
            "vent_pattern": "staggered round perforations across the rest of the front block",
            "rear": "the pocket is open rearward above the ledge except for the two corner "
            "posts, so cable exit is unobstructed",
            "note": "openings are source features; no machine port positions are claimed",
        },
    }


def owc_shelf_measurements(profile: SourceProfile) -> dict:
    """Tray geometry and the reference-pair fit for the OWC 1U shelf, in canonical module mm."""
    _checked(profile, OWC_SHELF)
    return {
        "frame": "canonical module mm: X centred, +Y rear with the rack ear on -3..0, +Z up "
        "from the module floor plane",
        "shelf": {
            "rack_ear_mm": {"width": 166.8, "y": [-3.0, 0.0], "z": [0.0, 25.0]},
            "overall_mm": {"x": [-83.4, 83.4], "y": [-10.9648, 135.4], "z": [0.0, 25.0]},
            "side_slides_mm": {"half_width": 77.0, "z": [0.0, 8.0]},
            "body_half_width_mm": 73.0,
            "pull_tabs_mm": {"x_outer": 79.0, "y": [-10.9648, -3.0], "z": [0.0, 25.0]},
            "single_body": "tray, ear and tabs are one connected solid",
        },
        "bay": {
            "x_mm": [-71.5, 71.5],
            "y_mm": [0.0, 132.4],
            "floor_top_z_mm": 1.8,
            "floor_thickness_mm": 1.8,
            "wall_top_z_mm": 13.35,
            "open_top": True,
            "divider": "none; one open bay, so nothing in the source separates the two devices "
            "or locates them in X beyond the side walls",
            "floor_vents_mm": [
                {"x": [-61.23, -11.48], "y": [30.66, 109.41]},
                {"x": [10.27, 60.02], "y": [30.66, 109.41]},
            ],
            "floor_vent_note": "the two 50 x 79 vents sit 0.6 off the bay centreline; they are "
            "vents, not locating features, so the reference pair is centred on the walls",
        },
        "owc_reference": {
            "box_mm": [71.1, 132.0, 22.8],
            "basis": "published overall size only",
            "count": 2,
            "seated_mm": [
                {"x": [-71.1, 0.0], "y": [0.0, 132.0], "z": [1.8, 24.6]},
                {"x": [0.0, 71.1], "y": [0.0, 132.0], "z": [1.8, 24.6]},
            ],
            "clearance_mm": {
                "outboard_per_side": 0.4,
                "depth": 0.4,
                "above": 0.4,
                "between_boxes": 0.0,
            },
            "square_box_overlap_mm3": 0.0,
            "verdict": "the published whole-box envelopes clear the source solid, with 0.4 "
            "at each side wall, 0.4 total depth allowance and 0.4 below the nominal 1U ceiling; "
            "the front faces contact the stop and the two boxes meet at the centreline",
            "unresolved": "the pair is centred on the side walls because the source has no "
            "divider; the boxes touch each other at X=0, which is a reference-envelope contact, "
            "not a measured interference. No purchase or ownership of these devices is implied",
        },
    }


def placed_meshes(
    profile: SourceProfile, placements: list[SourcePlacement]
) -> list[trimesh.Trimesh]:
    """Source meshes transformed into the rack frame, triangles untouched."""
    return [placement.apply(profile.mesh(placement.object_id)) for placement in placements]
