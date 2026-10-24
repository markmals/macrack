import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";

import type { Vector3 } from "../src/mesh/affine.ts";
import type { Envelope, Parameters } from "../src/parameters.ts";
import type { Artifact } from "../src/study/artifact.ts";
import type { Assembly } from "../src/study/assembly.ts";

import { checkDevice } from "../src/carriers/carrier.ts";
import { block, interfaceCheck, template } from "../src/carriers/rack-interface.ts";
import { DEFAULT_DESIGN, DEFAULT_PARAMETERS, loadParameters } from "../src/parameters.ts";
import { artifact, placed } from "../src/study/artifact.ts";
import { buildAssembly } from "../src/study/assembly.ts";
import { validateArtifacts } from "../src/study/validation.ts";

const SOURCE = resolve(import.meta.dirname, "..", "assets", "rack-pro");

let assembly: Assembly;
let workspaces: string[] = [];

beforeAll(async () => {
    assembly = await buildAssembly(SOURCE, DEFAULT_PARAMETERS);
});

afterAll(async () => {
    for (let directory of workspaces) await rm(directory, { recursive: true, force: true });
});

async function workspace(): Promise<string> {
    let directory = await mkdtemp(join(tmpdir(), "macrack-"));
    workspaces.push(directory);
    return directory;
}

function byName(artifacts: readonly Artifact[]): Map<string, Artifact> {
    return new Map(artifacts.map(part => [part.name, part]));
}

test("reference assembly preserves source and air gap", async () => {
    let { artifacts, metadata } = assembly;
    expect(validateArtifacts(artifacts).ok).toBe(true);
    let parts = byName(artifacts);
    for (let [name, units] of [
        ["hdd_carrier", 2],
        ["sata_ssd_carrier", 1],
        ["dual_nvme_carrier", 1],
    ] as const) {
        let shape = parts.get(name)!.shape;
        await interfaceCheck(shape, SOURCE, units, 3);
        expect(shape.boundingBox.size.x).toBeCloseTo(166.8, 6);
        expect(shape.isValid).toBe(true);
        expect(shape.solids.length).toBe(1);
        let floorProbe = block(4, 4, 3, { y: 40 });
        expect(shape.intersect(floorProbe)!.volume).toBeCloseTo(floorProbe.volume, 6);
    }
    let cooling = placed(parts.get("Mac_1U_airflow_reservation")!).boundingBox;
    let nvme = placed(parts.get("dual_nvme_carrier")!).boundingBox;
    expect(cooling.min.z).toBeCloseTo(nvme.max.z, 6);
    expect(cooling.size.z).toBeCloseTo(25, 6);
    expect(metadata.allocation.total_U).toBe(8);
    expect(placed(parts.get("hdd_carrier")!).boundingBox.min.z).toBeCloseTo(0, 6);
});

for (let addedMaterial of [false, true]) {
    test(`interface check rejects damaged slide (added material: ${addedMaterial})`, async () => {
        let shape = assembly.artifacts.find(part => part.name === "sata_ssd_carrier")!.shape;
        let probe = block(4, 10, 4, { x: 76, y: 30, z: 2 });
        let damaged = addedMaterial ? shape.union(probe) : shape.subtract(probe);
        await expect(interfaceCheck(damaged, SOURCE, 1, 3)).rejects.toThrow(
            /Rack interface changed/,
        );
    });
}

test("source pockets are blind and absent on 1U", async () => {
    let pocketProbe = block(1, 1, 1, { x: 75, y: 12, z: 3.5 });
    let backingProbe = block(1, 1, 1, { x: 72, y: 12, z: 3.5 });
    expect((await template(SOURCE, 1)).intersect(pocketProbe)!.volume).toBeCloseTo(1, 6);
    let pocketMaterial = (await template(SOURCE, 2)).intersect(pocketProbe);
    expect(pocketMaterial === undefined || pocketMaterial.volume < 1e-6).toBe(true);
    expect((await template(SOURCE, 2)).intersect(backingProbe)!.volume).toBeCloseTo(1, 6);
});

test("oversized devices require more units and space", () => {
    expect(() => checkDevice({ ...DEFAULT_PARAMETERS.hdd, height: 45 }, DEFAULT_DESIGN, 2)).toThrow(
        /at least 3U/,
    );
    let owc: Envelope = {
        width: 71.1,
        depth: 132,
        height: 22.8,
        source: "OWC reference",
        status: "provisional",
    };
    expect(() => checkDevice(owc, DEFAULT_DESIGN, 2, { count: 2 })).toThrow(/carrier has/);
});

test("taller hdd moves every bay without losing cooling", async () => {
    let parameters: Parameters = {
        ...DEFAULT_PARAMETERS,
        design: { ...DEFAULT_DESIGN, hddUnits: 3 },
        hdd: { ...DEFAULT_PARAMETERS.hdd, height: 45 },
    };
    let { artifacts, metadata } = await buildAssembly(SOURCE, parameters);
    expect(validateArtifacts(artifacts).ok).toBe(true);
    let parts = byName(artifacts);
    expect(parts.get("sata_ssd_carrier")!.position[2]).toBeCloseTo(83, 6);
    expect(parts.get("Mac_1U_airflow_reservation")!.position[2]).toBeCloseTo(133, 6);
    expect(metadata.allocation.total_U).toBe(9);
});

test("explicit nvme envelopes are checked as devices", async () => {
    // Synthetic dimensions exercise the configurable path; they are not hardware defaults.
    let nvme: Envelope = {
        width: 40,
        depth: 110,
        height: 12,
        source: "test fixture",
        status: "provisional",
    };
    let { artifacts } = await buildAssembly(SOURCE, { ...DEFAULT_PARAMETERS, nvme });
    expect(validateArtifacts(artifacts).ok).toBe(true);
    let devices = byName(artifacts.filter(part => part.name.startsWith("nvme_enclosure_")));
    expect(devices.get("nvme_enclosure_1")!.position[0]).toBeCloseTo(-20.5, 6);
    expect(placed(devices.get("nvme_enclosure_2")!).boundingBox.size.y).toBeCloseTo(110, 6);
});

test("collision validation rejects overlap but allows contact", () => {
    let first = artifact("first", block(10, 10, 10));
    let touching = artifact("touching", block(10, 10, 10), { position: [10, 0, 0] });
    expect(validateArtifacts([first, touching]).ok).toBe(true);
    let overlapping: Artifact = { ...touching, position: [9, 0, 0] as Vector3 };
    let report = validateArtifacts([first, overlapping]);
    expect(report.ok).toBe(false);
    expect(report.interference.pairs[0]!.common_volume_mm3).toBeCloseTo(100, 6);
});

for (let settings of [
    "[design]\nfloor = nan\n",
    "[design]\nhdd_units = 2.0\n",
    "[nvme]\nwidth = 40\n",
    "[design]\nside_wall = 1\n",
    "[unknown]\nwidth = 4\n",
    "[sata]\nsource = 12\n",
]) {
    test(`invalid configuration is rejected: ${JSON.stringify(settings)}`, async () => {
        let path = join(await workspace(), "invalid.toml");
        await writeFile(path, settings);
        await expect(loadParameters(path)).rejects.toThrow();
    });
}

test("vent parameters must leave room for floor openings", async () => {
    let parameters: Parameters = {
        ...DEFAULT_PARAMETERS,
        design: { ...DEFAULT_DESIGN, ventWidth: 90, ventPitch: 94 },
    };
    await expect(buildAssembly(SOURCE, parameters)).rejects.toThrow(/vent/);
});

test("strap positions must remain separate", async () => {
    let parameters: Parameters = {
        ...DEFAULT_PARAMETERS,
        sata: { ...DEFAULT_PARAMETERS.sata, depth: 20 },
    };
    await expect(buildAssembly(SOURCE, parameters)).rejects.toThrow(/strap/);
});
