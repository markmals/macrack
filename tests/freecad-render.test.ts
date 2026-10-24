import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";

import { sha256Hex } from "../src/digest.ts";
import { renderRack } from "../src/freecad/rack-render.ts";

let directories: string[] = [];

afterEach(async () => {
    for (let directory of directories) await rm(directory, { force: true, recursive: true });
    directories = [];
});

async function workspace(): Promise<string> {
    let directory = await mkdtemp(join(tmpdir(), "macrack-"));
    directories.push(directory);
    return directory;
}

test("a failed renderer preserves completed artifacts and the manifest", async () => {
    let root = await workspace();
    let previous = join(root, "rack.step");
    await writeFile(previous, "previous completed export");
    let manifestPath = join(root, "rack.json");
    await writeFile(
        manifestPath,
        JSON.stringify({
            schema: "macrack.rack/1",
            validation: { physical_geometry_ok: true },
            geometry: {},
            files: { "rack.step": sha256Hex("previous completed export") },
        }),
    );
    let original = await readFile(manifestPath, "utf8");

    await expect(
        renderRack(manifestPath, {
            renderer: async context => {
                await writeFile(join(context.staging, "rack.step"), "partial export");
                throw new Error("CAD export failed");
            },
        }),
    ).rejects.toThrow("CAD export failed");

    expect(await readFile(previous, "utf8")).toBe("previous completed export");
    expect(await readFile(manifestPath, "utf8")).toBe(original);
});
