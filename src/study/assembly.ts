import type { Shape } from "@roonieone/caddy";

import type { InterfaceCheck } from "../carriers/rack-interface.ts";
import type { Parameters } from "../parameters.ts";
import type { Artifact } from "./artifact.ts";

import { buildHddInsert } from "../carriers/hdd-insert.ts";
import { buildNvmeInsert, enclosureCenters, nvmeDeviceFront } from "../carriers/nvme-insert.ts";
import { U, block, interfaceCheck, interfaceCoupon } from "../carriers/rack-interface.ts";
import { buildSataInsert } from "../carriers/sata-ssd-insert.ts";
import { MacrackError } from "../errors.ts";
import { parametersMetadata, validateParameters } from "../parameters.ts";
import { artifact, deviceKeepout } from "./artifact.ts";

export const LIMITATIONS: readonly string[] = [
    "Candidate geometry only; no physical fit, thermal, vibration or load validation.",
    "Carrier-only study at nominal 25 mm module heights; use the rack command for measured 25.4 mm slots and the original frame.",
    "Selected NVMe enclosures, SATA bridges, hubs, cables and power supplies are unresolved and absent from collision checks.",
    "Samsung, future HDD and future Mac envelopes are reference assumptions, not verified owner hardware.",
    "HDD strap retention and printed ground skids require engineering and physical validation; no screw/grommet pattern is claimed.",
    "This study excludes the frame and original modules; its ground-skid datum is not the full-rack base-support datum.",
];

const CARRIER_NOTE =
    "Provisional carrier; imported source slide geometry retained. " +
    "Device fasteners and operational fit unvalidated.";

const EMPTY_NVME_NOTE =
    " Empty dual carrier: no enclosure dimensions selected; no enclosure fit claim.";

export type Allocation = {
    readonly storage_U: number;
    readonly Mac_airflow_U: number;
    readonly Mac_bay_U: number;
    readonly total_U: number;
    readonly allocated_height_with_ground_skids_mm: number;
    readonly nominal_module_height_mm: number;
    readonly complete_external_enclosure_dimensions: string;
};

export type AssemblyMetadata = {
    readonly parameters: Record<string, unknown>;
    readonly interface_checks: Record<string, InterfaceCheck>;
    readonly allocation: Allocation;
    readonly limitations: string[];
};

export interface Assembly {
    readonly artifacts: Artifact[];
    readonly coupons: Artifact[];
    readonly metadata: AssemblyMetadata;
}

interface CarrierModule {
    readonly name: string;
    readonly shape: Shape;
    readonly units: number;
    readonly z: number;
}

/** Bottom z of each bay, stacked from the ground skids up. */
interface Levels {
    readonly hdd: number;
    readonly sata: number;
    readonly nvme: number;
    readonly cooling: number;
    readonly mac: number;
}

function bayLevels(design: Parameters["design"]): Levels {
    let stacked = (units: number) => design.hddFeet + units * U;
    return {
        hdd: stacked(0),
        sata: stacked(design.hddUnits),
        nvme: stacked(design.hddUnits + design.sataUnits),
        cooling: stacked(design.hddUnits + design.sataUnits + design.nvmeUnits),
        mac: stacked(design.hddUnits + design.sataUnits + design.nvmeUnits + 1),
    };
}

async function carrierModules(
    sources: string,
    parameters: Parameters,
    levels: Levels,
): Promise<CarrierModule[]> {
    let { design } = parameters;
    return [
        {
            name: "hdd_carrier",
            shape: await buildHddInsert(sources, parameters),
            units: design.hddUnits,
            z: levels.hdd,
        },
        {
            name: "sata_ssd_carrier",
            shape: await buildSataInsert(sources, parameters),
            units: design.sataUnits,
            z: levels.sata,
        },
        {
            name: "dual_nvme_carrier",
            shape: await buildNvmeInsert(sources, parameters),
            units: design.nvmeUnits,
            z: levels.nvme,
        },
    ];
}

function deviceArtifacts(parameters: Parameters, levels: Levels): Artifact[] {
    let { design } = parameters;
    let deviceZ = design.floor + design.standOff;
    return [
        deviceKeepout("reference_hdd_NOT_SELECTED", parameters.hdd, [
            0,
            design.deviceFront,
            levels.hdd + deviceZ,
        ]),
        deviceKeepout("reference_samsung_NOT_CONFIRMED", parameters.sata, [
            0,
            design.deviceFront,
            levels.sata + deviceZ,
        ]),
        deviceKeepout("reference_M4_NOT_SELECTED", parameters.mac, [
            0,
            design.deviceFront,
            levels.mac + (3 * U - parameters.mac.height) / 2,
        ]),
        artifact(
            "Mac_1U_airflow_reservation",
            block(146, Math.max(100, design.deviceFront + parameters.mac.depth), U),
            {
                kind: "reservation",
                position: [0, 0, levels.cooling],
                note: "Unoccupied 1U below reserved Mac bay; airflow and cradle position remain unvalidated.",
            },
        ),
    ];
}

export async function buildAssembly(sources: string, parameters: Parameters): Promise<Assembly> {
    validateParameters(parameters);
    let { design } = parameters;
    let levels = bayLevels(design);
    if (parameters.mac.width > 146 || parameters.mac.height > 3 * U) {
        throw new MacrackError("Mac reference envelope exceeds the reserved original 3U bay");
    }
    let checks: Record<string, InterfaceCheck> = {};
    let artifacts: Artifact[] = [];
    for (let module of await carrierModules(sources, parameters, levels)) {
        checks[module.name] = await interfaceCheck(
            module.shape,
            sources,
            module.units,
            design.sideWall,
        );
        let empty = module.name === "dual_nvme_carrier" && parameters.nvme === null;
        artifacts.push(
            artifact(module.name, module.shape, {
                position: [0, 0, module.z],
                note: empty ? CARRIER_NOTE + EMPTY_NVME_NOTE : CARRIER_NOTE,
            }),
        );
    }
    artifacts.push(...deviceArtifacts(parameters, levels));
    let { nvme } = parameters;
    if (nvme !== null) {
        let deviceZ = design.floor + design.standOff;
        let front = nvmeDeviceFront(parameters);
        for (let [index, x] of enclosureCenters(parameters).entries()) {
            artifacts.push(
                deviceKeepout(`nvme_enclosure_${index + 1}`, nvme, [
                    x,
                    front,
                    levels.nvme + deviceZ,
                ]),
            );
        }
    }
    let coupons: Artifact[] = [];
    for (let units of [1, 2]) {
        coupons.push(
            artifact(`rail_coupon_${units}U`, await interfaceCoupon(sources, units), {
                note: "Exact right-hand source interface slice; test with real rail. No mating rail is fabricated.",
            }),
        );
    }
    let allocatedUnits = design.hddUnits + design.sataUnits + design.nvmeUnits + 1 + 3;
    return {
        artifacts,
        coupons,
        metadata: {
            parameters: parametersMetadata(parameters),
            interface_checks: checks,
            allocation: {
                storage_U: allocatedUnits - 4,
                Mac_airflow_U: 1,
                Mac_bay_U: 3,
                total_U: allocatedUnits,
                allocated_height_with_ground_skids_mm: allocatedUnits * U + design.hddFeet,
                nominal_module_height_mm: U,
                complete_external_enclosure_dimensions:
                    "not evaluated by the carrier-only study; see the rack command",
            },
            limitations: [...LIMITATIONS],
        },
    };
}
