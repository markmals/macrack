import type { Shape } from "@roonieone/caddy";

import * as caddy from "@roonieone/caddy";
import { CADFileType, importCAD } from "@roonieone/caddy";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import type { TriangleMesh } from "../mesh/triangle-mesh.ts";
import type { BboxReport, ShapeReport } from "./shape-report.ts";

import { sha256Hex } from "../digest.ts";
import { decodeBinaryStl } from "../mesh/stl.ts";
import { round } from "../rounding.ts";
import { exportStep } from "../step.ts";
import { ExportError } from "./export-error.ts";
import { inside, sha256File } from "./export-files.ts";
import {
    MESH_BBOX_TOL_MM,
    MESH_VOLUME_REL_TOL,
    STEP_DIM_TOL_MM,
    STEP_VOLUME_REL_TOL,
    STL_ANGULAR_DEFLECTION_RAD,
    STL_LINEAR_DEFLECTION,
    relDiff,
} from "./export-tolerances.ts";
import { exponential, general } from "./format.ts";
import { KIND_COLORS } from "./kind-colors.ts";
import { inspectShape } from "./shape-report.ts";

export type StepReimport = {
    readonly is_valid: boolean;
    readonly solid_count: number;
    readonly volume_mm3: number;
    readonly volume_rel_diff: number;
    readonly max_dimension_diff_mm: number;
    readonly bbox: BboxReport;
};

export type MeshReport = {
    readonly facets: number;
    readonly watertight: boolean;
    readonly winding_consistent: boolean;
    readonly volume_mm3: number;
    readonly volume_rel_diff: number;
    readonly max_extent_diff_mm: number;
    readonly max_corner_diff_mm: number;
};

export type PartRecord = {
    readonly name: string;
    readonly role: string;
    readonly kind: "printable";
    readonly notes: string[];
    readonly files: { readonly step: string; readonly stl: string };
    readonly sha256: { readonly step: string; readonly stl: string };
    readonly bytes: { readonly step: number; readonly stl: number };
    readonly cad: ShapeReport;
    readonly step_reimport: StepReimport;
    readonly mesh: MeshReport;
    readonly status: "failed" | "ok";
    readonly issues: string[];
};

function cadIssues(cad: ShapeReport): string[] {
    let issues: string[] = [];
    if (cad.solid_count !== 1) issues.push(`expected a single solid, found ${cad.solid_count}`);
    if (!cad.is_valid) issues.push("shape fails OpenCascade validity check");
    if (cad.volume_mm3 <= 0) issues.push(`non-positive volume ${cad.volume_mm3} mm^3`);
    return issues;
}

/** Write the labelled STEP and the tessellated STL, and report how large each file is. */
async function writeShapeFiles(
    shape: Shape,
    name: string,
    stepPath: string,
    stlPath: string,
): Promise<{ step: number; stl: number }> {
    let labelled = shape.translate([0, 0, 0]);
    labelled.label = name;
    if (labelled.color === undefined) labelled.color = KIND_COLORS.printable;
    await exportStep(labelled, stepPath);
    await caddy.export(labelled, {
        name: stlPath,
        type: CADFileType.Stl,
        tolerance: STL_LINEAR_DEFLECTION,
        angularTolerance: STL_ANGULAR_DEFLECTION_RAD,
    });
    let step = statSync(stepPath, { throwIfNoEntry: false });
    if (step === undefined) throw new ExportError(`${name}: STEP export failed (${stepPath})`);
    let stl = statSync(stlPath, { throwIfNoEntry: false });
    if (stl === undefined) throw new ExportError(`${name}: STL export failed (${stlPath})`);
    return { step: step.size, stl: stl.size };
}

async function stepReimport(
    path: string,
    cad: ShapeReport,
    issues: string[],
): Promise<StepReimport> {
    let measured = inspectShape(await importCAD(path));
    let volumeDiff = relDiff(measured.volume_mm3, cad.volume_mm3);
    let dimensionDiff = Math.max(
        ...measured.bbox.size.map((value, axis) => Math.abs(value - cad.bbox.size[axis]!)),
    );
    if (!measured.is_valid) issues.push("STEP re-import fails OpenCascade validity check");
    if (measured.solid_count !== cad.solid_count) {
        issues.push(
            `STEP re-import has ${measured.solid_count} solids, CAD has ${cad.solid_count}`,
        );
    }
    if (volumeDiff > STEP_VOLUME_REL_TOL) {
        issues.push(`STEP re-import volume differs by ${exponential(volumeDiff, 3)} (relative)`);
    }
    if (dimensionDiff > STEP_DIM_TOL_MM) {
        issues.push(`STEP re-import dimensions differ by ${exponential(dimensionDiff, 3)} mm`);
    }
    return {
        is_valid: measured.is_valid,
        solid_count: measured.solid_count,
        volume_mm3: measured.volume_mm3,
        volume_rel_diff: volumeDiff,
        max_dimension_diff_mm: dimensionDiff,
        bbox: measured.bbox,
    };
}

function meshReport(mesh: TriangleMesh, cad: ShapeReport, issues: string[]): MeshReport {
    let volume = mesh.volume;
    let volumeDiff = relDiff(volume, cad.volume_mm3);
    let extentDiff = Math.max(
        ...mesh.extents.map((value, axis) => Math.abs(value - cad.bbox.size[axis]!)),
    );
    let cornerDiff = Math.max(
        ...mesh.bounds[0].map((value, axis) => Math.abs(value - cad.bbox.min[axis]!)),
    );
    let watertight = mesh.isWatertight;
    let windingConsistent = mesh.isWindingConsistent;
    if (!watertight) issues.push("STL mesh is not watertight");
    if (!windingConsistent) issues.push("STL mesh winding is inconsistent");
    if (volume <= 0) issues.push(`STL mesh volume is ${general(volume)} mm^3`);
    if (volumeDiff > MESH_VOLUME_REL_TOL) {
        issues.push(`STL volume differs from CAD by ${exponential(volumeDiff, 3)} (relative)`);
    }
    if (Math.max(extentDiff, cornerDiff) > MESH_BBOX_TOL_MM) {
        issues.push(
            `STL bounds differ from CAD by ${Math.max(extentDiff, cornerDiff).toFixed(4)} mm`,
        );
    }
    return {
        facets: mesh.faceCount,
        watertight,
        winding_consistent: windingConsistent,
        volume_mm3: round(volume, 6),
        volume_rel_diff: volumeDiff,
        max_extent_diff_mm: extentDiff,
        max_corner_diff_mm: cornerDiff,
    };
}

/** Write one STEP and one STL of a local-coordinate shape and measure both back. */
export async function exportPart(
    shape: Shape,
    name: string,
    directory: string,
    role: string,
    note: string,
): Promise<PartRecord> {
    let stepPath = inside(directory, `${name}.step`);
    let stlPath = inside(directory, `${name}.stl`);
    if (existsSync(stepPath) || existsSync(stlPath)) {
        throw new ExportError(`Refusing to overwrite unowned export files for ${name}`);
    }
    let cad = inspectShape(shape);
    let issues = cadIssues(cad);
    let sizes = await writeShapeFiles(shape, name, stepPath, stlPath);
    let step = await stepReimport(stepPath, cad, issues);
    let stlBytes = await readFile(stlPath);
    let mesh = meshReport(decodeBinaryStl(stlBytes), cad, issues);
    let notes = note ? [note] : [];
    let floor = cad.bbox.min[2]!;
    if (floor < 0) {
        notes.push(
            `local geometry reaches ${floor.toFixed(3)} mm below z=0; drop to bed in the slicer.`,
        );
    }
    return {
        name,
        role,
        kind: "printable",
        notes,
        files: {
            step: `${basename(directory)}/${basename(stepPath)}`,
            stl: `${basename(directory)}/${basename(stlPath)}`,
        },
        sha256: { step: await sha256File(stepPath), stl: sha256Hex(stlBytes) },
        bytes: sizes,
        cad,
        step_reimport: step,
        mesh,
        status: issues.length > 0 ? "failed" : "ok",
        issues,
    };
}
