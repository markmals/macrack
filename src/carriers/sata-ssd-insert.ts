import type { Shape } from "@roonieone/caddy";

import type { Parameters } from "../parameters.ts";

import {
    carrierDepth,
    checkDevice,
    strapSlots,
    supportPads,
    ventilatedCarrier,
} from "./carrier.ts";

export async function buildSataInsert(sources: string, parameters: Parameters): Promise<Shape> {
    let { design, sata } = parameters;
    checkDevice(sata, design, design.sataUnits);
    let body = await ventilatedCarrier(
        sources,
        design,
        design.sataUnits,
        carrierDepth(sata, design),
    );
    body = supportPads(body, sata, design);
    return strapSlots(body, sata, design);
}
