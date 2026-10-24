import { zipSync } from "fflate";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";

import type { FrameLayout } from "../src/source/rack-frame.ts";

import { determinant, isProperRigid } from "../src/mesh/affine.ts";
import { TriangleMesh } from "../src/mesh/triangle-mesh.ts";
import { measureRail } from "../src/source/frame-measurement.ts";
import { BASE_NAME, buildFrame } from "../src/source/rack-frame.ts";
import { SourceProfile } from "../src/source/source-profile.ts";

const SOURCE = resolve(import.meta.dirname, "..", "assets", "rack-pro", "rack-pro.3mf");

const CORE_NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";
const PRODUCTION_NS = "http://schemas.microsoft.com/3dmanufacturing/production/2015/06";

/** `pytest.approx`: relative 1e-6 with a 1e-12 floor, which exact zeros still satisfy. */
function expectClose(actual: readonly number[], expected: readonly number[]): void {
    expect(actual.length).toBe(expected.length);
    for (let [index, value] of actual.entries()) {
        let target = expected[index]!;
        expect(Math.abs(value - target)).toBeLessThanOrEqual(1e-6 * Math.abs(target) + 1e-12);
    }
}

function meshXml(mesh: TriangleMesh): string {
    let vertices = "";
    for (let index = 0; index < mesh.vertexCount; index += 1) {
        let [x, y, z] = [0, 1, 2].map(axis => mesh.vertices[3 * index + axis]!);
        vertices += `<vertex x="${x}" y="${y}" z="${z}"/>`;
    }
    let triangles = "";
    for (let face = 0; face < mesh.faceCount; face += 1) {
        let [a, b, c] = [0, 1, 2].map(corner => mesh.faces[3 * face + corner]!);
        triangles += `<triangle v1="${a}" v2="${b}" v3="${c}"/>`;
    }
    return `<mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh>`;
}

interface SyntheticOptions {
    readonly unit?: string;
    readonly subtype?: string;
    readonly inline?: boolean;
}

/** A one-object 3MF shaped like the vendor source: 2 mm cube, plated 100 mm off origin. */
async function write3mf(path: string, options: SyntheticOptions = {}): Promise<string> {
    let { unit = "millimeter", subtype = "normal_part", inline = false } = options;
    let cube = TriangleMesh.box([2.0, 2.0, 2.0]);
    let body = inline
        ? meshXml(cube)
        : '<components><component p:path="/3D/Objects/object_1.model" objectid="1" ' +
          'transform="1 0 0 0 1 0 0 0 1 0 0 0"/></components>';
    let model =
        '<?xml version="1.0" encoding="UTF-8"?>' +
        `<model xmlns="${CORE_NS}" xmlns:p="${PRODUCTION_NS}" unit="${unit}">` +
        '<metadata name="Title">synthetic</metadata>' +
        `<resources><object id="2" type="model">${body}</object></resources>` +
        '<build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 100 100 0"/></build>' +
        "</model>";
    let part =
        '<?xml version="1.0" encoding="UTF-8"?>' +
        `<model xmlns="${CORE_NS}" unit="${unit}">` +
        `<resources><object id="1" type="model">${meshXml(cube)}</object></resources>` +
        "</model>";
    let settings =
        '<?xml version="1.0" encoding="UTF-8"?><config>' +
        '<object id="2"><metadata key="name" value="Widget"/>' +
        `<metadata face_count="${cube.faceCount}"/>` +
        `<part id="1" subtype="${subtype}"><metadata key="name" value="Widget"/></part>` +
        "</object>" +
        '<plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value="Plate"/>' +
        '<model_instance><metadata key="object_id" value="2"/></model_instance></plate>' +
        "</config>";
    let encoder = new TextEncoder();
    await writeFile(
        path,
        zipSync({
            "3D/3dmodel.model": encoder.encode(model),
            "3D/Objects/object_1.model": encoder.encode(part),
            "Metadata/model_settings.config": encoder.encode(settings),
        }),
    );
    return path;
}

let profile: SourceProfile;
let layouts: Record<string, FrameLayout>;
let workspace: string;

beforeAll(async () => {
    profile = await SourceProfile.open(SOURCE);
    layouts = { full: buildFrame(profile, "full"), short: buildFrame(profile, "short") };
    workspace = await mkdtemp(join(tmpdir(), "macrack-"));
});

afterAll(async () => {
    await rm(workspace, { recursive: true, force: true });
});

test("reads vendor source without build placement", () => {
    expect(profile.unit).toBe("millimeter");
    expect(profile.metadata["ProfileTitle"]).toBe(
        "Rack Essentials, Mac mini M4, and Equipment Modules",
    );
    expect(profile.objectsNamed("Rail")).toEqual([2, 9, 12, 15, 18, 21]);
    expect(profile.objectsNamed("Rail - Short.stl")).toEqual([36, 37, 38, 39, 40, 41]);

    let base = profile.mesh(profile.requireObject(BASE_NAME, { instances: 1 }));
    // The plate item for this object translates it hundreds of mm; local coordinates stay centred.
    expectClose(base.bounds[0], [-87.5, -5.0, -86.3]);
    expectClose(base.bounds[1], [87.5, 5.0, 86.3]);
    expect(base.faceCount).toBe(3760);
    expect(base.isWatertight).toBe(true);

    let inventory = profile.inventory() as {
        source: { sha256: string };
        plates: { name: string }[];
        objects: { faces: number; declared_faces: number; watertight: boolean }[];
        non_printable_volumes: unknown[];
    };
    expect(inventory.source.sha256).toBe(profile.sha256);
    expect(inventory.plates.slice(0, 3).map(plate => plate.name)).toEqual([
        "Rack Rails",
        "Rack Top with Apple Logo",
        "Rack Base",
    ]);
    expect(inventory.non_printable_volumes).toEqual([]);
    for (let entry of inventory.objects) {
        expect(entry.faces).toBe(entry.declared_faces);
        expect(entry.watertight).toBe(true);
    }
});

test("rejects non millimetre units", async () => {
    let source = await write3mf(join(workspace, "inch.3mf"), { unit: "inch" });
    await expect(SourceProfile.open(source)).rejects.toThrow(/unit is 'inch'/);
});

test("rejects inline mesh and unknown object", async () => {
    await expect(
        SourceProfile.open(await write3mf(join(workspace, "inline.3mf"), { inline: true })),
    ).rejects.toThrow(/inline mesh/);
    let plain = await SourceProfile.open(await write3mf(join(workspace, "plain.3mf")));
    expect(() => plain.mesh(99)).toThrow(/no object 99/);
});

test("non printable volume is inventoried not printed", async () => {
    let negative = await SourceProfile.open(
        await write3mf(join(workspace, "negative.3mf"), { subtype: "negative_part" }),
    );
    expect(() => negative.mesh(2)).toThrow(/no printable volume/);
    expect(negative.inventory()["non_printable_volumes"]).toEqual([
        { object_id: 2, object_name: "Widget", volume: "Widget", subtype: "negative_part" },
    ]);
});

test("rail slot table is measured not assumed", () => {
    let full = measureRail(profile.mesh(2), "Rail");
    let short = measureRail(profile.mesh(36), "Rail - Short.stl");
    expect(full.slotPitch).toBeCloseTo(25.4, 4);
    expect(short.slotPitch).toBeCloseTo(25.4, 4);
    expect(full.slotFloors.length).toBe(10);
    expect(short.slotFloors.length).toBe(7);
    expect(full.slotHeight).toBeCloseTo(8.2, 4);
    expect(full.slotDepth).toBeCloseTo(4.0, 4);
});

test("frame placements are rigid rotations", () => {
    for (let layout of Object.values(layouts)) {
        let names = layout.placements.map(placement => placement.name);
        expect(names[0]).toBe("rack_base");
        expect(names.at(-1)).toBe("rack_top");
        expect(names.filter(name => name.startsWith("rail_")).length).toBe(6);
        for (let placement of layout.placements) {
            expect(determinant(placement.transform)).toBeCloseTo(1.0, 6);
            expect(isProperRigid(placement.transform)).toBe(true);
        }
    }
});

test("frame lands source geometry on measured coordinates", () => {
    let layout = layouts["full"]!;
    let placed = new Map(
        layout.placements.map(placement => [
            placement.name,
            profile.mesh(placement.objectId).transformed(placement.transform),
        ]),
    );
    expectClose(placed.get("rack_base")!.bounds[0], [-86.3, -87.5, 0.0]);
    expectClose(placed.get("rack_base")!.bounds[1], [86.3, 87.5, 10.0]);
    // Right-hand rails stand in their sockets with the slotted face turned inward.
    expectClose(placed.get("rail_right_front")!.bounds[0], [73.2, -71.9, 4.0]);
    expectClose(placed.get("rail_right_front")!.bounds[1], [83.2, -46.9, 258.0]);
    expectClose(placed.get("rail_left_rear")!.bounds[0], [-83.2, 46.9, 4.0]);
    expectClose(placed.get("rack_top")!.bounds[0], [-86.3, -75.0, 252.0]);
    expectClose(placed.get("rack_top")!.bounds[1], [86.3, 75.0, 262.0]);
});

test("frame slot table and capacity", () => {
    let [full, short] = [layouts["full"]!, layouts["short"]!];
    expectClose([full.moduleY, short.moduleY], [-72.0, -72.0]);
    expectClose(
        full.slotOrigins,
        [12.6, 38.0, 63.4, 88.8, 114.2, 139.6, 165.0, 190.4, 215.8, 241.2],
    );
    expectClose(short.slotOrigins, full.slotOrigins.slice(0, 7));
    expect(full.measurements.top.usable_ceiling_z).toBeCloseTo(252.0, 6);
    expect(short.measurements.top.usable_ceiling_z).toBeCloseTo(175.8, 6);
    // Ten slot positions, but a 1U module in the top one would run into the lid skirt.
    expect(full.measurements.bays["1U"]!.start_slots).toBe(9);
    expect(full.measurements.bays["3U"]!.start_slots).toBe(7);
    expect(short.measurements.bays["1U"]!.start_slots).toBe(6);
    expect(full.measurements.base.base_cross_ribs_y).toEqual([
        [-72.0, -46.8],
        [46.8, 72.0],
    ]);
    expect(full.measurements.base.base_rib_top_z).toBeCloseTo(4.0, 6);
    expect(full.measurements.module_interface_clearance).toEqual({
        body_half_width_mm: 0.2,
        slide_half_width_mm: 0.2,
        unit_height_mm: 0.4,
        ear_face_y: -75.0,
    });
});

test("build frame rejects changed source", () => {
    let baseId = profile.requireObject(BASE_NAME, { instances: 1 });
    let original = profile.mesh.bind(profile);
    let resized = vi.spyOn(profile, "mesh").mockImplementation(objectId => {
        let mesh = original(objectId);
        if (objectId !== baseId) return mesh;
        return mesh.transformed([
            [1.01, 0, 0, 0],
            [0, 1.01, 0, 0],
            [0, 0, 1.01, 0],
            [0, 0, 0, 1],
        ]);
    });
    try {
        expect(() => buildFrame(profile)).toThrow(/source bounds changed/);
    } finally {
        resized.mockRestore();
    }
});

test("build frame rejects unknown rail size", () => {
    expect(() => buildFrame(profile, "medium")).toThrow(/rail_size must be/);
});
