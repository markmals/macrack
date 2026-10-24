import { Compound, Shape } from "@roonieone/caddy";
import { io } from "@roonieone/occt-native";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

import type { Artifact } from "./artifact.ts";
import type { BboxReport, ShapeReport } from "./shape-report.ts";
import type { ValidationReport } from "./validation.ts";

import { sha256Hex } from "../digest.ts";
import { STEP_TIMESTAMP } from "../step.ts";
import { ARTIFACT_KINDS, placed } from "./artifact.ts";
import { ExportError } from "./export-error.ts";
import { inside } from "./export-files.ts";
import { STEP_DIM_TOL_MM, STEP_VOLUME_REL_TOL, relDiff } from "./export-tolerances.ts";
import { exponential } from "./format.ts";
import { KIND_COLORS } from "./kind-colors.ts";
import { inspectShape } from "./shape-report.ts";

const ROOT_LABEL = "macrack_assembly";

const STEP_OPTIONS = {
    lengthUnitMeters: 0.001,
    writePCurves: true,
    precisionMode: 0,
    originatingSystem: "macrack",
    name: ROOT_LABEL,
    timestamp: STEP_TIMESTAMP,
} as const;

export type AssemblyRecord = {
    readonly file: "assembly.step";
    readonly sha256: string;
    readonly bytes: number;
    readonly labels: Record<string, string[]>;
    readonly is_valid: boolean;
    readonly solid_count: number;
    readonly volume_mm3: number;
    readonly bbox: BboxReport;
    readonly expected_envelope: BboxReport;
    readonly max_dimension_diff_mm: number;
    readonly volume_rel_diff: number;
    readonly status: "failed" | "ok";
    readonly issues: string[];
};

interface LabelledNode {
    readonly label: string;
    readonly children: readonly LabelledNode[];
}

interface AssemblyTree {
    readonly root: io.StepWriteNode;
    /** Every shape the native tree points at, kept alive until the STEP bytes exist. */
    readonly shapes: Shape[];
}

/** One group per artifact kind, labelled and coloured, under a single assembly root. */
function assemblyTree(artifacts: readonly Artifact[]): AssemblyTree {
    let shapes: Shape[] = [];
    let groupShapes: Shape[] = [];
    let groups: io.StepWriteNode[] = [];
    for (let kind of ARTIFACT_KINDS) {
        let members = artifacts.filter(item => item.kind === kind);
        if (members.length === 0) continue;
        let placedShapes = members.map(placed);
        let group = new Compound(placedShapes);
        shapes.push(...placedShapes, group);
        groupShapes.push(group);
        groups.push({
            shape: group.wrapped,
            label: kind,
            color: null,
            subShapeColors: "none",
            children: members.map((item, index) => ({
                shape: placedShapes[index]!.wrapped,
                label: item.name,
                color: Float64Array.from((item.shape.color ?? KIND_COLORS[kind]).toTuple()),
                subShapeColors: "solids" as const,
                children: [],
            })),
        });
    }
    let root = new Compound(groupShapes);
    shapes.push(root);
    return {
        root: {
            shape: root.wrapped,
            label: ROOT_LABEL,
            color: null,
            subShapeColors: "none",
            children: groups,
        },
        shapes,
    };
}

function labelMap(groups: readonly LabelledNode[]): Record<string, string[]> {
    return Object.fromEntries(
        groups.map(group => [group.label, group.children.map(child => child.label).sort()]),
    );
}

function expectedLabels(artifacts: readonly Artifact[]): Record<string, string[]> {
    let expected: Record<string, string[]> = {};
    for (let kind of ARTIFACT_KINDS) {
        let names = artifacts.filter(item => item.kind === kind).map(item => item.name);
        if (names.length > 0) expected[kind] = names.sort();
    }
    return expected;
}

function sameLabels(left: Record<string, string[]>, right: Record<string, string[]>): boolean {
    let keys = Object.keys(left);
    if (keys.length !== Object.keys(right).length) return false;
    return keys.every(key => {
        let other = right[key];
        return other !== undefined && left[key]!.join("\u0000") === other.join("\u0000");
    });
}

function assemblyIssues(
    measured: ShapeReport,
    labels: {
        readonly actual: Record<string, string[]>;
        readonly expected: Record<string, string[]>;
    },
    expectedSolids: number,
    diffs: { readonly volume: number; readonly dimension: number },
): string[] {
    let issues: string[] = [];
    if (!measured.is_valid) issues.push("assembly re-import fails OpenCascade validity check");
    if (!sameLabels(labels.actual, labels.expected)) {
        issues.push(
            `assembly labels ${JSON.stringify(labels.actual)} ` +
                `do not match artifacts ${JSON.stringify(labels.expected)}`,
        );
    }
    if (measured.solid_count !== expectedSolids) {
        issues.push(
            `assembly re-import has ${measured.solid_count} solids, expected ${expectedSolids}`,
        );
    }
    if (diffs.volume > STEP_VOLUME_REL_TOL) {
        issues.push(`assembly volume differs by ${exponential(diffs.volume, 3)} (relative)`);
    }
    if (diffs.dimension > STEP_DIM_TOL_MM) {
        issues.push(`assembly envelope differs by ${exponential(diffs.dimension, 3)} mm`);
    }
    return issues;
}

export async function exportAssembly(
    artifacts: readonly Artifact[],
    root: string,
    validation: ValidationReport,
): Promise<AssemblyRecord> {
    let path = inside(root, "assembly.step");
    if (existsSync(path)) throw new ExportError(`Refusing to overwrite unowned assembly: ${path}`);
    let tree = assemblyTree(artifacts);
    await writeFile(path, await io.writeStep(tree.root, STEP_OPTIONS));
    let written = await readFile(path);
    let reimported = (await io.readStep(written))[0];
    if (reimported === undefined) throw new ExportError(`assembly STEP export failed (${path})`);

    let measured = inspectShape(Shape.cast(reimported.shape));
    let envelope = validation.envelope.all;
    if (envelope === null) throw new ExportError("assembly export needs at least one artifact");
    let expectedSolids = validation.artifacts.reduce((sum, entry) => sum + entry.solid_count, 0);
    let expectedVolume = validation.artifacts.reduce((sum, entry) => sum + entry.volume_mm3, 0);
    let dimensionDiff = Math.max(
        ...measured.bbox.size.map((value, axis) => Math.abs(value - envelope.size[axis]!)),
    );
    let volumeDiff = relDiff(measured.volume_mm3, expectedVolume);
    let labels = labelMap(reimported.children);
    let issues = assemblyIssues(
        measured,
        { actual: labels, expected: expectedLabels(artifacts) },
        expectedSolids,
        { volume: volumeDiff, dimension: dimensionDiff },
    );
    return {
        file: "assembly.step",
        sha256: sha256Hex(written),
        bytes: written.byteLength,
        labels,
        is_valid: measured.is_valid,
        solid_count: measured.solid_count,
        volume_mm3: measured.volume_mm3,
        bbox: measured.bbox,
        expected_envelope: envelope,
        max_dimension_diff_mm: dimensionDiff,
        volume_rel_diff: volumeDiff,
        status: issues.length > 0 ? "failed" : "ok",
        issues,
    };
}
