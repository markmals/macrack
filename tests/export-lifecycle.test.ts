import { Compound } from "@roonieone/caddy";
import { existsSync } from "node:fs";
import {
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    rename,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vite-plus/test";

import type { Artifact } from "../src/study/artifact.ts";

import { block } from "../src/carriers/rack-interface.ts";
import { main } from "../src/cli.ts";
import { MacrackError } from "../src/errors.ts";
import { artifact } from "../src/study/artifact.ts";
import { ExportError, exportProject } from "../src/study/export.ts";

let workspaces: string[] = [];

afterAll(async () => {
    for (let directory of workspaces) await rm(directory, { recursive: true, force: true });
});

async function workspace(): Promise<string> {
    let directory = await mkdtemp(join(tmpdir(), "macrack-"));
    workspaces.push(directory);
    return directory;
}

function smallPart(): Artifact {
    return artifact("fixture", block(10, 12, 3));
}

/** The error a failing export threw, so one run can be checked for both type and message. */
async function rejection(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof Error) return error;
        throw error;
    }
    throw new Error("the export was expected to fail");
}

test("rebuild preserves foreign cad files", async () => {
    let output = await workspace();
    let part = smallPart();
    await exportProject([part], [], output, {});
    let foreign = join(output, "parts", "unrelated.step");
    await writeFile(foreign, "user-owned geometry");
    await exportProject([part], [], output, {});
    expect(await readFile(foreign, "utf8")).toBe("user-owned geometry");
});

test("duplicate coupon names cannot overwrite manifest records", async () => {
    let output = await workspace();
    let coupon = artifact("coupon", block(3, 4, 5));
    let other: Artifact = { ...coupon, shape: block(6, 4, 5) };
    let error = await rejection(exportProject([smallPart()], [coupon, other], output, {}));
    expect(error).toBeInstanceOf(ExportError);
    expect(error.message).toMatch(/duplicate coupon/);
    expect(existsSync(join(output, "coupons", "coupon.step"))).toBe(false);
});

test("rebuild invalidates old independent inspection", async () => {
    let output = await workspace();
    await exportProject([smallPart()], [], output, {});
    let report = join(output, "freecad-report.json");
    await writeFile(report, JSON.stringify({ schema: "macrack.freecad-inspect/1", ok: true }));
    let taller: Artifact = { ...smallPart(), shape: block(10, 12, 6) };
    await exportProject([taller], [], output, {});
    expect(existsSync(report)).toBe(false);
});

test("failed configuration does not leave previous print files", async () => {
    let output = await workspace();
    await exportProject([smallPart()], [], output, {});
    let config = join(output, "invalid.toml");
    await writeFile(config, "[design]\nhdd_units = 4\n");
    expect(await main(["build", "--config", config, "--output", output])).toBe(2);
    expect(existsSync(join(output, "manifest.json"))).toBe(false);
    expect(existsSync(join(output, "assembly.step"))).toBe(false);
    expect(existsSync(join(output, "parts", "fixture.stl"))).toBe(false);
});

test("modified generated geometry is preserved", async () => {
    let output = await workspace();
    await exportProject([smallPart()], [], output, {});
    let modified = join(output, "parts", "fixture.step");
    await writeFile(modified, "user-modified geometry");
    let error = await rejection(exportProject([smallPart()], [], output, {}));
    expect(error).toBeInstanceOf(MacrackError);
    expect(error.message).toMatch(/modified/);
    expect(await readFile(modified, "utf8")).toBe("user-modified geometry");
    expect(existsSync(join(output, "manifest.json"))).toBe(true);
});

test("unowned target cannot be overwritten", async () => {
    let output = await workspace();
    await mkdir(join(output, "parts"));
    let foreign = join(output, "parts", "fixture.step");
    await writeFile(foreign, "user-owned geometry");
    let error = await rejection(exportProject([smallPart()], [], output, {}));
    expect(error).toBeInstanceOf(ExportError);
    expect(error.message).toMatch(/unowned/);
    expect(await readFile(foreign, "utf8")).toBe("user-owned geometry");
});

test("assembly collision leaves no partial parts", async () => {
    let output = await workspace();
    let foreign = join(output, "assembly.step");
    await writeFile(foreign, "user-owned assembly");
    let error = await rejection(exportProject([smallPart()], [], output, {}));
    expect(error).toBeInstanceOf(ExportError);
    expect(error.message).toMatch(/unowned/);
    expect(await readFile(foreign, "utf8")).toBe("user-owned assembly");
    expect(existsSync(join(output, "parts", "fixture.step"))).toBe(false);
});

test("invalid coupon does not publish partial exports", async () => {
    let output = await workspace();
    let coupon = artifact(
        "disconnected",
        new Compound([block(2, 2, 2), block(2, 2, 2, { x: 10 })]),
    );
    let error = await rejection(exportProject([smallPart()], [coupon], output, {}));
    expect(error).toBeInstanceOf(ExportError);
    expect(error.message).toMatch(/single solid/);
    expect(existsSync(join(output, "parts", "fixture.step"))).toBe(false);
    expect(existsSync(join(output, "coupons", "disconnected.stl"))).toBe(false);
});

test("directory collision is rejected before any publication", async () => {
    let output = await workspace();
    let foreign = join(output, "coupons");
    await writeFile(foreign, "user-owned file");
    let coupon = artifact("coupon", block(3, 4, 5));
    let error = await rejection(exportProject([smallPart()], [coupon], output, {}));
    expect(error).toBeInstanceOf(ExportError);
    expect(error.message).toMatch(/directory/);
    expect(await readFile(foreign, "utf8")).toBe("user-owned file");
    expect(existsSync(join(output, "assembly.step"))).toBe(false);
    expect(existsSync(join(output, "parts", "fixture.step"))).toBe(false);
});

test("symlinked part directory cannot publish exports outside the output", async () => {
    let root = await workspace();
    let output = join(root, "output");
    let outside = join(root, "outside");
    await mkdir(output);
    await mkdir(outside);
    await symlink(outside, join(output, "parts"));
    let error = await rejection(exportProject([smallPart()], [], output, {}));
    expect(error).toBeInstanceOf(ExportError);
    expect(error.message).toMatch(/escapes output directory/);
    expect(await readdir(outside)).toEqual([]);
});

test("rebuild through a symlinked part directory deletes nothing outside the output", async () => {
    let root = await workspace();
    let output = join(root, "output");
    await exportProject([smallPart()], [], output, {});
    let outside = join(root, "outside");
    await rename(join(output, "parts"), outside);
    await symlink(outside, join(output, "parts"));
    await expect(exportProject([smallPart()], [], output, {})).rejects.toThrow(/escapes output/);
    expect((await readdir(outside)).toSorted()).toEqual(["fixture.step", "fixture.stl"]);
    expect(existsSync(join(output, "manifest.json"))).toBe(true);
});
