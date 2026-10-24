import { MacrackError } from "../errors.ts";
import { TriangleMesh } from "./triangle-mesh.ts";

const HEADER_BYTES = 80;
const FACET_BYTES = 50;

/** Binary STL: an 80-byte header, a facet count, then a normal and three float32 corners each. */
export function encodeBinaryStl(mesh: TriangleMesh): Uint8Array {
    let bytes = new Uint8Array(HEADER_BYTES + 4 + mesh.faceCount * FACET_BYTES);
    let view = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode("macrack binary STL, millimetres"));
    view.setUint32(HEADER_BYTES, mesh.faceCount, true);
    let normals = mesh.faceNormals;
    for (let face = 0; face < mesh.faceCount; face += 1) {
        let offset = HEADER_BYTES + 4 + face * FACET_BYTES;
        for (let axis = 0; axis < 3; axis += 1) {
            view.setFloat32(offset + 4 * axis, normals[3 * face + axis] ?? 0, true);
        }
        for (let corner = 0; corner < 3; corner += 1) {
            for (let axis = 0; axis < 3; axis += 1) {
                let at = offset + 12 + 12 * corner + 4 * axis;
                view.setFloat32(at, mesh.coordinate(face, corner, axis), true);
            }
        }
    }
    return bytes;
}

/** Reads a binary STL with its coincident corners welded back into shared vertices. */
export function decodeBinaryStl(bytes: Uint8Array): TriangleMesh {
    let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let count = bytes.byteLength >= HEADER_BYTES + 4 ? view.getUint32(HEADER_BYTES, true) : -1;
    if (bytes.byteLength !== HEADER_BYTES + 4 + count * FACET_BYTES) {
        throw new MacrackError("not a binary STL: the facet count does not match the file size");
    }
    let positions = new Float64Array(count * 9);
    for (let face = 0; face < count; face += 1) {
        let offset = HEADER_BYTES + 4 + face * FACET_BYTES + 12;
        for (let value = 0; value < 9; value += 1) {
            positions[9 * face + value] = view.getFloat32(offset + 4 * value, true);
        }
    }
    let triangles = Uint32Array.from({ length: count * 3 }, (_, index) => index);
    return TriangleMesh.welded(positions, triangles);
}
