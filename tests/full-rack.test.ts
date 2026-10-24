import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, test } from "vite-plus/test";

import type { Matrix4 } from "../src/mesh/affine.ts";
import type { RackAssembly } from "../src/rack/full-assembly.ts";
import type { BayFloors } from "../src/rack/rack-components.ts";
import type { SourceProfile as Profile } from "../src/source/source-profile.ts";

import { exists } from "../src/files.ts";
import { loadParameters } from "../src/parameters.ts";
import { assembleRack, exportRack } from "../src/rack/full-assembly.ts";
import { inspectScene } from "../src/rack/rack-scene.ts";
import { SourceProfile } from "../src/source/source-profile.ts";

const SOURCE = "assets/rack-pro";
const PROFILE = join(SOURCE, "rack-pro.3mf");

describe.skipIf(!existsSync(PROFILE))("full rack", () => {
    let profile: Profile;
    let rack: RackAssembly;
    let directories: string[] = [];

    beforeAll(async () => {
        profile = await SourceProfile.open(PROFILE);
        rack = await assembleRack(SOURCE, profile, await loadParameters(), {
            railSize: "full",
            nvmeMount: "generic",
        });
    });

    afterEach(async () => {
        for (let path of directories) await rm(path, { recursive: true, force: true });
        directories = [];
    });

    test("full rack preserves clearance and reports conservative mac overlap", async () => {
        let report = await inspectScene(rack.components);
        expect(report.physical_geometry_ok).toBe(true);
        expect(
            report.reference_envelope_interferences.some(
                pair => pair.a === "mac_cradle" && pair.b === "reference_Mac_NOT_SELECTED",
            ),
        ).toBe(true);
        let allocation = rack.metadata["allocation"] as { bay_floor_z_mm: BayFloors };
        let floors = allocation.bay_floor_z_mm;
        expect(floors.mac - floors.air).toBeGreaterThanOrEqual(25);
        expect(floors.sata - floors.hdd).toBeCloseTo(50.8, 6);
    });

    test("hdd can begin front withdrawal without catching base ribs", async () => {
        let hdd = rack.components.find(part => part.name === "hdd_carrier")!;
        let frame = rack.components.filter(part => part.role === "source_frame");
        let transform: Matrix4 = hdd.transform.map(row => [...row]);
        transform[1]![3]! -= 2;
        let movingHdd = { ...hdd, transform };
        let report = await inspectScene([...frame, movingHdd]);
        expect(report.physical_geometry_ok).toBe(true);
    });

    test("short frame rejects storage, mac and cooling stack", async () => {
        await expect(
            assembleRack(SOURCE, profile, await loadParameters(), {
                railSize: "short",
                nvmeMount: "generic",
            }),
        ).rejects.toThrow();
    });

    test("occupied output directory does not publish partial rack", async () => {
        let base = await mkdtemp(join(tmpdir(), "macrack-"));
        directories.push(base);
        let output = join(base, "rack");
        await mkdir(output);
        let obstruction = join(output, "references");
        await writeFile(obstruction, "owner file");
        await expect(exportRack(SOURCE, PROFILE, await loadParameters(), output)).rejects.toThrow();
        expect(await readFile(obstruction, "utf8")).toBe("owner file");
        expect(await exists(join(output, "source"))).toBe(false);
        expect(await exists(join(output, "candidates"))).toBe(false);
        expect(await exists(join(output, "rack.json"))).toBe(false);
    });
});
