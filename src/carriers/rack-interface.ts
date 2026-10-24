import type { Shape } from "@roonieone/caddy";

import { Align, Axis, Box, GeomType, importCAD } from "@roonieone/caddy";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { sha256Hex } from "../digest.ts";
import { MacrackError } from "../errors.ts";

/** Nominal module pitch of the STEP blanks; the frame's measured rail pitch is 25.4. */
export const U = 25.0;
export const BODY_HALF_WIDTH = 73.0;
export const FRONT_HALF_WIDTH = 83.4;
export const SLIDE_HALF_WIDTH = 77.0;
export const DEPTH = 100.0;
export const FRONT_DEPTH = 3.0;

export interface BlockPosition {
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
}

/** A box centred on X with its front-bottom edge at (y, z): the module frame's building block. */
export function block(
    width: number,
    depth: number,
    height: number,
    position: BlockPosition = {},
): Shape {
    let { x = 0, y = 0, z = 0 } = position;
    return new Box(width, depth, height, {
        align: [Align.Center, Align.Min, Align.Min],
    }).translate([x, y, z]);
}

function templatePath(sources: string, units: number): string {
    return join(sources, `${units}U Template.step`);
}

let templates = new Map<string, Promise<Shape>>();

async function loadTemplate(sources: string, units: number): Promise<Shape> {
    let path = templatePath(sources, units);
    let shape = (await importCAD(path)).rotate(Axis.X, 90);
    let bounds = shape.boundingBox;
    let measured = [...bounds.min.toTuple(), ...bounds.max.toTuple()];
    let expected = [-FRONT_HALF_WIDTH, -FRONT_DEPTH, 0, FRONT_HALF_WIDTH, DEPTH, units * U];
    if (measured.some((actual, index) => Math.abs(actual - expected[index]!) > 1e-6)) {
        throw new MacrackError(
            `${path}: changed source bounds; remeasure the interface before use`,
        );
    }
    if (!shape.isValid || shape.solids.length !== 1) {
        throw new MacrackError(`${path}: template must be a valid single solid`);
    }
    return shape;
}

/**
 * The original 1U/2U/3U STEP blank, turned so X is width, +Y runs to the rack rear and +Z is up,
 * after checking it still has the bounds the interface was measured from.
 */
export function template(sources: string, units: number): Promise<Shape> {
    if (![1, 2, 3].includes(units)) {
        return Promise.reject(
            new MacrackError("Only the supplied 1U/2U/3U STEP templates are supported"),
        );
    }
    let key = `${resolve(sources)}\0${units}`;
    let cached = templates.get(key);
    if (cached === undefined) {
        cached = loadTemplate(sources, units);
        templates.set(key, cached);
        cached.catch(() => templates.delete(key));
    }
    return cached;
}

/** The template's side walls, slides and rack ears: everything outside the inner body. */
export async function protectedInterface(
    sources: string,
    units: number,
    sideWall: number,
): Promise<Shape> {
    let original = await template(sources, units);
    let inner = BODY_HALF_WIDTH - sideWall;
    let middle = block(inner * 2, DEPTH + FRONT_DEPTH + 2, units * U + 2, { y: -4, z: -1 });
    return original.subtract(middle);
}

export interface InterfaceCheck {
    readonly missing_source_interface_mm3: number;
    readonly added_interface_interference_mm3: number;
    readonly rail_clearance: string;
}

/** Proves a carrier kept every bit of the source interface and added nothing beside it. */
export async function interfaceCheck(
    shape: Shape,
    sources: string,
    units: number,
    sideWall: number,
): Promise<InterfaceCheck> {
    let expected = await protectedInterface(sources, units, sideWall);
    let missing = expected.subtract(shape);
    let missingVolume = missing.isNull ? 0 : missing.volume;
    let inner = BODY_HALF_WIDTH - sideWall;
    let sideZone = block(200, 106, units * U + 2, { y: -4, z: -1 }).subtract(
        block(inner * 2, 108, units * U + 4, { y: -5, z: -2 }),
    );
    let added = shape.intersect(sideZone)?.subtract(expected);
    let addedVolume = added === undefined || added.isNull ? 0 : added.volume;
    if (missingVolume > 1e-5 || addedVolume > 1e-5) {
        throw new MacrackError(
            `Rack interface changed: missing ${missingVolume}, added ${addedVolume} mm^3`,
        );
    }
    return {
        missing_source_interface_mm3: missingVolume,
        added_interface_interference_mm3: addedVolume,
        rail_clearance:
            "not evaluated by template preservation; see full-rack geometry report and physical coupon test",
    };
}

/** Hashes, sizes and lateral pocket faces of the three STEP blanks, for the manifest. */
export async function inspectSources(sources: string): Promise<Record<string, unknown>> {
    let measurements: Record<string, unknown> = {};
    for (let units of [1, 2, 3]) {
        let shape = await template(sources, units);
        let pocketFaces = shape.faces.filter(
            face => face.geomType === GeomType.Cylinder && face.area > 40,
        );
        measurements[`${units}U`] = {
            file: `${units}U Template.step`,
            sha256: sha256Hex(await readFile(templatePath(sources, units))),
            size_mm: shape.boundingBox.size.toTuple(),
            volume_mm3: shape.volume,
            lateral_pocket_faces: pocketFaces.map(face => ({
                min_mm: face.boundingBox.min.toTuple(),
                max_mm: face.boundingBox.max.toTuple(),
            })),
        };
    }
    return {
        units: "mm",
        transform: "source.rotate(Axis.X, 90): X=width, +Y=rear, +Z=up",
        templates: measurements,
        coverage:
            "STEP templates only; original frame and modules are inspected separately from the 3MF",
    };
}

/** A full-depth slice of the right-hand slide, keeping the entrance and any blind pocket. */
export async function interfaceCoupon(sources: string, units: number): Promise<Shape> {
    let coupon = (await template(sources, units)).intersect(block(16, 103, 10, { x: 75.4, y: -3 }));
    if (coupon === undefined) throw new MacrackError(`${units}U template has no slide to sample`);
    return coupon;
}
