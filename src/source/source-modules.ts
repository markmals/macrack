import type { Matrix4, Rotation, Vector3 } from "../mesh/affine.ts";
import type { SourcePlacement, SourceProfile } from "./source-profile.ts";

import { MacrackError } from "../errors.ts";
import { affine } from "../mesh/affine.ts";
import { round } from "../rounding.ts";
import { MAC_CRADLE_FACTS, OWC_SHELF_FACTS } from "./source-module-facts.ts";
import { sourcePlacement } from "./source-profile.ts";

export const MAC_CASE = "M4 Mac Mini case.stl";
export const MAC_LID = "Mac Mini Pro Rack Lid";
export const MAC_HANDLE = "Mac Mini Handle";
export const OWC_SHELF = "1M2 Vented.stl";

interface Fingerprint {
    readonly min: Vector3;
    readonly max: Vector3;
    readonly faces: number;
}

// Authored bounds and triangle count of each source mesh; a mismatch means the 3MF changed and
// every measured transform below has to be re-derived before it is trusted again.
const SOURCE_FINGERPRINTS: Record<string, Fingerprint> = {
    [MAC_CASE]: { min: [-83.4, -73.2, -37.5], max: [83.4, 73.2, 37.5], faces: 39642 },
    [MAC_LID]: { min: [-66.95, -69.975, -5.9], max: [66.95, 69.975, 5.9], faces: 1764 },
    [MAC_HANDLE]: {
        min: [-29.5958, -1.9632, -11.1479],
        max: [29.5958, 1.9632, 11.1479],
        faces: 2332,
    },
    [OWC_SHELF]: { min: [-83.4, -12.5, -73.1824], max: [83.4, 12.5, 73.1824], faces: 2276 },
};

// --- Mac cradle (object 17), measured in its own mesh coordinates ---

/** Rack ear plate: the only material wider than +/-77, 3.000 thick. */
const MAC_FLANGE_FRONT_Y = -72.8;
/** Underside of the +/-77 side slides, which run the full 143.0 body depth. */
const MAC_FLOOR_Z = -37.5;
/** Top of the ledge the Mac rests on, 4.15 wide around a 119.5 x 119.5 through opening. */
const MAC_SHELF_Z = -28.0;
/** Pocket walls, 127.800 apart in both axes but centred on y = +0.2, not on the mesh centre. */
const MAC_POCKET_Y: [number, number] = [-63.7, 64.1];
/** Ledge the lid skin lands on. */
const MAC_LID_LEDGE_Z = 35.1;
// Handle sockets: four blind 4.79 bores, 6.000 deep, in the 9.1 thick front block.
const MAC_SOCKET_X = 67.6;
const MAC_SOCKET_FLOOR_Y = -66.8;

// --- Mac lid (object 24) ---

/** Underside of the lid skin; the 2.400 skin seats on the cradle rebate ledge. */
const LID_SKIN_UNDER_Z = 3.5;
/** Rear edge, which finishes flush with the cradle rear face. */
const LID_REAR_Y = 69.975;

// --- Mac handle (objects 20 and 22, one shared mesh) ---

// Arm bar is a 4.59 round section flattened to 3.926 on one side, so the bar axis sits 0.336
// off the mesh centre plane: aligning mesh centres instead of bar axes jams the arm in the bore.
const HANDLE_ARM_AXIS_Y = -0.336;
/** Flat tip of both arms; it bottoms out on the socket floor. */
const HANDLE_ARM_TIP_Z = 11.1479;

// --- OWC 1U shelf (object 8) ---

const OWC_FLANGE_FRONT_Z = -65.2176;
const OWC_FLOOR_UNDERSIDE_Y = -12.5;
// Clear tray front, against the flange, and the floor top the devices stand on.
const OWC_BAY_FRONT_Z = -62.2176;
const OWC_BAY_FLOOR_TOP_Y = -10.7;

// --- canonical-frame placements ---

/** Flange front face -> Y = -3, slide underside -> Z = 0. */
const MAC_TO_CANONICAL: Vector3 = [0.0, -3.0 - MAC_FLANGE_FRONT_Y, -MAC_FLOOR_Z];
// Skin underside -> cradle rebate ledge, rear edge -> cradle rear face at canonical Y = 143.0.
const LID_TO_CANONICAL: Vector3 = [
    0.0,
    143.0 - LID_REAR_Y,
    MAC_TO_CANONICAL[2] + MAC_LID_LEDGE_Z - LID_SKIN_UNDER_Z,
];
/** Local +x -> canonical +z, +y -> +x, +z -> +y: a 120 deg rotation about (1,1,1). */
const HANDLE_RIGHT_ROTATION: Rotation = [
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 0],
];
// Same part turned 180 deg about the arm axis; the bail is mirror-symmetric across its own
// plane, so the left handle needs no reflection, only this rotation.
const HANDLE_LEFT_ROTATION: Rotation = [
    [0, -1, 0],
    [0, 0, 1],
    [-1, 0, 0],
];
/** The arm pitch equals the socket pitch (54.6), so the bail needs no vertical offset. */
const HANDLE_TO_CANONICAL: Vector3 = [
    MAC_SOCKET_X - HANDLE_ARM_AXIS_Y,
    MAC_TO_CANONICAL[1] + MAC_SOCKET_FLOOR_Y - HANDLE_ARM_TIP_Z,
    MAC_TO_CANONICAL[2],
];
// Local +y -> canonical +z and +z -> +y; +x must map to -x or the matrix is a reflection, which
// FreeCAD's Placement cannot carry. This is a 180 deg rotation about (0,1,1).
const OWC_ROTATION: Rotation = [
    [-1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
];
const OWC_TO_CANONICAL: Vector3 = [0.0, -3.0 - OWC_FLANGE_FRONT_Z, -OWC_FLOOR_UNDERSIDE_Y];

// --- reference-device seats, measured from the pockets that receive them ---

/** Mac: centred in the 127.800 pocket and standing on the ledge, which leaves 0.400 per side. */
const MAC_REFERENCE_SEAT: Vector3 = [
    0.0,
    MAC_TO_CANONICAL[1] + (MAC_POCKET_Y[0] + MAC_POCKET_Y[1]) / 2 - 63.5,
    MAC_TO_CANONICAL[2] + MAC_SHELF_Z,
];
// The source has no divider: the reference boxes meet at the centreline and front stop.
// The published pair leaves 0.400 mm at each side wall and at the rear.
const OWC_REFERENCE_HALF_PITCH = 35.55;
const OWC_REFERENCE_SEAT: [number, number] = [
    OWC_TO_CANONICAL[1] + OWC_BAY_FRONT_Z,
    OWC_TO_CANONICAL[2] + OWC_BAY_FLOOR_TOP_Y,
];

function seat(x: number, y: number, z: number): Vector3 {
    // Rounded to 1 nm: the measured features carry four decimals, and raw float sums otherwise
    // reach reports as 1.8000000000000007.
    return [round(x, 6), round(y, 6), round(z, 6)];
}

function intoFrame(
    rotation: Rotation | null,
    canonical: Vector3,
    z: number,
    moduleY: number,
): Matrix4 {
    return affine(rotation, [canonical[0], canonical[1] + moduleY, canonical[2] + z]);
}

/** Object ids for `name`, after asserting the mesh still matches what was measured. */
function checked(
    profile: SourceProfile,
    name: string,
    options: { readonly instances?: number } = {},
): number[] {
    let { instances = 1 } = options;
    let expected = SOURCE_FINGERPRINTS[name]!;
    profile.requireObject(name, { instances });
    let expectedBounds = [...expected.min, ...expected.max];
    let ids = profile.objectsNamed(name);
    for (let objectId of ids) {
        let mesh = profile.mesh(objectId);
        let measured = [...mesh.bounds[0], ...mesh.bounds[1]];
        let drift = Math.max(
            ...measured.map((actual, index) => Math.abs(actual - expectedBounds[index]!)),
        );
        // The authored coordinates are not exact decimals; 1 um is far below any feature here.
        if (drift > 1e-3) {
            throw new MacrackError(
                `${name} (object ${objectId}): bounds moved by ${drift} mm; ` +
                    "remeasure the mating features before placing it",
            );
        }
        if (mesh.faceCount !== expected.faces) {
            throw new MacrackError(
                `${name} (object ${objectId}): ${mesh.faceCount} faces, expected ` +
                    `${expected.faces}; remeasure the mating features before placing it`,
            );
        }
    }
    return ids;
}

/** Cradle, lid and both handles, seated on each other's measured mating features. */
export function macPlacements(
    profile: SourceProfile,
    z: number,
    moduleY: number,
): SourcePlacement[] {
    let cradle = checked(profile, MAC_CASE)[0]!;
    let lid = checked(profile, MAC_LID)[0]!;
    let [rightHandle, leftHandle] = checked(profile, MAC_HANDLE, { instances: 2 });
    return [
        sourcePlacement(
            "mac_cradle",
            cradle,
            intoFrame(null, MAC_TO_CANONICAL, z, moduleY),
            "rack ear front face on Y=-3, side slides on Z=0..8 over the full 143.0 body depth",
        ),
        sourcePlacement(
            "mac_lid",
            lid,
            intoFrame(null, LID_TO_CANONICAL, z, moduleY),
            "skin underside on the cradle rebate ledge, rear edge flush with the cradle rear; " +
                "lid top lands on Z=75.0 and the rebate leaves 0.15 per side",
        ),
        sourcePlacement(
            "mac_handle_right",
            rightHandle!,
            intoFrame(HANDLE_RIGHT_ROTATION, HANDLE_TO_CANONICAL, z, moduleY),
            "bail arms bottomed in the two right blind sockets; bar axis on the bore axis",
        ),
        sourcePlacement(
            "mac_handle_left",
            leftHandle!,
            intoFrame(
                HANDLE_LEFT_ROTATION,
                [-HANDLE_TO_CANONICAL[0], HANDLE_TO_CANONICAL[1], HANDLE_TO_CANONICAL[2]],
                z,
                moduleY,
            ),
            "same part rotated 180 deg about the arm axis, not mirrored; flats face inboard, " +
                "which the circular sockets do not constrain",
        ),
    ];
}

/** The 1U SSD shelf, flange front face on Y=-3 and tray floor underside on Z=0. */
export function owcPlacement(profile: SourceProfile, z: number, moduleY: number): SourcePlacement {
    let shelf = checked(profile, OWC_SHELF)[0]!;
    return sourcePlacement(
        "owc_shelf",
        shelf,
        intoFrame(OWC_ROTATION, OWC_TO_CANONICAL, z, moduleY),
        "rack ear front face on Y=-3, side slides on Z=0..8; the two pull tabs reach Y=-10.96",
    );
}

/**
 * Seat for a 127 x 127 x 50 Mac reference box: (x centre, y of front face, z of underside).
 *
 * Centred in the measured pocket and standing on the measured ledge. The 127 x 127 x 50
 * figure is the published overall size only; nothing here asserts that a real machine fits.
 */
export function macReferenceOrigin(profile: SourceProfile, z: number, moduleY: number): Vector3 {
    checked(profile, MAC_CASE);
    return seat(MAC_REFERENCE_SEAT[0], MAC_REFERENCE_SEAT[1] + moduleY, MAC_REFERENCE_SEAT[2] + z);
}

/** Seats for the two 71.1 x 132 x 22.8 reference boxes, left bay first. */
export function owcReferenceOrigins(profile: SourceProfile, z: number, moduleY: number): Vector3[] {
    checked(profile, OWC_SHELF);
    return [-1.0, 1.0].map(sign =>
        seat(
            sign * OWC_REFERENCE_HALF_PITCH,
            OWC_REFERENCE_SEAT[0] + moduleY,
            OWC_REFERENCE_SEAT[1] + z,
        ),
    );
}

/** Mating features and reference-fit facts for the Mac module, in canonical module mm. */
export function macCradleMeasurements(profile: SourceProfile): Record<string, unknown> {
    checked(profile, MAC_CASE);
    checked(profile, MAC_LID);
    checked(profile, MAC_HANDLE, { instances: 2 });
    return MAC_CRADLE_FACTS;
}

/** Tray geometry and the reference-pair fit for the OWC 1U shelf, in canonical module mm. */
export function owcShelfMeasurements(profile: SourceProfile): Record<string, unknown> {
    checked(profile, OWC_SHELF);
    return OWC_SHELF_FACTS;
}
