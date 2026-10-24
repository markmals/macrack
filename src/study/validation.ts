/**
 * Geometric checks over an artifact list.
 *
 * Interference here is an exact OpenCascade Boolean common volume between solids. It says
 * nothing about fit: tolerances, print shrinkage, fasteners, assembly order and every device
 * absent from the artifact list are outside this model.
 */

import type { Shape } from "@roonieone/caddy";

import type { Artifact, ArtifactKind } from "./artifact.ts";
import type { BboxReport, Bounds, ShapeReport } from "./shape-report.ts";

import { ARTIFACT_KINDS, placed } from "./artifact.ts";
import { general } from "./format.ts";
import {
    bboxReport,
    boundsAreFinite,
    boundsOverlap,
    envelopeReport,
    inspectShape,
    rounded,
    shapeBounds,
} from "./shape-report.ts";

export { inspectShape } from "./shape-report.ts";
export type { BboxReport, Bounds, ShapeReport } from "./shape-report.ts";

// Interference below this is treated as surface contact: coincident faces of two touching
// solids can report a sliver volume at OCC's ~1e-7 mm modelling tolerance.
export const COLLISION_VOLUME_TOL_MM3 = 1e-5;

export const KINDS = ARTIFACT_KINDS;
export const PHYSICAL_KINDS: readonly ArtifactKind[] = ["printable", "keepout"];

export const NOT_VALIDATED: readonly string[] = [
    "Rail/slide fit is unproven: the mating rail, frame and original cradle geometry are not modelled here.",
    "Wall thickness, minimum feature size, overhangs, orientation and bed fit are not checked.",
    "Structural load, drive mass, vibration, retention and rack stability are not modelled.",
    "Thermal and airflow behaviour is not modelled; a cooling reservation only reserves volume.",
    "Fastener engagement (heat-set inserts, M3 screws, drive screws) is not checked against real hardware.",
    "Clearance between solids is geometric only: no tolerance stack, press fit, cable bend radius or service access is evaluated.",
];

const ABSENT_HARDWARE_NOTE =
    "Interference checks cover only the solids listed in this report. Devices, enclosures, " +
    "bridges, hubs, cables, connectors, fasteners and power supplies that are not listed are " +
    "absent from the model and are therefore neither cleared nor validated.";

export interface ArtifactEntry {
    readonly name: string;
    readonly kind: ArtifactKind;
    readonly position: number[];
    readonly note: string;
    readonly is_valid: boolean;
    readonly solid_count: number;
    readonly volume_mm3: number;
    readonly local_bbox: BboxReport;
    readonly placed_bbox: BboxReport;
    readonly issues: string[];
}

export interface InterferencePair {
    readonly a: string;
    readonly b: string;
    readonly kinds: ArtifactKind[];
    readonly method: "boolean_common";
    readonly status: "contact" | "error" | "interference";
    readonly error?: string;
    readonly common_volume_mm3?: number;
}

export interface ValidationReport {
    readonly schema: "macrack.validation/1";
    readonly ok: boolean;
    readonly tolerances: { readonly collision_volume_mm3: number; readonly contact_allowed: true };
    readonly counts: Record<string, number>;
    readonly coverage: Record<string, readonly string[] | string>;
    readonly artifacts: ArtifactEntry[];
    readonly envelope: {
        readonly all: BboxReport | null;
        readonly physical: BboxReport | null;
        readonly printable: BboxReport | null;
    };
    readonly interference: {
        readonly pairs_evaluated: number;
        readonly pairs_skipped_disjoint_bbox: number;
        readonly pairs: InterferencePair[];
    };
    readonly not_validated: string[];
    readonly issues: string[];
}

function commonVolume(a: Shape, b: Shape): number {
    let common = a.intersect(b);
    return common === undefined ? 0 : common.volume;
}

interface Placement {
    readonly artifact: Artifact;
    readonly shape: Shape;
    readonly bounds: Bounds;
}

function artifactEntry(item: Artifact, placedBounds: Bounds, local: ShapeReport): ArtifactEntry {
    let issues: string[] = [];
    if (!KINDS.includes(item.kind)) {
        issues.push(`unknown kind '${item.kind}', expected one of ${KINDS.join(", ")}`);
    }
    if (!local.is_valid) issues.push("shape fails OpenCascade validity check");
    if (local.volume_mm3 <= 0) issues.push(`non-positive volume ${local.volume_mm3} mm^3`);
    if (item.kind === "printable" && local.solid_count !== 1) {
        issues.push(`printable part must be a single solid, found ${local.solid_count}`);
    } else if (local.solid_count < 1) {
        issues.push("shape contains no solid");
    }
    if (!boundsAreFinite(placedBounds)) issues.push("bounding box is not finite or is degenerate");
    return {
        name: item.name,
        kind: item.kind,
        position: item.position.map(rounded),
        note: item.note,
        is_valid: local.is_valid,
        solid_count: local.solid_count,
        volume_mm3: local.volume_mm3,
        local_bbox: local.bbox,
        placed_bbox: bboxReport(placedBounds),
        issues,
    };
}

function duplicateNameIssues(artifacts: readonly Artifact[]): string[] {
    let counts = new Map<string, number>();
    for (let item of artifacts) counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
    return [...counts]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .filter(([, count]) => count > 1)
        .map(([name, count]) => `${name}: duplicate artifact name used ${count} times`);
}

function interferencePair(a: Placement, b: Placement, issues: string[]): InterferencePair {
    let base = {
        a: a.artifact.name,
        b: b.artifact.name,
        kinds: [a.artifact.kind, b.artifact.kind],
        method: "boolean_common",
    } as const;
    let volume: number;
    try {
        volume = commonVolume(a.shape, b.shape);
    } catch (error) {
        let name = error instanceof Error ? error.name : "Error";
        let message = error instanceof Error ? error.message : String(error);
        issues.push(`${base.a} vs ${base.b}: Boolean common failed: ${message}`);
        return { ...base, kinds: [...base.kinds], status: "error", error: `${name}: ${message}` };
    }
    if (volume > COLLISION_VOLUME_TOL_MM3) {
        issues.push(
            `${base.a} vs ${base.b}: Boolean common volume ${general(volume)} mm^3 ` +
                `exceeds ${general(COLLISION_VOLUME_TOL_MM3)} mm^3`,
        );
    }
    return {
        ...base,
        kinds: [...base.kinds],
        common_volume_mm3: rounded(volume),
        status: volume > COLLISION_VOLUME_TOL_MM3 ? "interference" : "contact",
    };
}

/** Every printable/keepout pair, then each of those against every reservation. */
function candidatePairs(placements: readonly Placement[]): [Placement, Placement][] {
    let physical = placements.filter(item => PHYSICAL_KINDS.includes(item.artifact.kind));
    let reservations = placements.filter(item => item.artifact.kind === "reservation");
    let pairs: [Placement, Placement][] = [];
    for (let first = 0; first < physical.length; first += 1) {
        for (let second = first + 1; second < physical.length; second += 1) {
            pairs.push([physical[first]!, physical[second]!]);
        }
    }
    for (let item of physical) for (let other of reservations) pairs.push([item, other]);
    return pairs;
}

/**
 * Check every artifact and every interfering pair; return a JSON-serialisable report.
 *
 * Checks: declared kind, CAD validity, exactly one solid of positive volume for printables, a
 * finite non-degenerate bounding box, and the Boolean common volume of each placed pair
 * (printable/keepout against each other, and both against reservations; reservation pairs are
 * skipped because they may share space).
 *
 * Never raises on a geometric failure: `report.ok` is False and `report.issues` lists every
 * failure. Callers are expected to stop on `ok` being False.
 */
export function validateArtifacts(artifacts: readonly Artifact[]): ValidationReport {
    let issues: string[] = duplicateNameIssues(artifacts);
    let entries: ArtifactEntry[] = [];
    let placements: Placement[] = [];

    for (let item of artifacts) {
        let local = inspectShape(item.shape);
        let shape = placed(item);
        let bounds = shapeBounds(shape);
        let entry = artifactEntry(item, bounds, local);
        entries.push(entry);
        issues.push(...entry.issues.map(text => `${item.name}: ${text}`));
        placements.push({ artifact: item, shape, bounds });
    }

    let interferences: InterferencePair[] = [];
    let skipped = 0;
    for (let [a, b] of candidatePairs(placements)) {
        if (!boundsOverlap(a.bounds, b.bounds)) {
            skipped += 1;
            continue;
        }
        interferences.push(interferencePair(a, b, issues));
    }

    let byKind = Object.fromEntries(
        KINDS.map(kind => [kind, entries.filter(entry => entry.kind === kind).map(e => e.name)]),
    );
    let boundsByKind = Object.fromEntries(
        KINDS.map(kind => [
            kind,
            placements.filter(item => item.artifact.kind === kind).map(item => item.bounds),
        ]),
    );

    return {
        schema: "macrack.validation/1",
        ok: issues.length === 0,
        tolerances: { collision_volume_mm3: COLLISION_VOLUME_TOL_MM3, contact_allowed: true },
        counts: Object.fromEntries(KINDS.map(kind => [kind, byKind[kind]!.length])),
        coverage: { ...byKind, note: ABSENT_HARDWARE_NOTE },
        artifacts: entries,
        envelope: {
            all: envelopeReport(placements.map(item => item.bounds)),
            physical: envelopeReport([...boundsByKind["printable"]!, ...boundsByKind["keepout"]!]),
            printable: envelopeReport(boundsByKind["printable"]!),
        },
        interference: {
            pairs_evaluated: interferences.length,
            pairs_skipped_disjoint_bbox: skipped,
            pairs: interferences,
        },
        not_validated: [...NOT_VALIDATED],
        issues,
    };
}
