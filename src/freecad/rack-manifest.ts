import { readFile } from "node:fs/promises";
import { dirname } from "node:path";

import { sha256Hex } from "../digest.ts";
import { MacrackError } from "../errors.ts";
import { exists, isDirectory } from "../files.ts";
import { checkedPath } from "./paths.ts";

export interface RackGeometry {
    readonly bounds_mm: readonly (readonly number[])[];
    readonly volume_mm3: number;
}

export interface RackComponent {
    readonly name: string;
    readonly role: string;
    readonly file: string;
    readonly transform: readonly (readonly number[])[];
    readonly note: string;
    readonly volume_mm3: number;
}

export interface RackValidation {
    readonly physical_geometry_ok: boolean;
    readonly bounds_mm: readonly (readonly number[])[];
    readonly components: readonly RackComponent[];
}

export interface RackManifest {
    readonly schema: string;
    readonly validation: RackValidation;
    readonly geometry: Readonly<Record<string, RackGeometry>>;
    readonly files: Record<string, string>;
    readonly cutaway_hide: readonly string[];
}

/** The staged STEP conversion of a source mesh, named after it. */
export function stepName(relative: string): string {
    return relative.replace(/\.[^./]*$/, ".step");
}

export function conversions(manifest: RackManifest): string[] {
    return Object.keys(manifest.geometry)
        .filter(relative => relative.endsWith(".stl"))
        .map(stepName);
}

export async function loadManifest(path: string): Promise<RackManifest> {
    let manifest = JSON.parse(await readFile(path, "utf8")) as RackManifest;
    if (manifest.schema !== "macrack.rack/1") {
        throw new MacrackError("Expected a macrack.rack/1 manifest");
    }
    if (!manifest.validation.physical_geometry_ok) {
        throw new MacrackError("Refusing a rack with unresolved physical-part intersections");
    }
    for (let [relative, expected] of Object.entries(manifest.files)) {
        let actual = sha256Hex(await readFile(await checkedPath(dirname(path), relative)));
        if (actual !== expected) {
            throw new MacrackError(`Changed rack artifact: ${relative}; regenerate the rack first`);
        }
    }
    return manifest;
}

/** Nothing is written over unless the manifest already claims it as a generated rack file. */
export async function checkOutputs(
    root: string,
    names: readonly string[],
    manifest: RackManifest,
): Promise<void> {
    for (let relative of names) {
        let target = await checkedPath(root, relative);
        if ((await exists(target)) && !Object.hasOwn(manifest.files, relative)) {
            throw new MacrackError(`Refusing to overwrite unowned FreeCAD output: ${relative}`);
        }
        let parent = dirname(target);
        if ((await exists(parent)) && !(await isDirectory(parent))) {
            throw new MacrackError(`Output directory is occupied by a file: ${parent}`);
        }
    }
}
