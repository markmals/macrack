import type { Matrix4 } from "../mesh/affine.ts";
import type { SourceComponent } from "./source-profile.ts";
import type { ElementName, XmlElement } from "./xml-tree.ts";

import { MacrackError } from "../errors.ts";
import { affine } from "../mesh/affine.ts";
import { TriangleMesh } from "../mesh/triangle-mesh.ts";
import {
    elementsAt,
    firstNamed,
    integerAttribute,
    numberAttribute,
    parseDecimal,
} from "./xml-tree.ts";

export const CORE = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";
export const PRODUCTION = "http://schemas.microsoft.com/3dmanufacturing/production/2015/06";

export function core(local: string): ElementName {
    return { uri: CORE, local };
}

/** Python's `repr` of a string, which the reader's messages quote source attributes with. */
export function quoted(value: string | undefined): string {
    return value === undefined ? "None" : `'${value}'`;
}

/** 3MF row-vector `m00..m32` → a row-major affine matrix. */
export function transformMatrix(text: string | undefined): Matrix4 {
    if (text === undefined) return affine(null, [0, 0, 0]);
    let values = text
        .split(/\s+/)
        .filter(part => part !== "")
        .map(part => parseDecimal(part, "3MF transform value"));
    if (values.length !== 12) {
        throw new MacrackError(`3MF transform needs 12 values, got ${values.length}`);
    }
    return [
        [values[0]!, values[3]!, values[6]!, values[9]!],
        [values[1]!, values[4]!, values[7]!, values[10]!],
        [values[2]!, values[5]!, values[8]!, values[11]!],
        [0, 0, 0, 1],
    ];
}

/** The authored triangles of one `/3D/Objects/*.model` object: no welding, no reordering. */
export function componentMesh(
    root: XmlElement,
    component: SourceComponent,
    path: string,
): TriangleMesh {
    let unit = root.attributes["unit"];
    if (unit !== undefined && unit !== "millimeter") {
        throw new MacrackError(`${component.path}: unit is ${quoted(unit)}, expected 'millimeter'`);
    }
    let target = elementsAt(root, core("resources"), core("object")).find(
        element => integerAttribute(element, "id") === component.objectId,
    );
    if (target === undefined) {
        throw new MacrackError(`${path}: ${component.path} has no object ${component.objectId}`);
    }
    let objectType = target.attributes["type"] ?? "model";
    if (objectType !== "model") {
        throw new MacrackError(
            `${path}: ${component.path} object ${component.objectId} is type ` +
                `${quoted(objectType)}, not printable model geometry`,
        );
    }
    let mesh = firstNamed(target, core("mesh"));
    if (mesh === undefined) {
        throw new MacrackError(`${path}: ${component.path} object has no <mesh>`);
    }
    let points = elementsAt(mesh, core("vertices"), core("vertex"));
    let triangles = elementsAt(mesh, core("triangles"), core("triangle"));
    if (points.length === 0 || triangles.length === 0) {
        throw new MacrackError(`${path}: ${component.path} mesh is empty`);
    }
    let vertices = new Float64Array(points.length * 3);
    for (let index = 0; index < points.length; index += 1) {
        let point = points[index]!;
        vertices[3 * index] = numberAttribute(point, "x");
        vertices[3 * index + 1] = numberAttribute(point, "y");
        vertices[3 * index + 2] = numberAttribute(point, "z");
    }
    let faces = new Uint32Array(triangles.length * 3);
    for (let index = 0; index < triangles.length; index += 1) {
        let triangle = triangles[index]!;
        faces[3 * index] = integerAttribute(triangle, "v1");
        faces[3 * index + 1] = integerAttribute(triangle, "v2");
        faces[3 * index + 2] = integerAttribute(triangle, "v3");
    }
    return new TriangleMesh(vertices, faces);
}
