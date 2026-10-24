import type { Shape } from "@roonieone/caddy";
import type { Manifold, Mat4, ManifoldToplevel } from "manifold-3d";

import Module from "manifold-3d";

import type { Matrix4, Vector3 } from "../mesh/affine.ts";
import type { Bounds } from "../mesh/triangle-mesh.ts";

import { MacrackError } from "../errors.ts";
import { entry, isProperRigid } from "../mesh/affine.ts";
import { TriangleMesh } from "../mesh/triangle-mesh.ts";

export const PHYSICAL_ROLES = ["source_frame", "source_module", "candidate"] as const;
export const ROLES = [...PHYSICAL_ROLES, "reference", "reservation"] as const;
export type SceneRole = (typeof ROLES)[number];

/** Faces that touch share surface, not volume; only a thicker overlap is an interference. */
export const INTERSECTION_TOLERANCE_MM3 = 0.01;
export const CANDIDATE_TESSELLATION_TOLERANCE_MM = 0.02;

const LIMITATIONS = [
    "Mesh noninterference is not a physical rail-fit, structural or print validation.",
    "Reference envelopes are conservative stand-ins, not vendor component CAD.",
    "Reference intersections remain unresolved until exact hardware geometry is known.",
    "Unselected bridges, cables, fasteners and supplies are absent from these checks.",
];

export interface SceneComponent {
    readonly name: string;
    readonly role: SceneRole;
    /** Geometry in its own coordinates; `transform` puts it in the rack. */
    readonly mesh: TriangleMesh;
    readonly transform: Matrix4;
    readonly file: string;
    readonly note: string;
}

export interface ComponentRecord {
    readonly name: string;
    readonly role: string;
    readonly file: string;
    readonly transform: Matrix4;
    readonly note: string;
    readonly bounds_mm: Bounds;
    readonly volume_mm3: number;
    readonly watertight: boolean;
    readonly triangles: number;
}

export interface Interference {
    readonly a: string;
    readonly b: string;
    readonly common_volume_mm3: number;
}

export interface SceneReport {
    readonly method: string;
    readonly intersection_tolerance_mm3: number;
    readonly candidate_tessellation_tolerance_mm: number;
    readonly physical_geometry_ok: boolean;
    readonly physical_interferences: Interference[];
    readonly reference_envelope_interferences: Interference[];
    readonly reference_envelopes_clear: boolean;
    readonly pairs_evaluated: number;
    readonly bounds_mm: Bounds;
    readonly size_mm: Vector3;
    readonly components: ComponentRecord[];
    readonly limitations: string[];
}

export function placedMesh(component: SceneComponent): TriangleMesh {
    if (!isProperRigid(component.transform)) {
        throw new MacrackError(
            `${component.name}: FreeCAD placement requires a proper rigid transform`,
        );
    }
    return component.mesh.transformed(component.transform);
}

export async function cadMesh(shape: Shape): Promise<TriangleMesh> {
    let tessellation = await shape.tessellate(CANDIDATE_TESSELLATION_TOLERANCE_MM, {
        angularTolerance: 0.1,
    });
    let positions = new Float64Array(tessellation.vertices.length * 3);
    for (let [index, vertex] of tessellation.vertices.entries()) {
        positions.set(vertex.toTuple(), 3 * index);
    }
    let triangles = new Uint32Array(tessellation.triangles.length * 3);
    for (let [index, triangle] of tessellation.triangles.entries()) {
        triangles.set(triangle, 3 * index);
    }
    return TriangleMesh.welded(positions, triangles);
}

let loaded: Promise<ManifoldToplevel> | undefined;

/** The Manifold WASM module, instantiated once per process. */
export function manifold(): Promise<ManifoldToplevel> {
    loaded ??= Module().then(wasm => {
        wasm.setup();
        return wasm;
    });
    return loaded;
}

/** Manifold reads a 4×4 in column-major order; ours are rows, and it ignores the last one. */
function columnMajor(matrix: Matrix4): Mat4 {
    let values = Array.from({ length: 16 }, (_, index) =>
        entry(matrix, index % 4, Math.floor(index / 4)),
    );
    return values as Mat4;
}

function failureStatus(error: unknown): string {
    let code: unknown = error instanceof Error ? Reflect.get(error, "code") : undefined;
    return typeof code === "string" ? code : String(error);
}

/**
 * A Manifold solid holding `mesh` placed by `placement`. Manifold's JavaScript meshes carry
 * float32 coordinates, so the placement is left to Manifold, which transforms in double
 * precision: only the part's own geometry is rounded, never its position in the rack.
 */
export function meshSolid(
    wasm: ManifoldToplevel,
    mesh: TriangleMesh,
    placement: Matrix4 | null,
): Manifold {
    let local;
    try {
        local = new wasm.Manifold(
            new wasm.Mesh({
                numProp: 3,
                vertProperties: Float32Array.from(mesh.vertices),
                triVerts: mesh.faces,
            }),
        );
    } catch (error) {
        throw new MacrackError(`Mesh Boolean input is invalid: ${failureStatus(error)}`);
    }
    let status = local.status();
    if (status !== "NoError") {
        local.delete();
        throw new MacrackError(`Mesh Boolean input is invalid: ${status}`);
    }
    if (placement === null) return local;
    let placed = local.transform(columnMajor(placement));
    local.delete();
    return placed;
}

function boundsOverlap(first: Bounds, second: Bounds): boolean {
    return [0, 1, 2].every(
        axis =>
            Math.min(first[1][axis]!, second[1][axis]!) >
            Math.max(first[0][axis]!, second[0][axis]!),
    );
}

/** The shared volume of two solids, or `NaN` when Manifold cannot compute one. */
function commonVolume(wasm: ManifoldToplevel, first: Manifold, second: Manifold): number {
    let common: Manifold | undefined;
    try {
        common = wasm.Manifold.intersection([first, second]);
        return common.status() === "NoError" ? common.volume() : Number.NaN;
    } catch {
        return Number.NaN;
    } finally {
        common?.delete();
    }
}

interface Interferences {
    readonly physical: Interference[];
    readonly reference: Interference[];
    readonly evaluated: number;
}

function interferences(
    wasm: ManifoldToplevel,
    components: readonly SceneComponent[],
    bounds: readonly Bounds[],
    solids: readonly Manifold[],
): Interferences {
    let physical: Interference[] = [];
    let reference: Interference[] = [];
    let evaluated = 0;
    for (let a = 0; a < components.length; a += 1) {
        for (let b = a + 1; b < components.length; b += 1) {
            let first = components[a]!;
            let second = components[b]!;
            if (first.role === "reservation" && second.role === "reservation") continue;
            if (!boundsOverlap(bounds[a]!, bounds[b]!)) continue;
            let volume = commonVolume(wasm, solids[a]!, solids[b]!);
            if (Number.isNaN(volume)) {
                throw new MacrackError(`Intersection failed for ${first.name} and ${second.name}`);
            }
            evaluated += 1;
            if (volume <= INTERSECTION_TOLERANCE_MM3) continue;
            let pair = { a: first.name, b: second.name, common_volume_mm3: volume };
            if (first.role === "reference" || second.role === "reference") reference.push(pair);
            else physical.push(pair);
        }
    }
    return { physical, reference, evaluated };
}

function record(component: SceneComponent, mesh: TriangleMesh): ComponentRecord {
    return {
        name: component.name,
        role: component.role,
        file: component.file,
        transform: component.transform,
        note: component.note,
        bounds_mm: mesh.bounds,
        volume_mm3: mesh.volume,
        watertight: mesh.isWatertight,
        triangles: mesh.faceCount,
    };
}

function sceneBounds(bounds: readonly Bounds[]): Bounds {
    let minimum: Vector3 = [Infinity, Infinity, Infinity];
    let maximum: Vector3 = [-Infinity, -Infinity, -Infinity];
    for (let [low, high] of bounds) {
        for (let axis = 0; axis < 3; axis += 1) {
            minimum[axis] = Math.min(minimum[axis]!, low[axis]!);
            maximum[axis] = Math.max(maximum[axis]!, high[axis]!);
        }
    }
    return [minimum, maximum];
}

function sceneReport(
    records: ComponentRecord[],
    bounds: readonly Bounds[],
    found: Interferences,
): SceneReport {
    let [minimum, maximum] = sceneBounds(bounds);
    return {
        method:
            "Manifold triangle-mesh intersection; float32 part geometry placed by its exact " +
            "transform in double precision, source tessellation retained",
        intersection_tolerance_mm3: INTERSECTION_TOLERANCE_MM3,
        candidate_tessellation_tolerance_mm: CANDIDATE_TESSELLATION_TOLERANCE_MM,
        physical_geometry_ok: found.physical.length === 0,
        physical_interferences: found.physical,
        reference_envelope_interferences: found.reference,
        reference_envelopes_clear: found.reference.length === 0,
        pairs_evaluated: found.evaluated,
        bounds_mm: [minimum, maximum],
        size_mm: [maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2]],
        components: records,
        limitations: [...LIMITATIONS],
    };
}

export async function inspectScene(components: readonly SceneComponent[]): Promise<SceneReport> {
    if (new Set(components.map(component => component.name)).size !== components.length) {
        throw new MacrackError("Rack scene contains duplicate component names");
    }
    let wasm = await manifold();
    let bounds: Bounds[] = [];
    let records: ComponentRecord[] = [];
    let solids: Manifold[] = [];
    try {
        for (let component of components) {
            if (!(ROLES as readonly string[]).includes(component.role)) {
                throw new MacrackError(`Unknown rack component role: ${component.role}`);
            }
            let mesh = placedMesh(component);
            if (!mesh.isVolume) {
                throw new MacrackError(
                    `${component.name}: expected a finite, watertight positive-volume mesh`,
                );
            }
            bounds.push(mesh.bounds);
            records.push(record(component, mesh));
            solids.push(meshSolid(wasm, component.mesh, component.transform));
        }
        return sceneReport(records, bounds, interferences(wasm, components, bounds, solids));
    } finally {
        for (let solid of solids) solid.delete();
    }
}
