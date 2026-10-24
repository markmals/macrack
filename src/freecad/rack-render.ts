import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative as relativeTo } from "node:path";

import type { RackManifest } from "./rack-manifest.ts";
import type { RackFacts } from "./rack-report.ts";

import { sha256Hex } from "../digest.ts";
import { MacrackError } from "../errors.ts";
import { isSymlink, resolveExisting } from "../files.ts";
import { runFreecadJob } from "./freecad-python.ts";
import { checkedPath } from "./paths.ts";
import { buildRackJob } from "./rack-job.ts";
import { checkOutputs, conversions, loadManifest } from "./rack-manifest.ts";
import { buildRackReport } from "./rack-report.ts";

const GENERATED = [
    "rack.step",
    "rack.FCStd",
    "rack-front.png",
    "rack-back.png",
    "rack-cutaway.png",
    "freecad-rack-report.json",
];

export interface RackRenderContext {
    readonly root: string;
    readonly staging: string;
    readonly manifest: RackManifest;
}

export type RackRenderer = (context: RackRenderContext) => Promise<RackFacts>;

async function runWorker(context: RackRenderContext): Promise<RackFacts> {
    let job = await buildRackJob(context.root, context.staging, context.manifest);
    for (let shape of job.shapes) {
        if (shape.convert !== null) await mkdir(dirname(shape.convert.path), { recursive: true });
    }
    return (await runFreecadJob("rack_worker.py", job)) as RackFacts;
}

/** Staged files in the order the manifest records them, conversions first. */
function stagedOutputs(manifest: RackManifest, staging: string): string[] {
    let outputs = conversions(manifest).map(relative => join(staging, relative));
    outputs.push(join(staging, "rack.step"));
    outputs.push(join(staging, "rack-front.png"));
    outputs.push(join(staging, "rack-back.png"));
    outputs.push(join(staging, "rack-cutaway.png"));
    outputs.push(join(staging, "rack.FCStd"));
    outputs.push(join(staging, "freecad-rack-report.json"));
    return outputs;
}

function sameJson(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (typeof left !== "object" || typeof right !== "object") return false;
    if (left === null || right === null) return false;
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right)) return false;
        return left.length === right.length && left.every((item, i) => sameJson(item, right[i]));
    }
    let a = left as Record<string, unknown>;
    let b = right as Record<string, unknown>;
    let keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every(key => Object.hasOwn(b, key) && sameJson(a[key], b[key]));
}

/**
 * Publication is the last step and moves within one directory, so a failed render leaves the
 * previous rack and its manifest exactly as they were.
 */
async function publish(
    context: RackRenderContext,
    manifestPath: string,
    outputs: readonly string[],
): Promise<void> {
    let { manifest, root, staging } = context;
    for (let path of outputs) {
        manifest.files[relativeTo(staging, path)] = sha256Hex(await readFile(path));
    }
    let stagedManifest = join(staging, basename(manifestPath));
    await writeFile(stagedManifest, `${JSON.stringify(manifest, null, 2)}\n`);
    for (let path of outputs) {
        let target = await checkedPath(root, relativeTo(staging, path));
        await mkdir(dirname(target), { recursive: true });
        await rename(path, target);
    }
    await rename(stagedManifest, manifestPath);
}

export async function renderRack(
    manifestPath: string,
    options: { readonly renderer?: RackRenderer } = {},
): Promise<void> {
    if (await isSymlink(manifestPath)) {
        throw new MacrackError("Refusing a symlinked rack manifest");
    }
    let path = resolveExisting(manifestPath);
    let root = dirname(path);
    let manifest = await loadManifest(path);
    let generated = [...GENERATED, ...conversions(manifest)];
    await checkOutputs(root, generated, manifest);
    let staging = await mkdtemp(join(root, ".freecad-"));
    try {
        let context = { manifest, root, staging };
        let facts = await (options.renderer ?? runWorker)(context);
        let report = buildRackReport(manifest, facts, { root, staging });
        await writeFile(
            join(staging, "freecad-rack-report.json"),
            `${JSON.stringify(report, null, 2)}\n`,
        );
        if (!sameJson(await loadManifest(path), manifest)) {
            throw new MacrackError("Rack manifest changed during FreeCAD export");
        }
        await checkOutputs(root, generated, manifest);
        await publish(context, path, stagedOutputs(manifest, staging));
    } finally {
        await rm(staging, { force: true, recursive: true });
    }
    console.log(
        `Full rack: ${join(root, "rack.step")}; ${join(root, "rack.FCStd")}; three PNG views`,
    );
}
