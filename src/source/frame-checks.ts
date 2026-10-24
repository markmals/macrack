import type { Matrix4, Rotation } from "../mesh/affine.ts";
import type { Interval, PanelMeasurement, Pocket } from "./frame-measurement.ts";

import { MacrackError } from "../errors.ts";
import { entry } from "../mesh/affine.ts";
import { round } from "../rounding.ts";
import {
    FIT_TOL,
    intervalText,
    numberList,
    pocketCentre,
    ptp,
    pythonNumber,
} from "./frame-measurement.ts";

export interface SeatGrid {
    readonly seats: Interval[];
    readonly sides: number[];
    readonly depths: number[];
}

export interface CeilingFacts {
    readonly plateUndersideZ: number;
    readonly usableCeilingZ: number;
    readonly skirtHalfWidthX: number;
    readonly skirtHalfDepthY: number;
}

export interface RibFacts {
    readonly topZ: number;
    readonly halfSpanX: number;
    readonly spansY: number[][];
}

function byPair(left: readonly number[], right: readonly number[]): number {
    return left[0]! - right[0]! || left[1]! - right[1]!;
}

function pairList(pairs: readonly Interval[]): string {
    return `[${pairs.map(intervalText).join(", ")}]`;
}

/** `np.allclose`: the measured extents may drift by a micron of float32 round-trip, no more. */
export function allClose(measured: readonly number[], expected: readonly number[]): boolean {
    return measured.every(
        (value, axis) =>
            Math.abs(value - expected[axis]!) <= FIT_TOL + 1e-5 * Math.abs(expected[axis]!),
    );
}

export function requireCentred(
    bounds: readonly [number, number],
    axis: number,
    label: string,
): void {
    let [low, high] = bounds;
    if (Math.abs(low + high) > FIT_TOL) {
        throw new MacrackError(
            `${label}: axis ${axis} is not centred on its origin (${low}..${high})`,
        );
    }
}

export function uniformFloor(sockets: readonly Pocket[], label: string): number {
    let floor = sockets[0]!.floor;
    if (sockets.some(socket => Math.abs(socket.floor - floor) > FIT_TOL)) {
        throw new MacrackError(`${label}: rail sockets have different floors`);
    }
    return floor;
}

/** Rail seats read off the base sockets: local X runs front-to-rear, local Z across. */
export function seatGrid(sockets: readonly Pocket[], rotation: Rotation, label: string): SeatGrid {
    let seats = sockets.map((socket): Interval => {
        let [depthCentre, widthCentre] = pocketCentre(socket);
        return [rotation[0][2] * widthCentre, rotation[1][0] * depthCentre];
    });
    // 3MF vertices round-trip through float32, so authored 0.1 mm features land ~2e-6 off.
    let unique = (values: number[]) =>
        [...new Set(values.map(value => round(value, 4)))].sort((left, right) => left - right);
    let depths = unique(seats.map(seat => seat[1]));
    let sides = unique(seats.map(seat => seat[0]));
    if (depths.length !== 3 || sides.length !== 2 || Math.abs(sides[0]! + sides[1]!) > FIT_TOL) {
        throw new MacrackError(
            `${label}: sockets are not three depths on two symmetric sides (${pairList(seats)})`,
        );
    }
    return { seats, sides, depths };
}

/** The lid's sockets have to land on the same grid the base sockets seat the rails at. */
export function requireClosedFrame(
    sockets: readonly Pocket[],
    seats: readonly Interval[],
    rotation: Rotation,
    label: string,
): void {
    let topSeats = sockets
        .map((socket): Interval => {
            let centre = pocketCentre(socket);
            return [round(rotation[0][2] * centre[1], 4), round(rotation[1][0] * centre[0], 4)];
        })
        .sort(byPair);
    let baseSeats = seats
        .map((seat): Interval => [round(seat[0], 4), round(seat[1], 4)])
        .sort(byPair);
    let closes =
        topSeats.length === baseSeats.length &&
        topSeats.every(
            (seat, index) => seat[0] === baseSeats[index]![0] && seat[1] === baseSeats[index]![1],
        );
    if (!closes) {
        throw new MacrackError(
            `${label}: socket grid ${pairList(topSeats)} does not land on the base sockets ` +
                `${pairList([...seats].sort(byPair))}; the frame does not close`,
        );
    }
}

/**
 * The lid's interior ceiling and the skirt that hangs below it. The skirt overhangs every
 * module's full body width, so it - not the plate - is the ceiling a bay has to clear.
 */
export function ceilingFacts(
    panel: PanelMeasurement,
    transform: Matrix4,
    label: string,
): CeilingFacts {
    let socketFloor = panel.sockets[0]!.floor;
    let interior = panel.recesses.filter(pocket => pocket.floor > socketFloor);
    if (interior.length === 0) {
        throw new MacrackError(`${label}: no interior recess to read the ceiling from`);
    }
    if (ptp(interior.map(pocket => pocket.floor)) > FIT_TOL) {
        throw new MacrackError(`${label}: interior ceiling is stepped, not one plane`);
    }
    let width = interior[0]!.width;
    let endSkirts = panel.solidCells.filter(
        cell => cell.width[0] === width[0] && cell.width[1] === width[1],
    );
    if (endSkirts.length === 0) {
        throw new MacrackError(`${label}: no front/rear skirt measured across the bay opening`);
    }
    let plateZ = entry(transform, 2, 3);
    return {
        plateUndersideZ: plateZ - interior[0]!.floor,
        usableCeilingZ: plateZ - panel.mouth,
        skirtHalfDepthY: Math.min(...endSkirts.flatMap(cell => cell.depth.map(Math.abs))),
        skirtHalfWidthX: Math.min(...panel.solidCells.flatMap(cell => cell.width.map(Math.abs))),
    };
}

/**
 * The base cross ribs. They span the bay opening between the side members, so their width
 * edges are also the clear span a module's ground-bearing feet have to stay inside.
 */
export function ribFacts(
    panel: PanelMeasurement,
    transform: Matrix4,
    rotation: Rotation,
    label: string,
): RibFacts {
    if (panel.recesses.length === 0) {
        throw new MacrackError(`${label}: no cross ribs measured under the bay opening`);
    }
    let floors = panel.recesses.map(pocket => pocket.floor);
    if (ptp(floors) > FIT_TOL) {
        throw new MacrackError(
            `${label}: cross ribs sit at different heights (${numberList(floors)})`,
        );
    }
    return {
        topZ: floors[0]! + entry(transform, 2, 3),
        halfSpanX: Math.min(...panel.recesses.flatMap(pocket => pocket.width.map(Math.abs))),
        spansY: panel.recesses
            .map(pocket => [
                round(rotation[1][0] * pocket.depth[1], 4),
                round(rotation[1][0] * pocket.depth[0], 4),
            ])
            .sort(byPair),
    };
}

export function requireSlotsAboveBase(slotOrigins: readonly number[], baseTopZ: number): void {
    if (slotOrigins[0]! < baseTopZ) {
        throw new MacrackError(
            `lowest slot ${pythonNumber(slotOrigins[0]!)} mm sits below the base top face ` +
                `${pythonNumber(baseTopZ)} mm`,
        );
    }
}

/** A module's rack ear hangs off the front rail face; it has to finish on the lid's front edge. */
export function requireEarClearance(moduleY: number, frontDepth: number, topFrontY: number): void {
    if (Math.abs(moduleY - frontDepth - topFrontY) > FIT_TOL) {
        throw new MacrackError(
            `a ${pythonNumber(frontDepth)} mm rack ear on the front rail face at ` +
                `y=${pythonNumber(moduleY)} would end at ${pythonNumber(moduleY - frontDepth)}, ` +
                `but the top panel's front edge is at ${pythonNumber(topFrontY)}`,
        );
    }
}
