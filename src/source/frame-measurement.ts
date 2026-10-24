import type { TriangleMesh } from "../mesh/triangle-mesh.ts";

import { MacrackError } from "../errors.ts";
import { round } from "../rounding.ts";
import { firstHits } from "./ray-cast.ts";

/** Z of the surface the rack stands on: the datum every frame height is measured from. */
export const GROUND_Z = 0.0;

/** Source panels/rails are authored on exact 0.1 mm features; anything looser is a changed source. */
export const FIT_TOL = 1e-3;
// Pocket mouths and panel edges are chamfered, so probes land a few tenths below a face
// plane without that face being a pocket.
export const RIM_RELIEF = 0.5;

export type Interval = [low: number, high: number];

/** Rail features in rail-local coordinates (X across the post, Y along it, Z thickness). */
export interface RailMeasurement {
    readonly length: number;
    readonly section: Interval;
    readonly slotFloors: number[];
    readonly slotPitch: number;
    readonly slotHeight: number;
    readonly slotDepth: number;
}

export interface Pocket {
    readonly depth: Interval;
    readonly width: Interval;
    readonly floor: number;
}

/** One rectangle the panel's face planes carve out, before it is classified. */
export interface Cell {
    readonly depth: Interval;
    readonly width: Interval;
}

/** Panel features in panel-local coordinates (X depth, Y thickness, Z width). */
export interface PanelMeasurement {
    readonly mouth: number;
    readonly sockets: Pocket[];
    readonly recesses: Pocket[];
    readonly openCells: Cell[];
    readonly solidCells: Cell[];
}

export function pocketSize(pocket: Pocket): Interval {
    return [pocket.depth[1] - pocket.depth[0], pocket.width[1] - pocket.width[0]];
}

export function pocketCentre(pocket: Pocket): Interval {
    return [(pocket.depth[0] + pocket.depth[1]) / 2, (pocket.width[0] + pocket.width[1]) / 2];
}

/** A measurement as Python prints it, so a refusal reads like the Python one did. */
export function pythonNumber(value: number): string {
    return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

export function numberList(values: readonly number[]): string {
    return `[${values.map(pythonNumber).join(", ")}]`;
}

export function intervalText(interval: Interval): string {
    return `(${interval.map(pythonNumber).join(", ")})`;
}

/** Offsets of planes normal to `axis` facing `sign`, mapped to their total facet area. */
export function axisPlanes(
    mesh: TriangleMesh,
    axis: number,
    sign: number,
    minArea: number,
): Map<number, number> {
    let normals = mesh.faceNormals;
    let areas = mesh.faceAreas;
    let totals = new Map<number, number>();
    for (let face = 0; face < mesh.faceCount; face += 1) {
        if (Math.abs(normals[3 * face + axis]! - sign) >= 1e-6) continue;
        let offset = round(mesh.coordinate(face, 0, axis), 6);
        totals.set(offset, (totals.get(offset) ?? 0) + areas[face]!);
    }
    let kept = [...totals].sort((left, right) => left[0] - right[0]);
    return new Map(kept.filter(([, area]) => area >= minArea));
}

export function intervals(mesh: TriangleMesh, axis: number, minArea: number): Interval[] {
    let edges = [
        ...new Set([
            ...axisPlanes(mesh, axis, 1, minArea).keys(),
            ...axisPlanes(mesh, axis, -1, minArea).keys(),
        ]),
    ].sort((left, right) => left - right);
    let spans: Interval[] = [];
    for (let index = 0; index + 1 < edges.length; index += 1) {
        let [low, high] = [edges[index]!, edges[index + 1]!];
        if (high - low > 1.0) spans.push([low, high]);
    }
    return spans;
}

/** Spread of a sample, like `np.ptp`. */
export function ptp(values: readonly number[]): number {
    return Math.max(...values) - Math.min(...values);
}

export function measureRail(mesh: TriangleMesh, label: string): RailMeasurement {
    let extents = mesh.extents;
    let longAxis = extents.indexOf(Math.max(...extents));
    let thicknessAxis = extents.indexOf(Math.min(...extents));
    let acrossAxis = 3 - longAxis - thicknessAxis;
    if (longAxis !== 1 || thicknessAxis !== 2) {
        throw new MacrackError(
            `${label}: expected the post axis on local Y and thickness on local Z, measured ` +
                `extents ${numberList(extents.map(value => round(value, 4)))}`,
        );
    }
    let [low, high] = [mesh.bounds[0][longAxis]!, mesh.bounds[1][longAxis]!];
    let floorPlanes = [...axisPlanes(mesh, longAxis, 1, 10.0).keys()].filter(
        offset => Math.abs(offset - high) > FIT_TOL,
    );
    let ceilingPlanes = [...axisPlanes(mesh, longAxis, -1, 10.0).keys()].filter(
        offset => Math.abs(offset - low) > FIT_TOL,
    );
    // A slot is a floor plane and the first ceiling plane above it; the rails also carry
    // blind end-screw pockets, whose faces must fall outside the slotted span.
    let pairs: Interval[] = [];
    for (let floor of floorPlanes) {
        let above = ceilingPlanes.find(value => value > floor + FIT_TOL);
        if (above !== undefined) pairs.push([floor, above]);
    }
    if (pairs.length < 2) {
        throw new MacrackError(
            `${label}: found ${pairs.length} slots; the source rail is not slotted`,
        );
    }
    let heights = pairs.map(([floor, ceiling]) => ceiling - floor);
    if (ptp(heights) > FIT_TOL) {
        throw new MacrackError(
            `${label}: slot heights vary (${numberList(heights.map(value => round(value, 4)))}); ` +
                "remeasure the rail",
        );
    }
    let floors = pairs.map(pair => pair[0]);
    let pitches = floors.slice(1).map((value, index) => value - floors[index]!);
    if (ptp(pitches) > FIT_TOL) {
        throw new MacrackError(
            `${label}: slot pitch is not uniform (${numberList(pitches.map(value => round(value, 4)))})`,
        );
    }
    let span: Interval = [floors[0]! - FIT_TOL, pairs.at(-1)![1] + FIT_TOL];
    let strays = [...new Set([...floorPlanes, ...ceilingPlanes])].filter(
        offset =>
            span[0] <= offset &&
            offset <= span[1] &&
            !pairs.some(pair => pair.some(value => Math.abs(offset - value) <= FIT_TOL)),
    );
    if (strays.length > 0) {
        let at = numberList(strays.sort((left, right) => left - right));
        throw new MacrackError(
            `${label}: unexpected transverse faces inside the slotted span at ${at}`,
        );
    }
    // The slotted face is the thickness face that also carries the recessed slot floors.
    let outward = mesh.bounds[0][thicknessAxis]!;
    let recesses = [...axisPlanes(mesh, thicknessAxis, -1, 10.0).keys()].filter(
        offset => Math.abs(offset - outward) > FIT_TOL,
    );
    if (recesses.length !== 1) {
        throw new MacrackError(
            `${label}: expected one recessed slot floor plane, measured ${numberList(recesses)}`,
        );
    }
    return {
        length: extents[longAxis]!,
        section: [extents[acrossAxis]!, extents[thicknessAxis]!],
        slotFloors: floors,
        slotPitch: pitches[0]!,
        slotHeight: heights[0]!,
        slotDepth: recesses[0]! - outward,
    };
}

/** The height a cell's probes agree on, or null where they all missed the solid. */
function cellFloor(
    label: string,
    cell: Cell,
    hits: readonly number[],
    mouth: number,
): number | null {
    let reached = hits.filter(value => !Number.isNaN(value));
    if (reached.length === 0) return null;
    let counts = new Map<number, number>();
    for (let value of reached) {
        let key = round(value, 4);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let floor = [...counts].sort((left, right) => right[1] - left[1])[0]![0];
    if (mouth - floor <= RIM_RELIEF) return floor;
    let above = reached.filter(value => value > floor + FIT_TOL);
    if (above.length > 0) {
        throw new MacrackError(
            `${label}: cell ${intervalText(cell.depth)}x${intervalText(cell.width)} has material ` +
                `at ${numberList(above.map(value => round(value, 4)))} above its ` +
                `${pythonNumber(floor)} mm floor; the panel's pocket layout changed`,
        );
    }
    return floor;
}

/** Classify the panel's pockets by probing each rectangle the face planes carve out. */
export function measurePanel(
    mesh: TriangleMesh,
    label: string,
    section: Interval,
): PanelMeasurement {
    let extents = mesh.extents;
    if (extents.indexOf(Math.min(...extents)) !== 1) {
        throw new MacrackError(
            `${label}: expected panel thickness on local Y, measured extents ` +
                numberList(extents.map(value => round(value, 4))),
        );
    }
    let [thicknessAxis, depthAxis, widthAxis] = [1, 0, 2];
    let mouth = mesh.bounds[1][thicknessAxis]!;
    let depthCells = intervals(mesh, depthAxis, 50.0);
    let widthCells = intervals(mesh, widthAxis, 50.0);
    if (depthCells.length === 0 || widthCells.length === 0) {
        throw new MacrackError(`${label}: no face planes to divide the panel into cells`);
    }
    let cells: Cell[] = [];
    let probes: Interval[] = [];
    for (let depth of depthCells) {
        for (let width of widthCells) {
            cells.push({ depth, width });
            for (let alongDepth of [0.25, 0.5, 0.75]) {
                for (let alongWidth of [0.25, 0.5, 0.75]) {
                    probes.push([
                        depth[0] + alongDepth * (depth[1] - depth[0]),
                        width[0] + alongWidth * (width[1] - width[0]),
                    ]);
                }
            }
        }
    }
    let hits = firstHits(mesh, probes, thicknessAxis, mouth + 1.0);
    let sockets: Pocket[] = [];
    let recesses: Pocket[] = [];
    let openCells: Cell[] = [];
    let solidCells: Cell[] = [];
    for (let [index, cell] of cells.entries()) {
        let floor = cellFloor(label, cell, hits.slice(9 * index, 9 * index + 9), mouth);
        if (floor === null) {
            openCells.push(cell);
        } else if (mouth - floor <= RIM_RELIEF) {
            solidCells.push(cell);
        } else {
            let pocket: Pocket = { depth: cell.depth, width: cell.width, floor };
            let clearance = pocketSize(pocket).map((value, axis) => value - section[axis]!);
            let fitsRail = clearance.every(value => value >= 0.0 && value <= 0.4);
            (fitsRail ? sockets : recesses).push(pocket);
        }
    }
    return { mouth, sockets, recesses, openCells, solidCells };
}
