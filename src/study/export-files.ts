import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";

import type { Artifact } from "./artifact.ts";

import { sha256Hex } from "../digest.ts";
import { resolveExisting } from "../files.ts";
import { ExportError } from "./export-error.ts";
import { quoted } from "./format.ts";

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Resolve a path under root, following symlinks, refusing anything that escapes it. */
export function inside(root: string, ...parts: string[]): string {
    let candidate = join(root, ...parts);
    let resolved = resolveExisting(candidate);
    let base = resolveExisting(root);
    if (resolved !== base && !resolved.startsWith(base + sep)) {
        throw new ExportError(`generated path ${candidate} escapes output directory ${root}`);
    }
    return resolved;
}

export function requireSafeName(name: string): string {
    if (!SAFE_NAME.test(name)) {
        throw new ExportError(
            `artifact name ${quoted(name)} is not usable as a file name; ` +
                "use letters, digits, dot, dash or underscore",
        );
    }
    return name;
}

export async function sha256File(path: string): Promise<string> {
    return sha256Hex(await readFile(path));
}

/** Every file a run will publish, in publication order, with the names it refuses up front. */
export function plannedFiles(
    artifacts: readonly Artifact[],
    coupons: readonly Artifact[],
): string[] {
    let couponNames = coupons.map(coupon => coupon.name);
    if (new Set(couponNames).size !== couponNames.length) {
        throw new ExportError("duplicate coupon names would overwrite output files");
    }
    let paths = ["assembly.step"];
    let groups = [
        ["parts", artifacts],
        ["coupons", coupons],
    ] as const;
    for (let [directory, members] of groups) {
        for (let item of members) {
            if (item.kind !== "printable") {
                if (directory === "coupons") {
                    throw new ExportError(`coupon ${quoted(item.name)} must be printable`);
                }
                continue;
            }
            let name = requireSafeName(item.name);
            paths.push(`${directory}/${name}.step`, `${directory}/${name}.stl`);
        }
    }
    return paths;
}

export function checkTargets(root: string, paths: readonly string[]): void {
    for (let relative of paths) {
        let target = inside(root, relative);
        let parent = dirname(target);
        let info = statSync(parent, { throwIfNoEntry: false });
        if (info !== undefined && !info.isDirectory()) {
            throw new ExportError(`Output directory is occupied by a file: ${parent}`);
        }
        if (existsSync(target)) {
            throw new ExportError(`Refusing to overwrite unowned export: ${target}`);
        }
    }
}
