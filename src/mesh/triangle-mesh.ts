import type { Matrix4, Vector3 } from "./affine.ts";

import { determinant, entry } from "./affine.ts";

export type Bounds = [min: Vector3, max: Vector3];

/** Vertices closer than this are one vertex when a triangle soup is welded (trimesh's merge). */
const WELD_SCALE = 1e8;

/**
 * An indexed triangle mesh in mm. Instances are never mutated: every transform returns a new
 * mesh, so a cached mesh can be shared freely.
 */
export class TriangleMesh {
    /** xyz triples. */
    readonly vertices: Float64Array;
    /** Vertex-index triples, wound counter-clockwise seen from outside. */
    readonly faces: Uint32Array;

    #edges: { watertight: boolean; windingConsistent: boolean } | undefined;

    constructor(vertices: Float64Array, faces: Uint32Array) {
        if (vertices.length % 3 !== 0 || faces.length % 3 !== 0) {
            throw new RangeError("mesh vertices and faces must be triples");
        }
        let vertexCount = vertices.length / 3;
        if (faces.some(index => index >= vertexCount)) {
            throw new RangeError("mesh face refers to a missing vertex");
        }
        this.vertices = vertices;
        this.faces = faces;
    }

    /**
     * A mesh from a triangle soup or a per-face tessellation, with coincident vertices merged so
     * that shared edges are shared indices (trimesh's `process=True`).
     */
    static welded(positions: ArrayLike<number>, triangles: ArrayLike<number>): TriangleMesh {
        let indexOf = new Map<string, number>();
        let vertices: number[] = [];
        let remap = new Uint32Array(positions.length / 3);
        for (let vertex = 0; vertex < remap.length; vertex += 1) {
            let x = positions[3 * vertex] ?? Number.NaN;
            let y = positions[3 * vertex + 1] ?? Number.NaN;
            let z = positions[3 * vertex + 2] ?? Number.NaN;
            let key = `${Math.round(x * WELD_SCALE)},${Math.round(y * WELD_SCALE)},${Math.round(z * WELD_SCALE)}`;
            let index = indexOf.get(key);
            if (index === undefined) {
                index = vertices.length / 3;
                indexOf.set(key, index);
                vertices.push(x, y, z);
            }
            remap[vertex] = index;
        }
        let faces = Uint32Array.from(triangles, index => remap[index] ?? Number.NaN);
        return new TriangleMesh(Float64Array.from(vertices), faces);
    }

    /** An axis-aligned box centred on the origin, like `trimesh.creation.box(extents)`. */
    static box(extents: Vector3): TriangleMesh {
        let [x, y, z] = extents.map(value => value / 2) as Vector3;
        let corners = [
            [-x, -y, -z],
            [x, -y, -z],
            [x, y, -z],
            [-x, y, -z],
            [-x, -y, z],
            [x, -y, z],
            [x, y, z],
            [-x, y, z],
        ].flat();
        let faces = [
            [0, 2, 1, 0, 3, 2],
            [4, 5, 6, 4, 6, 7],
            [0, 1, 5, 0, 5, 4],
            [1, 2, 6, 1, 6, 5],
            [2, 3, 7, 2, 7, 6],
            [3, 0, 4, 3, 4, 7],
        ].flat();
        return new TriangleMesh(Float64Array.from(corners), Uint32Array.from(faces));
    }

    /** One mesh holding every input's triangles; vertices are not merged. */
    static concatenate(meshes: readonly TriangleMesh[]): TriangleMesh {
        let vertices = new Float64Array(
            meshes.reduce((sum, mesh) => sum + mesh.vertices.length, 0),
        );
        let faces = new Uint32Array(meshes.reduce((sum, mesh) => sum + mesh.faces.length, 0));
        let vertexOffset = 0;
        let faceOffset = 0;
        for (let mesh of meshes) {
            vertices.set(mesh.vertices, vertexOffset);
            for (let index = 0; index < mesh.faces.length; index += 1) {
                faces[faceOffset + index] = (mesh.faces[index] ?? 0) + vertexOffset / 3;
            }
            vertexOffset += mesh.vertices.length;
            faceOffset += mesh.faces.length;
        }
        return new TriangleMesh(vertices, faces);
    }

    get vertexCount(): number {
        return this.vertices.length / 3;
    }

    get faceCount(): number {
        return this.faces.length / 3;
    }

    /** Coordinate `axis` of corner `corner` (0..2) of face `face`. */
    coordinate(face: number, corner: number, axis: number): number {
        let vertex = this.faces[3 * face + corner] ?? Number.NaN;
        return this.vertices[3 * vertex + axis] ?? Number.NaN;
    }

    get bounds(): Bounds {
        let min: Vector3 = [Infinity, Infinity, Infinity];
        let max: Vector3 = [-Infinity, -Infinity, -Infinity];
        for (let index = 0; index < this.vertices.length; index += 1) {
            let value = this.vertices[index] ?? Number.NaN;
            let axis = index % 3;
            if (value < min[axis]!) min[axis] = value;
            if (value > max[axis]!) max[axis] = value;
        }
        return [min, max];
    }

    get extents(): Vector3 {
        let [min, max] = this.bounds;
        return [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    }

    /** Unnormalised cross product of each face's edge vectors: its normal times twice its area. */
    #crossProducts(): Float64Array {
        let crosses = new Float64Array(this.faces.length);
        for (let face = 0; face < this.faceCount; face += 1) {
            let a = (axis: number) => this.coordinate(face, 0, axis);
            let u = [0, 1, 2].map(axis => this.coordinate(face, 1, axis) - a(axis));
            let v = [0, 1, 2].map(axis => this.coordinate(face, 2, axis) - a(axis));
            let [u0 = 0, u1 = 0, u2 = 0] = u;
            let [v0 = 0, v1 = 0, v2 = 0] = v;
            crosses[3 * face] = u1 * v2 - u2 * v1;
            crosses[3 * face + 1] = u2 * v0 - u0 * v2;
            crosses[3 * face + 2] = u0 * v1 - u1 * v0;
        }
        return crosses;
    }

    /** Unit normal triples; a degenerate face gets a zero normal. */
    get faceNormals(): Float64Array {
        let normals = this.#crossProducts();
        for (let face = 0; face < this.faceCount; face += 1) {
            let length = Math.hypot(
                normals[3 * face]!,
                normals[3 * face + 1]!,
                normals[3 * face + 2]!,
            );
            for (let axis = 0; axis < 3; axis += 1) {
                normals[3 * face + axis] = length > 0 ? normals[3 * face + axis]! / length : 0;
            }
        }
        return normals;
    }

    get faceAreas(): Float64Array {
        let crosses = this.#crossProducts();
        return Float64Array.from(
            { length: this.faceCount },
            (_, face) =>
                Math.hypot(crosses[3 * face]!, crosses[3 * face + 1]!, crosses[3 * face + 2]!) / 2,
        );
    }

    /** Signed enclosed volume; positive for a closed, outward-wound mesh. */
    get volume(): number {
        let sum = 0;
        for (let face = 0; face < this.faceCount; face += 1) {
            let [ax, ay, az] = [0, 1, 2].map(axis => this.coordinate(face, 0, axis)) as Vector3;
            let [bx, by, bz] = [0, 1, 2].map(axis => this.coordinate(face, 1, axis)) as Vector3;
            let [cx, cy, cz] = [0, 1, 2].map(axis => this.coordinate(face, 2, axis)) as Vector3;
            sum += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
        }
        return sum / 6;
    }

    #edgeFacts(): { watertight: boolean; windingConsistent: boolean } {
        if (this.#edges !== undefined) return this.#edges;
        let uses = new Map<string, number>();
        let forwardUses = new Map<string, number>();
        for (let face = 0; face < this.faceCount; face += 1) {
            for (let corner = 0; corner < 3; corner += 1) {
                let from = this.faces[3 * face + corner]!;
                let to = this.faces[3 * face + ((corner + 1) % 3)]!;
                let key = from < to ? `${from},${to}` : `${to},${from}`;
                uses.set(key, (uses.get(key) ?? 0) + 1);
                if (from < to) forwardUses.set(key, (forwardUses.get(key) ?? 0) + 1);
            }
        }
        let watertight = this.faceCount > 0;
        let windingConsistent = this.faceCount > 0;
        for (let [key, count] of uses) {
            if (count !== 2) watertight = false;
            else if (forwardUses.get(key) !== 1) windingConsistent = false;
        }
        this.#edges = { watertight, windingConsistent };
        return this.#edges;
    }

    /** Every edge is shared by exactly two faces. */
    get isWatertight(): boolean {
        return this.#edgeFacts().watertight;
    }

    /** Every edge shared by two faces is traversed in opposite directions by them. */
    get isWindingConsistent(): boolean {
        return this.#edgeFacts().windingConsistent;
    }

    /** A closed, consistently wound, finite mesh enclosing positive volume (trimesh `is_volume`). */
    get isVolume(): boolean {
        return (
            this.isWatertight &&
            this.isWindingConsistent &&
            this.vertices.every(Number.isFinite) &&
            this.volume > 0
        );
    }

    /** A copy with `matrix` applied; a reflecting transform also flips the faces outward again. */
    transformed(matrix: Matrix4): TriangleMesh {
        let vertices = new Float64Array(this.vertices.length);
        for (let vertex = 0; vertex < this.vertexCount; vertex += 1) {
            let point = [0, 1, 2].map(axis => this.vertices[3 * vertex + axis]!);
            for (let row = 0; row < 3; row += 1) {
                vertices[3 * vertex + row] =
                    entry(matrix, row, 0) * point[0]! +
                    entry(matrix, row, 1) * point[1]! +
                    entry(matrix, row, 2) * point[2]! +
                    entry(matrix, row, 3);
            }
        }
        let faces = this.faces;
        if (determinant(matrix) < 0) {
            faces = this.faces.slice();
            for (let face = 0; face < this.faceCount; face += 1) {
                faces[3 * face + 1] = this.faces[3 * face + 2]!;
                faces[3 * face + 2] = this.faces[3 * face + 1]!;
            }
        }
        return new TriangleMesh(vertices, faces);
    }

    translated(offset: Vector3): TriangleMesh {
        return this.transformed([
            [1, 0, 0, offset[0]],
            [0, 1, 0, offset[1]],
            [0, 0, 1, offset[2]],
            [0, 0, 0, 1],
        ]);
    }
}
