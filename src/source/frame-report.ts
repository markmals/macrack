import type { Matrix4 } from "../mesh/affine.ts";
import type { TriangleMesh } from "../mesh/triangle-mesh.ts";
import type { PanelMeasurement, RailMeasurement } from "./frame-measurement.ts";

import { BODY_HALF_WIDTH, FRONT_DEPTH, SLIDE_HALF_WIDTH, U } from "../carriers/rack-interface.ts";
import { entry } from "../mesh/affine.ts";
import { round } from "../rounding.ts";
import { FIT_TOL, GROUND_Z, pocketSize } from "./frame-measurement.ts";

export interface RailSpec {
    readonly name: string;
    readonly instances: number;
    readonly extents: readonly [number, number, number];
    readonly slots: number;
}

export interface BayCapacity {
    readonly start_slots: number;
    readonly lowest_floor_z: number | null;
    readonly highest_floor_z: number | null;
}

/** The frame's measured facts, in the JSON schema the manifests and FreeCAD scripts read. */
export interface FrameMeasurements {
    readonly source_sha256: string;
    readonly rail_size: string;
    readonly rail_object: {
        readonly name: string;
        readonly object_id: number;
        readonly instances: number;
    };
    readonly ground_z: number;
    readonly rack_outer: {
        readonly width_x: number;
        readonly depth_y: number;
        readonly height_z: number;
    };
    readonly base: {
        readonly object_id: number;
        readonly thickness_z: number;
        readonly top_face_z: number;
        readonly socket_floor_z: number;
        readonly socket_size_mm: number[];
        readonly socket_clearance_mm: number[];
        readonly base_cross_ribs_y: number[][];
        readonly base_rib_top_z: number;
        readonly base_rib_span_x: number[];
    };
    readonly rails: {
        readonly length_mm: number;
        readonly section_mm: number[];
        readonly seat_x: number[];
        readonly seat_y: number[];
        readonly bottom_z: number;
        readonly top_z: number;
        readonly inner_face_x: number;
        readonly slot_floor_x: number;
        readonly slot_pitch_mm: number;
        readonly slot_height_mm: number;
        readonly slot_depth_mm: number;
        readonly slot_count: number;
    };
    readonly top: {
        readonly object_id: number;
        readonly plate_underside_z: number;
        readonly usable_ceiling_z: number;
        readonly skirt_inner_half_width_x: number;
        readonly skirt_inner_half_depth_y: number;
    };
    readonly slot_origins_z: number[];
    readonly module_y: number;
    readonly usable_full_units: number;
    readonly bays: Record<string, BayCapacity>;
    readonly module_interface_clearance: {
        readonly body_half_width_mm: number;
        readonly slide_half_width_mm: number;
        readonly unit_height_mm: number;
        readonly ear_face_y: number;
    };
}

/** Everything `buildFrame` measured and placed, before it is written out as a report. */
export interface FrameFacts {
    readonly sourceSha256: string;
    readonly railSize: string;
    readonly spec: RailSpec;
    readonly ids: { readonly base: number; readonly top: number; readonly rail: number };
    readonly meshes: {
        readonly base: TriangleMesh;
        readonly top: TriangleMesh;
        readonly rail: TriangleMesh;
    };
    readonly panels: { readonly base: PanelMeasurement; readonly top: PanelMeasurement };
    readonly rail: RailMeasurement;
    readonly transforms: { readonly base: Matrix4; readonly top: Matrix4 };
    readonly seats: { readonly sides: number[]; readonly depths: number[] };
    readonly heights: {
        readonly railZ0: number;
        readonly railTopZ: number;
        readonly socketFloorZ: number;
        readonly baseTopZ: number;
    };
    readonly slotOrigins: number[];
    readonly moduleY: number;
    readonly ceiling: {
        readonly plateUndersideZ: number;
        readonly usableCeilingZ: number;
        readonly skirtHalfWidthX: number;
        readonly skirtHalfDepthY: number;
    };
    readonly ribs: {
        readonly topZ: number;
        readonly halfSpanX: number;
        readonly spansY: number[][];
    };
}

/** Slot positions a module of `units` can occupy without running into the lid skirt. */
function bayCapacity(slotOrigins: readonly number[], units: number, ceilingZ: number): BayCapacity {
    let usable = slotOrigins.filter(origin => origin + units * U <= ceilingZ + FIT_TOL);
    return {
        start_slots: usable.length,
        lowest_floor_z: usable[0] ?? null,
        highest_floor_z: usable.at(-1) ?? null,
    };
}

export function frameMeasurements(facts: FrameFacts): FrameMeasurements {
    let { ceiling, heights, meshes, panels, rail, ribs, seats, slotOrigins, spec } = facts;
    let socket = panels.base.sockets[0]!;
    let topZ = entry(facts.transforms.top, 2, 3);
    let innerFaceX = Math.abs(seats.sides[0]!) - rail.section[1] / 2;
    let slotFloorX = innerFaceX + rail.slotDepth;
    let bays: Record<string, BayCapacity> = {};
    for (let units of [1, 2, 3]) {
        bays[`${units}U`] = bayCapacity(slotOrigins, units, ceiling.usableCeilingZ);
    }
    return {
        source_sha256: facts.sourceSha256,
        rail_size: facts.railSize,
        rail_object: { name: spec.name, object_id: facts.ids.rail, instances: spec.instances },
        ground_z: GROUND_Z,
        rack_outer: {
            width_x: meshes.base.extents[2],
            depth_y: meshes.base.extents[0],
            height_z: round(topZ - meshes.top.bounds[0][1], 4),
        },
        base: {
            object_id: facts.ids.base,
            thickness_z: meshes.base.extents[1],
            top_face_z: heights.baseTopZ,
            socket_floor_z: heights.socketFloorZ,
            socket_size_mm: pocketSize(socket).map(value => round(value, 4)),
            socket_clearance_mm: pocketSize(socket).map((value, axis) =>
                round(value - rail.section[axis]!, 4),
            ),
            base_cross_ribs_y: ribs.spansY,
            base_rib_top_z: round(ribs.topZ, 4),
            base_rib_span_x: [-round(ribs.halfSpanX, 4), round(ribs.halfSpanX, 4)],
        },
        rails: {
            length_mm: round(rail.length, 4),
            section_mm: rail.section.map(value => round(value, 4)),
            seat_x: seats.sides,
            seat_y: seats.depths,
            bottom_z: round(heights.railZ0 + meshes.rail.bounds[0][1], 4),
            top_z: round(heights.railTopZ, 4),
            inner_face_x: round(innerFaceX, 4),
            slot_floor_x: round(slotFloorX, 4),
            slot_pitch_mm: round(rail.slotPitch, 4),
            slot_height_mm: round(rail.slotHeight, 4),
            slot_depth_mm: rail.slotDepth,
            slot_count: slotOrigins.length,
        },
        top: {
            object_id: facts.ids.top,
            plate_underside_z: round(ceiling.plateUndersideZ, 4),
            usable_ceiling_z: round(ceiling.usableCeilingZ, 4),
            skirt_inner_half_width_x: round(ceiling.skirtHalfWidthX, 4),
            skirt_inner_half_depth_y: round(ceiling.skirtHalfDepthY, 4),
        },
        slot_origins_z: [...slotOrigins],
        module_y: facts.moduleY,
        // Slot positions a full-height 1U module can occupy; fewer than slot_count, because
        // the top slots run into the lid skirt.
        usable_full_units: bays["1U"]!.start_slots,
        bays,
        module_interface_clearance: {
            body_half_width_mm: round(innerFaceX - BODY_HALF_WIDTH, 4),
            slide_half_width_mm: round(slotFloorX - SLIDE_HALF_WIDTH, 4),
            unit_height_mm: round(rail.slotPitch - U, 4),
            ear_face_y: round(facts.moduleY - FRONT_DEPTH, 4),
        },
    };
}
