import { join } from "node:path";

import type { RackGeometry, RackManifest } from "./rack-manifest.ts";

import { MacrackError } from "../errors.ts";
import { checkCamera } from "./camera.ts";
import { VIEWS } from "./rack-job.ts";
import { stepName } from "./rack-manifest.ts";

export interface ShapeFacts {
    readonly valid: boolean;
    readonly solids: number;
    readonly volume_mm3: number;
    readonly bounds_mm: readonly (readonly number[])[];
}

export interface RackFacts {
    readonly shapes: Readonly<Record<string, ShapeFacts>>;
    readonly assembly: ShapeFacts;
    readonly components: number;
    readonly views: Readonly<Record<string, readonly number[]>>;
}

export interface ShapeReport extends ShapeFacts {
    readonly max_bound_difference_mm: number;
    readonly relative_volume_difference: number;
}

export type RackReport = Record<string, ShapeReport | Record<string, number[]>>;

function bound(bounds: readonly (readonly number[])[], side: number, axis: number): number {
    let value = bounds[side]?.[axis];
    if (value === undefined) throw new MacrackError("Rack bounds are not a min/max box");
    return value;
}

function measured(facts: RackFacts, key: string): ShapeFacts {
    let shape = facts.shapes[key];
    if (shape === undefined) throw new MacrackError(`FreeCAD measured no geometry for ${key}`);
    return shape;
}

/** The conversion check from load_shape: a mesh becomes exactly one healthy solid, or nothing. */
function checkSolid(facts: ShapeFacts, path: string): void {
    if (!facts.valid || facts.solids !== 1 || facts.volume_mm3 <= 0) {
        throw new MacrackError(`${path}: conversion did not produce a valid single solid`);
    }
}

function verifyShape(facts: ShapeFacts, expected: RackGeometry, name: string): ShapeReport {
    if (!facts.valid || facts.volume_mm3 <= 0) {
        throw new MacrackError(`${name}: FreeCAD imported invalid or non-positive geometry`);
    }
    let difference = 0;
    for (let side = 0; side < 2; side += 1) {
        for (let axis = 0; axis < 3; axis += 1) {
            let offset = bound(facts.bounds_mm, side, axis) - bound(expected.bounds_mm, side, axis);
            difference = Math.max(difference, Math.abs(offset));
        }
    }
    let volumeDifference = Math.abs(facts.volume_mm3 / expected.volume_mm3 - 1);
    if (difference > 0.001 || volumeDifference > 0.001) {
        throw new MacrackError(`${name}: FreeCAD geometry differs from the generated scene`);
    }
    return {
        valid: facts.valid,
        solids: facts.solids,
        volume_mm3: facts.volume_mm3,
        bounds_mm: facts.bounds_mm,
        max_bound_difference_mm: difference,
        relative_volume_difference: volumeDifference,
    };
}

function geometryReport(
    report: RackReport,
    facts: RackFacts,
    manifest: RackManifest,
    places: { root: string; staging: string },
): void {
    for (let [relative, expected] of Object.entries(manifest.geometry)) {
        let shape = measured(facts, relative);
        checkSolid(shape, join(places.root, relative));
        report[relative] = verifyShape(shape, expected, relative);
        if (!relative.endsWith(".stl")) continue;
        let key = stepName(relative);
        let path = join(places.staging, key);
        let converted = measured(facts, key);
        checkSolid(converted, path);
        report[key] = verifyShape(converted, expected, path);
    }
}

/**
 * Every measurement FreeCAD took, checked against the scene the rack build recorded. A STEP that
 * imports with different bounds, a different volume or fused solids is a failed export, not a
 * cosmetic difference.
 */
export function buildRackReport(
    manifest: RackManifest,
    facts: RackFacts,
    places: { root: string; staging: string },
): RackReport {
    let report: RackReport = {};
    geometryReport(report, facts, manifest, places);
    let components = manifest.validation.components;
    let expected = {
        bounds_mm: manifest.validation.bounds_mm,
        volume_mm3: components.reduce((total, item) => total + item.volume_mm3, 0),
    };
    report["rack.step"] = verifyShape(facts.assembly, expected, "rack.step");
    if (facts.assembly.solids !== facts.components) {
        throw new MacrackError("Full-rack STEP lost or combined component solids");
    }
    let views: Record<string, number[]> = {};
    for (let view of VIEWS) {
        views[view.name] = checkCamera(facts.views[view.name] ?? [], view.orientation, view.name);
    }
    report["views"] = views;
    return report;
}
