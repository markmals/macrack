import type { Shape } from "@roonieone/caddy";

import type { Parameters } from "../parameters.ts";

import { checkDevice, supportPads, ventilatedCarrier } from "./carrier.ts";
import { BODY_HALF_WIDTH, DEPTH, block } from "./rack-interface.ts";

/** Y of the enclosures' front faces: behind the front strap row. */
export function nvmeDeviceFront(parameters: Parameters): number {
    let { design } = parameters;
    return design.deviceFront + design.strapWidth + design.clearance + 3;
}

/** X centres of the two enclosures, or of the two halves of an empty carrier. */
export function enclosureCenters(parameters: Parameters): [number, number] {
    let { nvme, design } = parameters;
    let offset =
        nvme === null
            ? (BODY_HALF_WIDTH - design.sideWall) / 2
            : (nvme.width + design.clearance) / 2;
    return [-offset, offset];
}

export async function buildNvmeInsert(sources: string, parameters: Parameters): Promise<Shape> {
    let { design, nvme } = parameters;
    let depth = DEPTH;
    let front = nvmeDeviceFront(parameters);
    if (nvme !== null) {
        checkDevice(nvme, design, design.nvmeUnits, { count: 2 });
        depth = Math.max(DEPTH, front + nvme.depth + design.clearance + design.strapWidth + 3);
    }
    let body = await ventilatedCarrier(sources, design, design.nvmeUnits, depth);
    for (let x of enclosureCenters(parameters)) {
        if (nvme !== null) {
            body = supportPads(body, nvme, { ...design, deviceFront: front }, { centerX: x });
        }
        for (let y of [design.deviceFront, depth - design.strapWidth - 3]) {
            body = body.union(block(20, design.strapWidth + 6, design.floor, { x, y: y - 3 }));
            body = body.subtract(
                block(design.strapLength, design.strapWidth, design.floor + 2, { x, y, z: -1 }),
            );
        }
    }
    return body;
}
