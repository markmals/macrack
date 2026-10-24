import { expect, test } from "vite-plus/test";

import type { Matrix4 } from "../src/mesh/affine.ts";
import type { SceneComponent, SceneRole } from "../src/rack/rack-scene.ts";

import { translation } from "../src/mesh/affine.ts";
import { TriangleMesh } from "../src/mesh/triangle-mesh.ts";
import { inspectScene } from "../src/rack/rack-scene.ts";

function component(name: string, role: SceneRole, x: number): SceneComponent {
    return {
        name,
        role,
        mesh: TriangleMesh.box([10, 10, 10]),
        transform: translation(x),
        file: `source/${name}.stl`,
        note: "",
    };
}

test("physical overlap fails but reference overlap remains visible", async () => {
    let rail = component("rail", "source_frame", 0);
    let tray = component("tray", "candidate", 9);
    let report = await inspectScene([rail, tray]);
    expect(report.physical_geometry_ok).toBe(false);
    expect(report.physical_interferences[0]!.common_volume_mm3).toBeCloseTo(100, 6);

    let envelope = component("device_envelope", "reference", 9);
    report = await inspectScene([rail, envelope]);
    expect(report.physical_geometry_ok).toBe(true);
    expect(report.reference_envelope_interferences[0]!.common_volume_mm3).toBeCloseTo(100, 6);
});

test("airflow reservation excludes physical parts but allows face contact", async () => {
    let tray = component("tray", "candidate", 0);
    let air = component("air", "reservation", 10);
    expect((await inspectScene([tray, air])).physical_geometry_ok).toBe(true);
    let overlappingAir = component("blocked_air", "reservation", 9);
    expect((await inspectScene([tray, overlappingAir])).physical_geometry_ok).toBe(false);
});

test("scene dimensions use transformed geometry", async () => {
    let matrix: Matrix4 = [
        [0, -1, 0, 20],
        [1, 0, 0, -30],
        [0, 0, 1, 40],
        [0, 0, 0, 1],
    ];
    let part: SceneComponent = {
        name: "rotated",
        role: "source_frame",
        mesh: TriangleMesh.box([10, 20, 30]),
        transform: matrix,
        file: "source/rail.stl",
        note: "",
    };
    let report = await inspectScene([part]);
    let expected = [
        [10, -35, 25],
        [30, -25, 55],
    ];
    for (let [corner, values] of expected.entries()) {
        for (let [axis, value] of values.entries()) {
            expect(report.bounds_mm[corner]![axis]!).toBeCloseTo(value, 6);
        }
    }
    expect(report.components[0]!.volume_mm3).toBeCloseTo(6000, 6);
});

test.for([
    [
        [-1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
    ],
    [
        [2, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
    ],
])("scene rejects transforms FreeCAD placement cannot preserve", async (matrix: Matrix4) => {
    let part: SceneComponent = {
        name: "unsupported_transform",
        role: "source_frame",
        mesh: TriangleMesh.box([10, 10, 10]),
        transform: matrix,
        file: "source/rail.stl",
        note: "",
    };
    await expect(inspectScene([part])).rejects.toThrow(/proper rigid transform/);
});

test("reference overlap with airflow is reported", async () => {
    let device = component("device", "reference", 0);
    let neighbor = component("air", "reservation", 9);
    let report = await inspectScene([device, neighbor]);
    expect(report.reference_envelopes_clear).toBe(false);
    expect(report.reference_envelope_interferences[0]!.common_volume_mm3).toBeCloseTo(100, 6);
});
