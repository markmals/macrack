/** Measured facts of the vendor modules, in canonical module mm; see `source-modules.ts`. */

const FRAME_NOTE =
    "canonical module mm: X centred, +Y rear with the rack ear on -3..0, +Z up " +
    "from the module floor plane";

/** Mating features and reference-fit facts for the Mac module. */
export const MAC_CRADLE_FACTS: Record<string, unknown> = {
    frame: FRAME_NOTE,
    cradle: {
        rack_ear_mm: { width: 166.8, y: [-3.0, 0.0], z: [0.0, 75.0] },
        front_face_marking_mm: {
            proud: 0.4,
            x: [-50.8, -44.0],
            z: [2.0, 4.8],
            note: "raised marking only; not a mating feature",
        },
        body_half_width_mm: 73.0,
        side_slides_mm: { half_width: 77.0, y: [0.0, 143.0], z: [0.0, 8.0] },
        overall_mm: { x: [-83.4, 83.4], y: [-3.4, 143.0], z: [0.0, 75.0] },
        front_block_depth_mm: 9.1,
    },
    pocket: {
        x_mm: [-63.9, 63.9],
        y_mm: [6.1, 133.9],
        clear_mm: [127.8, 127.8],
        wall_top_z_mm: 67.83,
        straight_wall_y_mm: [35.3, 104.3],
        corner_profile:
            "rounded, not a single arc; least-squares circle r=26.1-26.4 with 0.19 residual",
    },
    device_support: {
        ledge_top_z_mm: 9.5,
        through_opening_mm: { x: [-59.775, 59.725], y: [10.225, 129.725] },
        ledge_width_mm: 4.15,
    },
    lid_interface: {
        rebate_ledge_z_mm: 72.6,
        rebate_opening_mm: { x: [-67.1, 67.1], y_front: 2.9 },
        lid_seated_mm: { x: [-66.95, 66.95], y: [3.05, 143.0], z: [63.2, 75.0] },
        clearance_per_side_mm: 0.15,
        rear:
            "lid rear edge finishes flush with the cradle rear face; the rebate is " +
            "open rearward, so only the front wall locates the lid in Y",
        apple_logo: "embossed on the lid +Z face, which fixes which way up it goes",
    },
    handle_interface: {
        socket_centres_mm: { x: [-67.6, 67.6], z: [10.2, 64.8] },
        socket_bore_mm: 4.79,
        socket_depth_mm: 6.0,
        arm_bar_mm: { round_section: 4.59, flat_to_round: 3.926, pitch: 54.6 },
        seated_mm: { x_outer: 69.899, y: [-19.2958, 3.0], z: [7.904, 67.096] },
        front_projection_mm: 16.3,
        handedness:
            "both handles are the same mesh under proper rotations; the left is " +
            "the right turned 180 deg about the arm axis, so no mirrored copy is needed",
        unresolved:
            "the sockets are circular, so the source does not constrain roll " +
            "about the arm axis; flats are placed inboard by symmetry, which only decides " +
            "which face shows and shifts each handle 0.336 laterally",
    },
    mac_reference: {
        box_mm: [127.0, 127.0, 50.0],
        basis: "published overall size only",
        seated_mm: { x: [-63.5, 63.5], y: [6.5, 133.5], z: [9.5, 59.5] },
        clearance_per_side_mm: 0.4,
        headroom_above_mm: 8.3,
        sharp_box_overlap_mm3: 23831.7,
        sharp_box_overlap:
            "four corner lunes, 23.7 x 23.2 in plan over the full 50 " +
            "height, 22.84 deep on the diagonal; this is the square box against the rounded " +
            "pocket corner, not a measured interference",
        min_corner_radius_to_clear_mm: 24.16,
        advice:
            "treat a square 127 x 127 box as a conservative keepout and report the " +
            "corner overlap as unresolved reference-envelope overlap. The machine's own corner " +
            "radius is not published, so no rounded reference can be built without inventing " +
            "it; the measured pocket clears any 127 x 127 footprint whose corner radius is at " +
            "least 24.16",
    },
    port_access: {
        front_openings_mm: [
            { x: [-47.1, -12.1], z: [15.7, 35.7] },
            { x: [12.1, 47.1], z: [15.7, 35.7] },
        ],
        vent_pattern: "staggered round perforations across the rest of the front block",
        rear:
            "the pocket is open rearward above the ledge except for the two corner " +
            "posts, so cable exit is unobstructed",
        note: "openings are source features; no machine port positions are claimed",
    },
};

/** Tray geometry and the reference-pair fit for the OWC 1U shelf. */
export const OWC_SHELF_FACTS: Record<string, unknown> = {
    frame: FRAME_NOTE,
    shelf: {
        rack_ear_mm: { width: 166.8, y: [-3.0, 0.0], z: [0.0, 25.0] },
        overall_mm: { x: [-83.4, 83.4], y: [-10.9648, 135.4], z: [0.0, 25.0] },
        side_slides_mm: { half_width: 77.0, z: [0.0, 8.0] },
        body_half_width_mm: 73.0,
        pull_tabs_mm: { x_outer: 79.0, y: [-10.9648, -3.0], z: [0.0, 25.0] },
        single_body: "tray, ear and tabs are one connected solid",
    },
    bay: {
        x_mm: [-71.5, 71.5],
        y_mm: [0.0, 132.4],
        floor_top_z_mm: 1.8,
        floor_thickness_mm: 1.8,
        wall_top_z_mm: 13.35,
        open_top: true,
        divider:
            "none; one open bay, so nothing in the source separates the two devices " +
            "or locates them in X beyond the side walls",
        floor_vents_mm: [
            { x: [-61.23, -11.48], y: [30.66, 109.41] },
            { x: [10.27, 60.02], y: [30.66, 109.41] },
        ],
        floor_vent_note:
            "the two 50 x 79 vents sit 0.6 off the bay centreline; they are " +
            "vents, not locating features, so the reference pair is centred on the walls",
    },
    owc_reference: {
        box_mm: [71.1, 132.0, 22.8],
        basis: "published overall size only",
        count: 2,
        seated_mm: [
            { x: [-71.1, 0.0], y: [0.0, 132.0], z: [1.8, 24.6] },
            { x: [0.0, 71.1], y: [0.0, 132.0], z: [1.8, 24.6] },
        ],
        clearance_mm: {
            outboard_per_side: 0.4,
            depth: 0.4,
            above: 0.4,
            between_boxes: 0.0,
        },
        square_box_overlap_mm3: 0.0,
        verdict:
            "the published whole-box envelopes clear the source solid, with 0.4 " +
            "at each side wall, 0.4 total depth allowance and 0.4 below the nominal 1U ceiling; " +
            "the front faces contact the stop and the two boxes meet at the centreline",
        unresolved:
            "the pair is centred on the side walls because the source has no " +
            "divider; the boxes touch each other at X=0, which is a reference-envelope contact, " +
            "not a measured interference. No purchase or ownership of these devices is implied",
    },
};
