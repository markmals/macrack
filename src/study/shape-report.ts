import type { Shape } from "@roonieone/caddy";

import type { Vector3 } from "../mesh/affine.ts";

import { round } from "../rounding.ts";

export type Bounds = readonly [Vector3, Vector3];

export interface BboxReport {
    readonly min: number[];
    readonly max: number[];
    readonly size: number[];
    readonly volume_mm3: number;
}

export interface ShapeReport {
    readonly is_valid: boolean;
    readonly solid_count: number;
    readonly volume_mm3: number;
    readonly bbox: BboxReport;
}

/** Every reported measurement is rounded to 1e-6 mm; the values compared against are not. */
export function rounded(value: number): number {
    return round(value, 6);
}

/** Full-precision (min, max) corners; report values are rounded, these are not. */
export function shapeBounds(shape: Shape): Bounds {
    let box = shape.boundingBox;
    return [box.min.toTuple(), box.max.toTuple()];
}

export function bboxReport(bounds: Bounds): BboxReport {
    let [low, high] = bounds;
    let size: Vector3 = [high[0] - low[0], high[1] - low[1], high[2] - low[2]];
    return {
        min: low.map(rounded),
        max: high.map(rounded),
        size: size.map(rounded),
        volume_mm3: rounded(size[0] * size[1] * size[2]),
    };
}

/** Measured facts about one shape: CAD validity, solid count, volume, bounding box. */
export function inspectShape(shape: Shape): ShapeReport {
    return {
        is_valid: shape.isValid,
        solid_count: shape.solids.length,
        volume_mm3: rounded(shape.volume),
        bbox: bboxReport(shapeBounds(shape)),
    };
}

export function boundsAreFinite(bounds: Bounds): boolean {
    let [low, high] = bounds;
    return [0, 1, 2].every(
        axis =>
            Number.isFinite(low[axis]) && Number.isFinite(high[axis]) && high[axis]! > low[axis]!,
    );
}

/**
 * True when the two bounding boxes share volume; touching faces are not overlap.
 *
 * Exact corner values only: a rounded comparison would discard a submicron overlap that still
 * exceeds the collision tolerance over a rack-sized face.
 */
export function boundsOverlap(a: Bounds, b: Bounds): boolean {
    return [0, 1, 2].every(axis => a[0][axis]! < b[1][axis]! && b[0][axis]! < a[1][axis]!);
}

/** The bounding box of several placed shapes, or null when there are none. */
export function envelopeReport(bounds: readonly Bounds[]): BboxReport | null {
    if (bounds.length === 0) return null;
    let axes: Vector3 = [0, 1, 2];
    let low = axes.map(axis => Math.min(...bounds.map(item => item[0][axis]!))) as Vector3;
    let high = axes.map(axis => Math.max(...bounds.map(item => item[1][axis]!))) as Vector3;
    return bboxReport([low, high]);
}
