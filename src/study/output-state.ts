import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { extname, isAbsolute, join, sep } from "node:path";

import { sha256Hex } from "../digest.ts";
import { MacrackError } from "../errors.ts";
import { resolveExisting } from "../files.ts";

const OWNED_DIRECTORIES = ["parts", "coupons"];
const OWNED_SUFFIXES = [".step", ".stl"];

interface OwnedFile {
    readonly path: string;
    readonly sha256: string;
}

/** One property of parsed JSON, or undefined when the value is not an object that has it. */
function field(value: unknown, key: string): unknown {
    if (typeof value !== "object" || value === null) return undefined;
    return Object.hasOwn(value, key) ? Reflect.get(value, key) : undefined;
}

function ownedPath(root: string, relative: string): string {
    let parts = relative.split("/");
    let validPart =
        parts.length === 2 &&
        OWNED_DIRECTORIES.includes(parts[0]!) &&
        OWNED_SUFFIXES.includes(extname(relative));
    if (isAbsolute(relative) || !(relative === "assembly.step" || validPart)) {
        throw new MacrackError(`Invalid owned export path: ${relative}`);
    }
    let resolved = resolveExisting(join(root, relative));
    if (!resolved.startsWith(resolveExisting(root) + sep)) {
        throw new MacrackError(`Owned export escapes output directory: ${relative}`);
    }
    return resolved;
}

function ownedFiles(manifest: unknown, output: string, manifestPath: string): OwnedFile[] {
    let malformed = new MacrackError(
        `Refusing to replace an unrecognized manifest: ${manifestPath}`,
    );
    let parts = field(manifest, "parts");
    if (!Array.isArray(parts)) throw malformed;
    let owned: OwnedFile[] = [];
    for (let part of parts) {
        for (let kind of ["step", "stl"]) {
            let relative = field(field(part, "files"), kind);
            let digest = field(field(part, "sha256"), kind);
            if (typeof relative !== "string" || typeof digest !== "string") throw malformed;
            owned.push({ path: ownedPath(output, relative), sha256: digest });
        }
    }
    let assembly = field(manifest, "assembly");
    if (assembly) {
        let file = field(assembly, "file");
        let digest = field(assembly, "sha256");
        if (typeof file !== "string" || typeof digest !== "string") throw malformed;
        owned.push({ path: ownedPath(output, file), sha256: digest });
    }
    return owned;
}

async function dropStaleInspection(output: string): Promise<void> {
    let inspection = join(output, "freecad-report.json");
    if (!existsSync(inspection)) return;
    let report: unknown = JSON.parse(await readFile(inspection, "utf8"));
    if (field(report, "schema") === "macrack.freecad-inspect/1") await rm(inspection);
}

/** Remove only unchanged files recorded by the previous export, before a new build. */
export async function invalidateOutput(output: string): Promise<void> {
    let manifestPath = join(output, "manifest.json");
    await dropStaleInspection(output);
    if (!existsSync(manifestPath)) return;
    let manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    if (field(manifest, "schema") !== "macrack.export/1") {
        throw new MacrackError(`Refusing to replace an unrecognized manifest: ${manifestPath}`);
    }
    let owned = ownedFiles(manifest, output, manifestPath);
    for (let { path, sha256 } of owned) {
        if (existsSync(path) && sha256Hex(await readFile(path)) !== sha256) {
            throw new MacrackError(
                `Previous export was modified; preserve or move it before rebuilding: ${path}`,
            );
        }
    }
    await rm(manifestPath);
    for (let { path } of owned) await rm(path, { force: true });
}
