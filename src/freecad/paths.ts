import { isAbsolute, join, sep } from "node:path";

import { MacrackError } from "../errors.ts";
import { isSymlink, resolveExisting } from "../files.ts";

/**
 * A rack-relative path that stays inside the output directory and is reached without following a
 * symlink, so a tampered tree cannot redirect a read or an overwrite.
 */
export async function checkedPath(root: string, relative: string): Promise<string> {
    let segments = relative.split(sep).filter(segment => segment !== "" && segment !== ".");
    if (isAbsolute(relative) || segments.includes("..")) {
        throw new MacrackError(`Invalid rack path: ${relative}`);
    }
    let path = join(root, relative);
    let rootReal = resolveExisting(root);
    let pathReal = resolveExisting(path);
    if (!pathReal.startsWith(rootReal + sep)) {
        throw new MacrackError(`Rack file escapes output directory: ${relative}`);
    }
    let current = root;
    for (let segment of segments) {
        current = join(current, segment);
        if (await isSymlink(current)) {
            throw new MacrackError(`Refusing symlinked rack file: ${current}`);
        }
    }
    return path;
}
