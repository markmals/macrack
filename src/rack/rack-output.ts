import type { Shape } from "@roonieone/caddy";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, sep } from "node:path";

import type { Bounds } from "../mesh/triangle-mesh.ts";
import type { SceneComponent, SceneReport } from "./rack-scene.ts";

import { sha256Hex } from "../digest.ts";
import { MacrackError } from "../errors.ts";
import { exists, isSymlink, resolveExisting } from "../files.ts";
import { decodeBinaryStl, encodeBinaryStl } from "../mesh/stl.ts";
import { exportStep } from "../step.ts";

export const MANIFEST_NAME = "rack.json";

const OUTPUT_DIRECTORIES = ["source", "candidates", "references"];
const OUTPUT_SUFFIXES = [".step", ".stl"];
const ROOT_FILES = [
    "rack.step",
    "rack.FCStd",
    "rack-front.png",
    "rack-back.png",
    "rack-cutaway.png",
    "freecad-rack-report.json",
];
const STL_ROUND_TRIP_TOLERANCE_MM = 0.0001;

export interface GeometryRecord {
    readonly bounds_mm: Bounds;
    readonly volume_mm3: number;
}

export interface RackManifest {
    readonly schema: string;
    readonly metadata: Record<string, unknown>;
    readonly validation: SceneReport;
    readonly geometry: Record<string, GeometryRecord>;
    readonly files: Record<string, string>;
    readonly cutaway_hide: unknown;
}

/** The absolute path of a rack output this tool may create, replace and delete; nothing else. */
export async function ownedPath(root: string, relative: string): Promise<string> {
    let parts = relative.split("/").filter(segment => segment !== "" && segment !== ".");
    if (isAbsolute(relative) || parts.includes("..")) {
        throw new MacrackError(`Invalid rack output path: ${relative}`);
    }
    let name = parts[parts.length - 1] ?? "";
    let allowedDirectory =
        parts.length === 2 &&
        OUTPUT_DIRECTORIES.includes(parts[0]!) &&
        OUTPUT_SUFFIXES.includes(extname(name));
    if (!allowedDirectory && !(parts.length === 1 && ROOT_FILES.includes(name))) {
        throw new MacrackError(`Unrecognized rack output path: ${relative}`);
    }
    let target = join(root, ...parts);
    let resolvedRoot = resolveExisting(root);
    let prefix = resolvedRoot.endsWith(sep) ? resolvedRoot : resolvedRoot + sep;
    if (!resolveExisting(target).startsWith(prefix)) {
        throw new MacrackError(`Rack output escapes directory: ${relative}`);
    }
    let current = root;
    for (let segment of parts) {
        current = join(current, segment);
        if (await isSymlink(current)) {
            throw new MacrackError(`Refusing symlinked rack output: ${current}`);
        }
    }
    return target;
}

/** Removes the previous rack, refusing to touch anything the owner has since changed. */
export async function invalidateRack(root: string): Promise<void> {
    let manifestPath = join(root, MANIFEST_NAME);
    if (await isSymlink(manifestPath)) {
        throw new MacrackError(`Refusing a symlinked rack manifest: ${manifestPath}`);
    }
    if (!(await exists(manifestPath))) return;
    let previous: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    let schema =
        typeof previous === "object" && previous !== null
            ? Reflect.get(previous, "schema")
            : undefined;
    if (schema !== "macrack.rack/1") {
        throw new MacrackError(`Refusing an unrecognized rack manifest: ${manifestPath}`);
    }
    let files: unknown = Reflect.get(previous as object, "files");
    if (
        typeof files !== "object" ||
        files === null ||
        !Object.values(files).every(digest => typeof digest === "string")
    ) {
        throw new MacrackError(`Rack manifest has no file ownership record: ${manifestPath}`);
    }
    let owned: [path: string, digest: string][] = [];
    for (let [name, digest] of Object.entries(files as Record<string, string>)) {
        owned.push([await ownedPath(root, name), digest]);
    }
    for (let [path, digest] of owned) {
        if ((await exists(path)) && sha256Hex(await readFile(path)) !== digest) {
            throw new MacrackError(
                `Generated rack file was modified; preserve it before rebuilding: ${path}`,
            );
        }
    }
    await rm(manifestPath);
    for (let [path] of owned) await rm(path, { force: true });
}

function withStlSuffix(relative: string): string {
    return `${relative.slice(0, relative.length - extname(relative).length)}.stl`;
}

/** A carrier is printed from its STL, so the written mesh must survive the round trip. */
async function writeCandidateStl(
    root: string,
    component: SceneComponent,
    files: Record<string, string>,
): Promise<void> {
    let relative = withStlSuffix(component.file);
    let stl = join(root, relative);
    if (await exists(stl)) {
        throw new MacrackError(`Refusing to overwrite unowned carrier STL: ${stl}`);
    }
    await writeFile(stl, encodeBinaryStl(component.mesh));
    let reimported = decodeBinaryStl(await readFile(stl));
    let bounds = component.mesh.bounds;
    let kept = reimported.bounds.every((corner, index) =>
        corner.every(
            (value, axis) => Math.abs(value - bounds[index]![axis]!) <= STL_ROUND_TRIP_TOLERANCE_MM,
        ),
    );
    if (!reimported.isVolume || !kept) {
        throw new MacrackError(`Candidate STL failed round-trip checks: ${stl}`);
    }
    files[relative] = sha256Hex(await readFile(stl));
}

function requireShape(cadShapes: ReadonlyMap<string, Shape>, file: string): Shape {
    let shape = cadShapes.get(file);
    if (shape === undefined) throw new Error(`no CAD shape was recorded for ${file}`);
    return shape;
}

export async function writeGeometry(
    root: string,
    components: readonly SceneComponent[],
    cadShapes: ReadonlyMap<string, Shape>,
    report: SceneReport,
    metadata: Record<string, unknown>,
): Promise<RackManifest> {
    await mkdir(root, { recursive: true });
    let geometry: Record<string, GeometryRecord> = {};
    let files: Record<string, string> = {};
    for (let component of components) {
        if (component.file in geometry) continue;
        let path = await ownedPath(root, component.file);
        if (await exists(path)) {
            throw new MacrackError(`Refusing to overwrite unowned rack geometry: ${path}`);
        }
        await mkdir(dirname(path), { recursive: true });
        if (extname(path) === ".step") {
            await exportStep(requireShape(cadShapes, component.file), path);
        } else {
            await writeFile(path, encodeBinaryStl(component.mesh));
        }
        geometry[component.file] = {
            bounds_mm: component.mesh.bounds,
            volume_mm3: component.mesh.volume,
        };
        files[component.file] = sha256Hex(await readFile(path));
        if (component.role === "candidate") await writeCandidateStl(root, component, files);
    }
    let manifest: RackManifest = {
        schema: "macrack.rack/1",
        metadata,
        validation: report,
        geometry,
        files,
        cutaway_hide: metadata["cutaway_hide"],
    };
    await writeFile(join(root, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
}
