import type { TriangleMesh } from "../mesh/triangle-mesh.ts";

/**
 * Whether a point on a triangle's plane lies within it, by the barycentric coordinates
 * trimesh's ray caster uses; the margin lets a probe land exactly on a shared diagonal.
 */
function encloses(
    vertices: Float64Array,
    corners: readonly [number, number, number],
    point: readonly number[],
): boolean {
    let [a, b, c] = corners;
    let edge0 = [0, 0, 0];
    let edge1 = [0, 0, 0];
    let offset = [0, 0, 0];
    for (let k = 0; k < 3; k += 1) {
        edge0[k] = vertices[b + k]! - vertices[a + k]!;
        edge1[k] = vertices[c + k]! - vertices[a + k]!;
        offset[k] = point[k]! - vertices[a + k]!;
    }
    let dot00 = edge0[0]! * edge0[0]! + edge0[1]! * edge0[1]! + edge0[2]! * edge0[2]!;
    let dot01 = edge0[0]! * edge1[0]! + edge0[1]! * edge1[1]! + edge0[2]! * edge1[2]!;
    let dot02 = edge0[0]! * offset[0]! + edge0[1]! * offset[1]! + edge0[2]! * offset[2]!;
    let dot11 = edge1[0]! * edge1[0]! + edge1[1]! * edge1[1]! + edge1[2]! * edge1[2]!;
    let dot12 = edge1[0]! * offset[0]! + edge1[1]! * offset[1]! + edge1[2]! * offset[2]!;
    let inverse = 1 / (dot00 * dot11 - dot01 * dot01);
    let second = (dot00 * dot12 - dot01 * dot02) * inverse;
    let first = (dot11 * dot02 - dot01 * dot12) * inverse;
    return [1 - first - second, first, second].every(value => value > -1e-12 && value < 1 + 1e-12);
}

/**
 * Downward (-axis) ray cast from `start` over every probe, as a coordinate on `axis`; NaN
 * where the ray misses the solid entirely.
 *
 * Every triangle the ray crosses is tested and the highest hit kept, so a probe over a pocket
 * reads the pocket floor rather than whatever the mesh happens to list first.
 */
export function firstHits(
    mesh: TriangleMesh,
    probes: readonly (readonly [number, number])[],
    axis: number,
    start: number,
): number[] {
    let [acrossA, acrossB] = [0, 1, 2].filter(index => index !== axis) as [number, number];
    let normals = mesh.faceNormals;
    let vertices = mesh.vertices;
    let faces = mesh.faces;
    let hits = Array.from({ length: probes.length }, () => Number.NaN);
    let origin = [0, 0, 0];
    origin[axis] = start;
    for (let probe = 0; probe < probes.length; probe += 1) {
        origin[acrossA] = probes[probe]![0];
        origin[acrossB] = probes[probe]![1];
        for (let face = 0; face < faces.length; face += 3) {
            let slope = normals[face + axis]!;
            // The ray runs along the facet: trimesh's plane/line solver drops it.
            if (Math.abs(slope) <= 1e-5) continue;
            let a = 3 * faces[face]!;
            let toPlane = 0;
            for (let k = 0; k < 3; k += 1) {
                toPlane += (vertices[a + k]! - origin[k]!) * normals[face + k]!;
            }
            let distance = toPlane / -slope;
            if (!(distance > -1e-6)) continue;
            let reach = origin[axis]! - distance;
            if (!(reach > hits[probe]!) && !Number.isNaN(hits[probe]!)) continue;
            if (Number.isNaN(reach)) continue;
            let point = [origin[0]!, origin[1]!, origin[2]!];
            point[axis] = reach;
            let corners = [a, 3 * faces[face + 1]!, 3 * faces[face + 2]!] as [
                number,
                number,
                number,
            ];
            if (encloses(vertices, corners, point)) hits[probe] = reach;
        }
    }
    return hits;
}
