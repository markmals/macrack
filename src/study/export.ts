/**
 * Export artifacts to STEP/STL plus a measured manifest.
 *
 * Every exported file is re-read and measured against its CAD source before the run is reported
 * as ok. Any failed measurement raises ExportError after the manifest is written; nothing here
 * falls back to a partial or unchecked result.
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { dirname, join } from "node:path";

import type { Artifact } from "./artifact.ts";
import type { AssemblyRecord } from "./export-assembly.ts";
import type { PartRecord } from "./export-part.ts";
import type { ValidationReport } from "./validation.ts";

import { STEP_TIMESTAMP } from "../step.ts";
import { exportAssembly } from "./export-assembly.ts";
import { ExportError } from "./export-error.ts";
import { checkTargets, inside, plannedFiles, requireSafeName } from "./export-files.ts";
import { exportPart } from "./export-part.ts";
import {
    MESH_BBOX_TOL_MM,
    MESH_VOLUME_REL_TOL,
    STEP_DIM_TOL_MM,
    STEP_VOLUME_REL_TOL,
    STL_ANGULAR_DEFLECTION_RAD,
    STL_LINEAR_DEFLECTION,
} from "./export-tolerances.ts";
import { quoted } from "./format.ts";
import { invalidateOutput } from "./output-state.ts";
import { validateArtifacts } from "./validation.ts";

export { ExportError } from "./export-error.ts";

const LIMITATIONS: readonly string[] = [
    "Exported geometry is candidate CAD only: no physical fit, print, thermal, vibration or load test is implied.",
    "Part STEP/STL files are in local model coordinates, not bed coordinates; a carrier whose local bbox starts below z=0 (ground skids) must be dropped to the bed in the slicer before slicing.",
    "assembly.step carries placed parts, device keepouts and cooling reservations; keepouts and reservations are reference volumes and must not be printed.",
    "Mesh checks prove a watertight, correctly scaled tessellation of the CAD solid; they do not prove printability, support strategy or bed fit.",
    "Checks performed here are geometric. Rail engagement, fastener fit and device clearance against unselected hardware remain unvalidated.",
];

export interface Manifest {
    schema: "macrack.export/1";
    ok: boolean;
    output_dir: string;
    generated_by: Record<string, string>;
    tolerances: Record<string, boolean | number>;
    metadata: Record<string, unknown>;
    validation: ValidationReport;
    parts: PartRecord[];
    assembly: AssemblyRecord | null;
    limitations: string[];
    failures: string[];
}

function packageVersion(name: string): string {
    let path = findPackageJSON(name, import.meta.url);
    if (path === undefined) throw new ExportError(`cannot find the installed ${name} package`);
    let installed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (
        typeof installed !== "object" ||
        installed === null ||
        !("version" in installed) ||
        typeof installed.version !== "string"
    ) {
        throw new ExportError(`${name} does not record a version`);
    }
    return installed.version;
}

function tooling(): Record<string, string> {
    return {
        node: process.versions.node,
        caddy: packageVersion("@roonieone/caddy"),
        "occt-native": packageVersion("@roonieone/occt-native"),
        step_timestamp: STEP_TIMESTAMP,
    };
}

async function writeManifest(root: string, manifest: object): Promise<string> {
    let path = inside(root, "manifest.json");
    await writeFile(path, JSON.stringify(manifest, null, 2) + "\n");
    return path;
}

function emptyManifest(
    root: string,
    metadata: Record<string, unknown>,
    validation: ValidationReport,
): Manifest {
    return {
        schema: "macrack.export/1",
        ok: false,
        output_dir: root,
        generated_by: tooling(),
        tolerances: {
            stl_linear_deflection_relative: STL_LINEAR_DEFLECTION,
            stl_angular_deflection_rad: STL_ANGULAR_DEFLECTION_RAD,
            mesh_volume_rel_tol: MESH_VOLUME_REL_TOL,
            mesh_bbox_tol_mm: MESH_BBOX_TOL_MM,
            step_volume_rel_tol: STEP_VOLUME_REL_TOL,
            step_dimension_tol_mm: STEP_DIM_TOL_MM,
            collision_volume_tol_mm3: validation.tolerances.collision_volume_mm3,
        },
        metadata,
        validation,
        parts: [],
        assembly: null,
        limitations: [...LIMITATIONS],
        failures: [],
    };
}

async function exportRecords(
    artifacts: readonly Artifact[],
    coupons: readonly Artifact[],
    partsDir: string,
    couponsDir: string,
): Promise<PartRecord[]> {
    let records: PartRecord[] = [];
    for (let item of artifacts) {
        if (item.kind !== "printable") continue;
        let name = requireSafeName(item.name);
        records.push(await exportPart(item.shape, name, partsDir, "part", item.note));
    }
    for (let coupon of coupons) {
        let name = requireSafeName(coupon.name);
        if (coupon.kind !== "printable") {
            throw new ExportError(
                `coupon ${quoted(name)} has kind ${quoted(coupon.kind)}, expected printable`,
            );
        }
        records.push(await exportPart(coupon.shape, name, couponsDir, "coupon", coupon.note));
    }
    return records;
}

async function exportStaged(
    artifacts: readonly Artifact[],
    coupons: readonly Artifact[],
    root: string,
    metadata: Record<string, unknown>,
): Promise<Manifest> {
    let partsDir = inside(root, "parts");
    let couponsDir = inside(root, "coupons");
    let validation = validateArtifacts(artifacts);
    let manifest = emptyManifest(root, metadata, validation);

    if (!validation.ok) {
        manifest.failures = validation.issues.map(issue => `validation: ${issue}`);
        await writeManifest(root, manifest);
        throw new ExportError(
            "artifact validation failed, nothing exported: " + validation.issues.join("; "),
        );
    }

    await mkdir(partsDir, { recursive: true });
    await mkdir(couponsDir, { recursive: true });
    manifest.parts = await exportRecords(artifacts, coupons, partsDir, couponsDir);
    manifest.assembly = await exportAssembly(artifacts, root, validation);

    let failures = manifest.parts.flatMap(record =>
        record.issues.map(issue => `${record.name}: ${issue}`),
    );
    failures.push(...manifest.assembly.issues.map(issue => `assembly: ${issue}`));
    manifest.failures = failures;
    manifest.ok = failures.length === 0;
    await writeManifest(root, manifest);
    if (failures.length > 0) {
        throw new ExportError("exported files failed measurement: " + failures.join("; "));
    }
    return manifest;
}

/** A failed run still reports what it measured, without claiming any published file. */
async function publishFailedManifest(staging: string, root: string): Promise<void> {
    let report = join(staging, "manifest.json");
    if (!existsSync(report)) return;
    let failed = JSON.parse(await readFile(report, "utf8")) as Record<string, unknown>;
    await writeManifest(root, { ...failed, output_dir: root, parts: [], assembly: null });
}

async function stageAndPublish(
    artifacts: readonly Artifact[],
    coupons: readonly Artifact[],
    staging: string,
    root: string,
    paths: readonly string[],
    metadata: Record<string, unknown>,
): Promise<Manifest> {
    let manifest: Manifest;
    try {
        manifest = await exportStaged(artifacts, coupons, staging, metadata);
    } catch (error) {
        if (error instanceof ExportError) await publishFailedManifest(staging, root);
        throw error;
    }
    checkTargets(root, paths);
    for (let relative of paths) await rename(join(staging, relative), inside(root, relative));
    manifest.output_dir = root;
    await writeManifest(root, manifest);
    return manifest;
}

/** Publish local part STEP/STLs and a placed assembly only after all checks pass. */
export async function exportProject(
    artifacts: readonly Artifact[],
    coupons: readonly Artifact[],
    output: string,
    metadata: Record<string, unknown>,
): Promise<Manifest> {
    await mkdir(output, { recursive: true });
    await invalidateOutput(output);
    let paths = plannedFiles(artifacts, coupons);
    checkTargets(output, paths);
    for (let relative of paths) {
        await mkdir(dirname(inside(output, relative)), { recursive: true });
    }
    let staging = await mkdtemp(join(output, ".macrack-"));
    try {
        return await stageAndPublish(artifacts, coupons, staging, output, paths, metadata);
    } finally {
        await rm(staging, { recursive: true, force: true });
    }
}
