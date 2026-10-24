import { realpathSync } from "node:fs";
import { lstat, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export async function isFile(path: string): Promise<boolean> {
    try {
        return (await stat(path)).isFile();
    } catch {
        return false;
    }
}

export async function exists(path: string): Promise<boolean> {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

export async function isDirectory(path: string): Promise<boolean> {
    try {
        return (await stat(path)).isDirectory();
    } catch {
        return false;
    }
}

export async function isSymlink(path: string): Promise<boolean> {
    try {
        return (await lstat(path)).isSymbolicLink();
    } catch {
        return false;
    }
}

/**
 * Python's `Path.resolve()`: symlinks followed as far as the path exists, the rest appended.
 * Synchronous so the study exporter's synchronous path checks and the rack's async ones share it.
 */
export function resolveExisting(path: string): string {
    let absolute = resolve(path);
    let missing: string[] = [];
    let current = absolute;
    for (;;) {
        try {
            return join(realpathSync(current), ...missing);
        } catch {
            let parent = dirname(current);
            if (parent === current) return absolute;
            missing.unshift(basename(current));
            current = parent;
        }
    }
}
