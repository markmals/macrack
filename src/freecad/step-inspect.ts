import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { sha256Hex } from "../digest.ts";
import { MacrackError } from "../errors.ts";
import { isFile } from "../files.ts";
import { round } from "../rounding.ts";
import { runFreecadJob } from "./freecad-python.ts";

const API_CALLS = [
    "FreeCAD.Version()",
    "Part.Shape().read(path)",
    "Shape.isValid()",
    "Shape.Solids / Shape.Shells / Shape.Faces",
    "Shape.Volume",
    "Shape.BoundBox (XMin..ZMax, XLength/YLength/ZLength)",
    "Import.insert(path, doc.Name) and FreeCAD.ActiveDocument.saveAs(path)  [--document only]",
];

const LIMITATIONS = [
    "Validity, solid count and bounding box are geometric facts about the file, not a fit, print or load result.",
    "Part.read() ignores assembly structure: labels and colors are only reported in --document mode.",
    "A FreeCAD document written by --document is for visual inspection; the JSON report is the measured result.",
];

type Triple = readonly [number, number, number];

interface StepFacts {
    readonly shape_type: string;
    readonly is_valid: boolean;
    readonly solid_count: number;
    readonly shell_count: number;
    readonly face_count: number;
    readonly volume_mm3: number;
    readonly bbox: { readonly min: Triple; readonly max: Triple; readonly size: Triple };
}

interface InspectFacts {
    readonly tool: Readonly<Record<string, string>>;
    readonly files: readonly StepFacts[];
    readonly document: { readonly object_labels: string[] } | null;
}

export interface InspectOptions {
    readonly report: string;
    readonly document?: string | undefined;
}

export interface InspectResult {
    readonly ok: boolean;
    readonly report: Record<string, unknown>;
}

/** Python prints a measured float as `0.0`, and these issue strings are read by people. */
function decimal(value: number): string {
    return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

interface InspectBox {
    readonly min: number[];
    readonly max: number[];
    readonly size: number[];
    readonly volume_mm3: number;
}

interface InspectFile {
    readonly path: string;
    readonly exists: boolean;
    readonly sha256: string;
    readonly shape_type: string;
    readonly is_valid: boolean;
    readonly solid_count: number;
    readonly shell_count: number;
    readonly face_count: number;
    readonly volume_mm3: number;
    readonly bbox: InspectBox;
}

function boundingBox(box: StepFacts["bbox"]): InspectBox {
    let [x, y, z] = box.size;
    return {
        min: box.min.map(value => round(value, 6)),
        max: box.max.map(value => round(value, 6)),
        size: box.size.map(value => round(value, 6)),
        volume_mm3: round(x * y * z, 6),
    };
}

function fileIssues(entry: InspectFile): string[] {
    let issues: string[] = [];
    if (!entry.is_valid) issues.push("shape fails FreeCAD validity check");
    if (entry.solid_count < 1) issues.push("no solid in file");
    if (entry.volume_mm3 <= 0) {
        issues.push(`non-positive volume ${decimal(entry.volume_mm3)} mm^3`);
    }
    if (entry.bbox.volume_mm3 <= 0) issues.push("degenerate bounding box");
    return issues;
}

async function describe(path: string, facts: StepFacts): Promise<InspectFile> {
    return {
        path,
        exists: true,
        sha256: sha256Hex(await readFile(path)),
        shape_type: facts.shape_type,
        is_valid: facts.is_valid,
        solid_count: facts.solid_count,
        shell_count: facts.shell_count,
        face_count: facts.face_count,
        volume_mm3: round(facts.volume_mm3, 6),
        bbox: boundingBox(facts.bbox),
    };
}

async function inspectFiles(
    paths: readonly string[],
    present: readonly boolean[],
    facts: InspectFacts,
): Promise<{ files: object[]; issues: string[] }> {
    let files: object[] = [];
    let issues: string[] = [];
    let measured = 0;
    for (let [index, path] of paths.entries()) {
        if (present[index] !== true) {
            files.push({ path, exists: false, issues: ["file not found"] });
            issues.push(`${path}: file not found`);
            continue;
        }
        let shape = facts.files[measured];
        if (shape === undefined) throw new MacrackError(`FreeCAD measured nothing for ${path}`);
        let entry = await describe(path, shape);
        measured += 1;
        let found = fileIssues(entry);
        files.push({ ...entry, issues: found });
        for (let text of found) issues.push(`${path}: ${text}`);
    }
    return { files, issues };
}

/**
 * Re-reads exports with FreeCAD's own OpenCascade build: problems a round trip through the
 * writing library would hide show up here. The JSON report is the measured result; the optional
 * document is an inspection aid.
 */
export async function inspectSteps(
    paths: readonly string[],
    options: InspectOptions,
): Promise<InspectResult> {
    // A previous report must never survive a failed run.
    await rm(options.report, { force: true });
    let present: boolean[] = [];
    for (let path of paths) present.push(await isFile(path));
    let existing = paths.filter((_, index) => present[index] === true);
    if (options.document !== undefined) {
        await mkdir(dirname(resolve(options.document)), { recursive: true });
    }
    let facts = (await runFreecadJob("inspect_worker.py", {
        document: options.document === undefined ? null : resolve(options.document),
        steps: existing.map(path => resolve(path)),
    })) as InspectFacts;
    let { files, issues } = await inspectFiles(paths, present, facts);
    let document =
        facts.document === null || options.document === undefined
            ? null
            : { path: options.document, object_labels: facts.document.object_labels };
    let report = {
        schema: "macrack.freecad-inspect/1",
        ok: issues.length === 0,
        tool: facts.tool,
        api_calls: API_CALLS,
        files,
        document,
        limitations: LIMITATIONS,
        issues,
    };
    await mkdir(dirname(resolve(options.report)), { recursive: true });
    await writeFile(options.report, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ ok: report.ok, report: options.report, issues }, null, 2));
    return { ok: report.ok, report };
}
