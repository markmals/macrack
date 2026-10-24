import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";

import { sha256Hex } from "../src/digest.ts";
import { exists } from "../src/files.ts";
import { invalidateRack, ownedPath } from "../src/rack/rack-output.ts";

let directories: string[] = [];

async function temporary(): Promise<string> {
    let path = await mkdtemp(join(tmpdir(), "macrack-"));
    directories.push(path);
    return path;
}

afterEach(async () => {
    for (let path of directories) await rm(path, { recursive: true, force: true });
    directories = [];
});

test("modified rack geometry and unrelated files are preserved", async () => {
    let root = await temporary();
    await mkdir(join(root, "candidates"));
    let step = join(root, "candidates", "hdd.step");
    let original = Buffer.from("generated STEP artifact");
    await writeFile(step, original);
    let unrelated = join(root, "notes.txt");
    await writeFile(unrelated, "owner notes");
    let manifest = join(root, "rack.json");
    await writeFile(
        manifest,
        JSON.stringify({
            schema: "macrack.rack/1",
            files: { "candidates/hdd.step": sha256Hex(original) },
        }),
    );
    await writeFile(step, "owner-edited geometry");
    await expect(invalidateRack(root)).rejects.toThrow(/modified/);
    expect(await readFile(step, "utf8")).toBe("owner-edited geometry");
    expect(await exists(manifest)).toBe(true);

    await writeFile(step, original);
    await invalidateRack(root);
    expect(await exists(step)).toBe(false);
    expect(await exists(manifest)).toBe(false);
    expect(await readFile(unrelated, "utf8")).toBe("owner notes");
});

test("rack manifest cannot claim files through symlink", async () => {
    let base = await temporary();
    let outside = join(base, "outside");
    await mkdir(outside);
    let root = join(base, "output");
    await mkdir(root);
    await symlink(outside, join(root, "source"), "dir");
    await expect(ownedPath(root, "source/rail.step")).rejects.toThrow(/escapes/);
});

test("recorded symlink cannot delete an unowned saved copy", async () => {
    let root = await temporary();
    await mkdir(join(root, "candidates"));
    let saved = join(root, "saved.step");
    await writeFile(saved, "original geometry");
    let generated = join(root, "candidates", "hdd.step");
    await symlink(saved, generated);
    let manifest = join(root, "rack.json");
    await writeFile(
        manifest,
        JSON.stringify({
            schema: "macrack.rack/1",
            files: { "candidates/hdd.step": sha256Hex(await readFile(saved)) },
        }),
    );
    await expect(invalidateRack(root)).rejects.toThrow();
    expect((await lstat(generated)).isSymbolicLink()).toBe(true);
    expect(await readFile(saved, "utf8")).toBe("original geometry");
    expect(await exists(manifest)).toBe(true);
});
