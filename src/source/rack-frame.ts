import type { Matrix4, Rotation, Vector3 } from "../mesh/affine.ts";
import type { TriangleMesh } from "../mesh/triangle-mesh.ts";
import type { PanelMeasurement, RailMeasurement } from "./frame-measurement.ts";
import type { FrameMeasurements, RailSpec } from "./frame-report.ts";
import type { SourcePlacement, SourceProfile } from "./source-profile.ts";

import { FRONT_DEPTH } from "../carriers/rack-interface.ts";
import { MacrackError } from "../errors.ts";
import { affine, determinant, entry } from "../mesh/affine.ts";
import { round } from "../rounding.ts";
import {
    allClose,
    ceilingFacts,
    requireCentred,
    requireClosedFrame,
    requireEarClearance,
    requireSlotsAboveBase,
    ribFacts,
    seatGrid,
    uniformFloor,
} from "./frame-checks.ts";
import { GROUND_Z, measurePanel, measureRail, numberList } from "./frame-measurement.ts";
import { frameMeasurements } from "./frame-report.ts";
import { sourcePlacement } from "./source-profile.ts";

export type { FrameMeasurements, RailSpec } from "./frame-report.ts";

export const BASE_NAME = "Rack Base";
export const TOP_NAME = "Rack Lid with Logo";

const BASE_EXTENTS: Vector3 = [175.0, 10.0, 172.6];
const TOP_EXTENTS: Vector3 = [150.0, 10.0, 172.6];

export const RAIL_SIZES: Record<string, RailSpec> = {
    full: { name: "Rail", instances: 6, extents: [25.0, 254.0, 10.0], slots: 10 },
    short: { name: "Rail - Short.stl", instances: 6, extents: [25.0, 177.8, 10.0], slots: 7 },
};

// Local axes of the source parts expressed in assembly axes (rows map local -> assembly).
// Panels are authored lying down with their 10 mm thickness on local Y; the base keeps that
// face up, the top panel is turned over onto the rail ends.
export const BASE_ROTATION: Rotation = [
    [0.0, 0.0, -1.0],
    [-1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
];
// Yaw chosen from the engraved logo: its leaf points along local -X and its bite faces local
// +Z, so this puts the leaf toward the rack rear and the bite to the right.
export const TOP_ROTATION: Rotation = [
    [0.0, 0.0, 1.0],
    [-1.0, 0.0, 0.0],
    [0.0, -1.0, 0.0],
];
// Rails stand on their local +Y axis; the slotted local -Z face has to turn inward, which is a
// 180 degree yaw between the two sides - a rotation, never a mirror.
export const RAIL_ROTATION_RIGHT: Rotation = [
    [0.0, 0.0, 1.0],
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
];
export const RAIL_ROTATION_LEFT: Rotation = [
    [0.0, 0.0, -1.0],
    [-1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
];

const DEPTH_LABELS = ["front", "mid", "rear"];

export interface FrameLayout {
    readonly placements: SourcePlacement[];
    /** Assembly Z of each rail slot floor: where a module's canonical Z=0 lands. */
    readonly slotOrigins: number[];
    /** What a canonical template's Y must be shifted by. */
    readonly moduleY: number;
    readonly measurements: FrameMeasurements;
}

interface FrameMeshes {
    readonly base: TriangleMesh;
    readonly top: TriangleMesh;
    readonly rail: TriangleMesh;
}

interface FrameParts {
    readonly ids: { readonly base: number; readonly top: number; readonly rail: number };
    readonly meshes: FrameMeshes;
}

function placementMatrix(rotation: Rotation, translation: Vector3): Matrix4 {
    let matrix = affine(rotation, translation);
    if (Math.abs(determinant(matrix) - 1.0) > 1e-9) {
        throw new MacrackError(
            `placement rotation is not a proper rotation:\n${rotation.map(numberList).join("\n")}`,
        );
    }
    return matrix;
}

function frameParts(profile: SourceProfile, spec: RailSpec): FrameParts {
    let ids = {
        base: profile.requireObject(BASE_NAME, { instances: 1 }),
        top: profile.requireObject(TOP_NAME, { instances: 1 }),
        rail: profile.requireObject(spec.name, { instances: spec.instances }),
    };
    let meshes = {
        base: profile.mesh(ids.base),
        top: profile.mesh(ids.top),
        rail: profile.mesh(ids.rail),
    };
    let checks: [TriangleMesh, string, readonly number[]][] = [
        [meshes.base, BASE_NAME, BASE_EXTENTS],
        [meshes.top, TOP_NAME, TOP_EXTENTS],
        [meshes.rail, spec.name, spec.extents],
    ];
    for (let [mesh, label, expected] of checks) {
        if (!allClose(mesh.extents, expected)) {
            throw new MacrackError(
                `${label}: source bounds changed, measured ` +
                    `${numberList(mesh.extents.map(value => round(value, 4)))} mm against ` +
                    `${numberList(expected)}; remeasure the frame before placing it`,
            );
        }
        if (!mesh.isWatertight) {
            throw new MacrackError(`${label}: source mesh is not watertight; refusing to place it`);
        }
    }
    return { ids, meshes };
}

function frameFeatures(
    meshes: FrameMeshes,
    spec: RailSpec,
): { rail: RailMeasurement; panels: { base: PanelMeasurement; top: PanelMeasurement } } {
    let rail = measureRail(meshes.rail, spec.name);
    if (rail.slotFloors.length !== spec.slots) {
        throw new MacrackError(
            `${spec.name}: measured ${rail.slotFloors.length} slots, expected ${spec.slots}`,
        );
    }
    let panels = {
        base: measurePanel(meshes.base, BASE_NAME, rail.section),
        top: measurePanel(meshes.top, TOP_NAME, rail.section),
    };
    for (let [label, panel] of [
        [BASE_NAME, panels.base],
        [TOP_NAME, panels.top],
    ] as const) {
        if (panel.sockets.length !== 6) {
            throw new MacrackError(
                `${label}: measured ${panel.sockets.length} rail sockets, expected 6`,
            );
        }
    }
    for (let axis of [0, 2]) {
        requireCentred(
            [meshes.base.bounds[0][axis]!, meshes.base.bounds[1][axis]!],
            axis,
            BASE_NAME,
        );
        requireCentred([meshes.top.bounds[0][axis]!, meshes.top.bounds[1][axis]!], axis, TOP_NAME);
    }
    return { rail, panels };
}

/** Base on the ground datum, rails standing in its sockets. */
function frameDatum(meshes: FrameMeshes, base: PanelMeasurement) {
    let transform = placementMatrix(BASE_ROTATION, [0, 0, GROUND_Z - meshes.base.bounds[0][1]]);
    let socketFloorZ = uniformFloor(base.sockets, BASE_NAME) + entry(transform, 2, 3);
    let railZ0 = socketFloorZ - meshes.rail.bounds[0][1];
    return {
        transform,
        socketFloorZ,
        railZ0,
        railTopZ: railZ0 + meshes.rail.bounds[1][1],
        baseTopZ: meshes.base.bounds[1][1] + entry(transform, 2, 3),
    };
}

function railPlacements(
    railId: number,
    grid: { sides: number[]; depths: number[] },
    railZ0: number,
    railSize: string,
): SourcePlacement[] {
    let placements: SourcePlacement[] = [];
    for (let sideX of grid.sides) {
        let rotation = sideX > 0 ? RAIL_ROTATION_RIGHT : RAIL_ROTATION_LEFT;
        for (let [index, label] of DEPTH_LABELS.entries()) {
            placements.push(
                sourcePlacement(
                    `rail_${sideX > 0 ? "right" : "left"}_${label}`,
                    railId,
                    placementMatrix(rotation, [sideX, grid.depths[index]!, railZ0]),
                    `${railSize} rail seated in its base socket, slotted face inward`,
                ),
            );
        }
    }
    return placements;
}

/**
 * Place the original frame on the ground datum and read its slot table off the rails.
 *
 * Canonical assembly axes, millimetres: +X right (seen from the front), +Y rear, +Z up,
 * Z=0 at the base underside (the surface the rack stands on).
 */
export function buildFrame(profile: SourceProfile, railSize = "full"): FrameLayout {
    let spec = RAIL_SIZES[railSize];
    if (spec === undefined) {
        let known = Object.keys(RAIL_SIZES)
            .sort()
            .map(name => `'${name}'`);
        throw new MacrackError(`rail_size must be one of [${known.join(", ")}], got '${railSize}'`);
    }
    let { ids, meshes } = frameParts(profile, spec);
    let { panels, rail } = frameFeatures(meshes, spec);
    let datum = frameDatum(meshes, panels.base);
    let grid = seatGrid(panels.base.sockets, BASE_ROTATION, BASE_NAME);
    let placements = [
        sourcePlacement(
            "rack_base",
            ids.base,
            datum.transform,
            "frame datum: underside on the ground plane",
        ),
        ...railPlacements(ids.rail, grid, datum.railZ0, railSize),
    ];

    // Top: turned over, its sockets bottoming on the rail ends.
    let topFloor = uniformFloor(panels.top.sockets, TOP_NAME);
    let topTransform = placementMatrix(TOP_ROTATION, [0, 0, datum.railTopZ + topFloor]);
    placements.push(
        sourcePlacement(
            "rack_top",
            ids.top,
            topTransform,
            "inverted onto the rail ends; engraved logo upward",
        ),
    );
    requireClosedFrame(panels.top.sockets, grid.seats, TOP_ROTATION, TOP_NAME);

    let slotOrigins = rail.slotFloors.map(floor => round(floor + datum.railZ0, 4));
    requireSlotsAboveBase(slotOrigins, datum.baseTopZ);
    let moduleY = Math.min(
        ...panels.base.sockets.flatMap(socket =>
            socket.depth.map(edge => BASE_ROTATION[1][0] * edge),
        ),
    );
    requireEarClearance(moduleY, FRONT_DEPTH, TOP_ROTATION[1][0] * meshes.top.bounds[1][0]);
    return {
        placements,
        slotOrigins,
        moduleY,
        measurements: frameMeasurements({
            sourceSha256: profile.sha256,
            railSize,
            spec,
            ids,
            meshes,
            panels,
            rail,
            transforms: { base: datum.transform, top: topTransform },
            seats: { sides: grid.sides, depths: grid.depths },
            heights: datum,
            slotOrigins,
            moduleY,
            ceiling: ceilingFacts(panels.top, topTransform, TOP_NAME),
            ribs: ribFacts(panels.base, datum.transform, BASE_ROTATION, BASE_NAME),
        }),
    };
}
