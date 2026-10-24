import type { Shape } from "@roonieone/caddy";

import type { Design, Envelope } from "../parameters.ts";

import { MacrackError } from "../errors.ts";
import { BODY_HALF_WIDTH, DEPTH, U, block, template } from "./rack-interface.ts";

/** Whole module units a device needs once floor, stand-off and top clearance are added. */
export function requiredUnits(envelope: Envelope, design: Design): number {
    return Math.ceil((design.floor + design.standOff + envelope.height + design.topClearance) / U);
}

/** Rejects a device (or `count` side-by-side devices) that the carrier cannot hold. */
export function checkDevice(
    envelope: Envelope,
    design: Design,
    units: number,
    options: { readonly count?: number } = {},
): void {
    let { count = 1 } = options;
    let innerWidth = 2 * (BODY_HALF_WIDTH - design.sideWall);
    let neededWidth = count * envelope.width + (count + 1) * design.clearance;
    if (neededWidth > innerWidth) {
        throw new MacrackError(
            `Device needs ${neededWidth.toFixed(2)} mm; carrier has ${innerWidth.toFixed(2)} mm`,
        );
    }
    let neededUnits = requiredUnits(envelope, design);
    if (neededUnits > units) {
        throw new MacrackError(
            `Device requires at least ${neededUnits}U with configured vertical allowances`,
        );
    }
    if (Math.min(envelope.width, envelope.depth) < 20) {
        throw new MacrackError(
            "This carrier requires device width/depth >=20 mm for its support pads",
        );
    }
}

export function carrierDepth(envelope: Envelope | null, design: Design): number {
    if (envelope === null) return DEPTH;
    return Math.max(DEPTH, design.deviceFront + envelope.depth + design.clearance);
}

/** The template hollowed to a floor, extended rearward to `depth`, with paired floor vents. */
export async function ventilatedCarrier(
    sources: string,
    design: Design,
    units: number,
    depth: number,
): Promise<Shape> {
    if (12 + design.ventWidth >= depth - 8) {
        throw new MacrackError("Carrier depth leaves no room for the configured floor vents");
    }
    let innerWidth = 2 * (BODY_HALF_WIDTH - design.sideWall);
    let body = (await template(sources, units)).subtract(
        block(innerWidth, DEPTH + 5, units * U + 1, { y: -4, z: design.floor }),
    );
    if (depth > DEPTH) {
        body = body.union(block(innerWidth, depth - DEPTH + 1, design.floor, { y: DEPTH - 1 }));
    }
    for (let y = 12.0; y + design.ventWidth < depth - 8; y += design.ventPitch) {
        for (let x of [-innerWidth / 4, innerWidth / 4]) {
            body = body.subtract(
                block(innerWidth / 2 - 18, design.ventWidth, design.floor + 2, { x, y, z: -1 }),
            );
        }
    }
    return body;
}

export interface CentreOptions {
    /** X of the device's centreline; defaults to the carrier centreline. */
    readonly centerX?: number;
}

/** Two full-depth rails the device stands on, inset from its side faces. */
export function supportPads(
    body: Shape,
    envelope: Envelope,
    design: Design,
    options: CentreOptions = {},
): Shape {
    let { centerX = 0 } = options;
    let padWidth = 6.0;
    for (let x of [
        centerX - envelope.width / 2 + padWidth / 2,
        centerX + envelope.width / 2 - padWidth / 2,
    ]) {
        body = body.union(
            block(padWidth, envelope.depth, design.standOff, {
                x,
                y: design.deviceFront,
                z: design.floor,
            }),
        );
    }
    return body;
}

/** Strap slots beside the device at a quarter and three quarters of its depth. */
export function strapSlots(
    body: Shape,
    envelope: Envelope,
    design: Design,
    options: CentreOptions = {},
): Shape {
    let { centerX = 0 } = options;
    if (envelope.depth / 2 < design.strapLength + 3) {
        throw new MacrackError(
            "Device depth must leave a 3 mm web between the two strap positions",
        );
    }
    let inner = BODY_HALF_WIDTH - design.sideWall;
    let slotOffset = envelope.width / 2 + design.clearance + design.strapWidth / 2;
    if (Math.abs(centerX) + slotOffset + design.strapWidth / 2 + 3 > inner) {
        throw new MacrackError("Device leaves insufficient side web for configured strap slots");
    }
    let rows = [
        design.deviceFront + envelope.depth * 0.25,
        design.deviceFront + envelope.depth * 0.75,
    ];
    for (let y of rows) {
        body = body.union(
            block(inner * 2, design.strapLength + 6, design.floor, {
                y: y - design.strapLength / 2 - 3,
            }),
        );
    }
    for (let x of [centerX - slotOffset, centerX + slotOffset]) {
        for (let y of rows) {
            body = body.subtract(
                block(design.strapWidth, design.strapLength, design.floor + 2, {
                    x,
                    y: y - design.strapLength / 2,
                    z: -1,
                }),
            );
        }
    }
    return body;
}
