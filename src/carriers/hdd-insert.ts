import type { Shape } from "@roonieone/caddy";

import type { Parameters } from "../parameters.ts";

import {
    carrierDepth,
    checkDevice,
    strapSlots,
    supportPads,
    ventilatedCarrier,
} from "./carrier.ts";
import { block } from "./rack-interface.ts";

export async function buildHddInsert(sources: string, parameters: Parameters): Promise<Shape> {
    let { design, hdd } = parameters;
    checkDevice(hdd, design, design.hddUnits);
    let depth = carrierDepth(hdd, design);
    let body = await ventilatedCarrier(sources, design, design.hddUnits, depth);
    body = supportPads(body, hdd, design);
    body = strapSlots(body, hdd, design);
    // Ground skids support the rear extension independently of the unverified rack rails.
    for (let x of [-hdd.width / 2 + 5, hdd.width / 2 - 5]) {
        body = body.union(block(10, depth + 3, design.hddFeet, { x, y: -3, z: -design.hddFeet }));
    }
    return body;
}
