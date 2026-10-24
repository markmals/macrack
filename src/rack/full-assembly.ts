import type { Shape } from "@roonieone/caddy";

import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Parameters } from "../parameters.ts";
import type { FrameLayout } from "../source/rack-frame.ts";
import type { BayFloors } from "./rack-components.ts";
import type { RackManifest } from "./rack-output.ts";
import type { SceneComponent } from "./rack-scene.ts";

import { U, inspectSources } from "../carriers/rack-interface.ts";
import { MacrackError } from "../errors.ts";
import { exists, isDirectory } from "../files.ts";
import { parametersMetadata, validateParameters } from "../parameters.ts";
import { buildFrame } from "../source/rack-frame.ts";
import {
    macCradleMeasurements,
    macPlacements,
    owcPlacement,
    owcShelfMeasurements,
} from "../source/source-modules.ts";
import { SourceProfile } from "../source/source-profile.ts";
import { carrierComponents, deviceComponents, sourceComponent } from "./rack-components.ts";
import { MANIFEST_NAME, invalidateRack, ownedPath, writeGeometry } from "./rack-output.ts";
import { inspectScene } from "./rack-scene.ts";

const NVME_MOUNTS = ["generic", "owc-reference"];
const HDD_SUPPORT_NOTE =
    "Continuous skids rest nominally on base ribs and slide over them; load, wear and vibration untested.";

export interface RackOptions {
    readonly railSize?: string;
    readonly nvmeMount?: string;
}

export interface RackAssembly {
    readonly components: SceneComponent[];
    readonly shapes: Map<string, Shape>;
    readonly metadata: Record<string, unknown>;
}

interface Allocation {
    readonly frame: FrameLayout;
    readonly z: BayFloors;
    readonly requiredUnits: number;
}

function checkMount(parameters: Parameters, nvmeMount: string): void {
    if (!NVME_MOUNTS.includes(nvmeMount)) {
        throw new MacrackError(`Unknown NVMe mount: ${nvmeMount}`);
    }
    if (nvmeMount === "owc-reference" && parameters.nvme === null) {
        throw new MacrackError("OWC comparison requires an explicit [nvme] enclosure envelope");
    }
    let { mac } = parameters;
    if (mac.width > 146 || mac.depth > 146.4 || mac.height > 3 * U) {
        throw new MacrackError(
            "Mac reference envelope exceeds the original 3U cradle's outer allocation",
        );
    }
}

/** Bay floors, bottom-up: storage, then a rail pitch of air, then the original Mac module. */
function allocate(frame: FrameLayout, parameters: Parameters, railSize: string): Allocation {
    let { design } = parameters;
    let air = design.hddUnits + design.sataUnits + design.nvmeUnits;
    let indices: Record<keyof BayFloors, number> = {
        hdd: 0,
        sata: design.hddUnits,
        nvme: design.hddUnits + design.sataUnits,
        air,
        mac: air + 1,
    };
    let requiredUnits = indices.mac + 3;
    let usable = frame.measurements.usable_full_units;
    if (requiredUnits > usable) {
        throw new MacrackError(
            `${railSize} rails provide ${usable} full U; this layout requires ${requiredUnits} U`,
        );
    }
    let origin = (index: number): number => {
        let value = frame.slotOrigins[index];
        if (value === undefined) throw new RangeError(`no frame slot ${index}`);
        return value;
    };
    return {
        frame,
        requiredUnits,
        z: {
            hdd: origin(indices.hdd),
            sata: origin(indices.sata),
            nvme: origin(indices.nvme),
            air: origin(indices.air),
            mac: origin(indices.mac),
        },
    };
}

async function rackMetadata(
    sources: string,
    profile: SourceProfile,
    parameters: Parameters,
    allocation: Allocation,
    nvmeMount: string,
    parts: { readonly interfaces: Record<string, unknown>; readonly macParts: SceneComponent[] },
): Promise<Record<string, unknown>> {
    let { frame, z, requiredUnits } = allocation;
    let base = frame.measurements.base;
    return {
        source_profile: profile.inventory(),
        source_templates: await inspectSources(sources),
        parameters: parametersMetadata(parameters),
        frame: frame.measurements,
        source_module_measurements: {
            mac: macCradleMeasurements(profile),
            owc: nvmeMount === "owc-reference" ? owcShelfMeasurements(profile) : null,
        },
        nvme_mount: nvmeMount,
        purchases_assumed: false,
        allocation: {
            required_units: requiredUnits,
            bay_floor_z_mm: z,
            module_y_mm: frame.moduleY,
        },
        hdd_support: {
            base_contact_z_mm: base.base_rib_top_z,
            effective_skid_height_mm: z.hdd - base.base_rib_top_z,
            bearing_ribs_y_mm: base.base_cross_ribs_y,
            note: HDD_SUPPORT_NOTE,
        },
        interface_checks: parts.interfaces,
        cutaway_hide: [
            ...parts.macParts.map(part => part.name),
            ...frame.placements.filter(part => part.name === "rack_top").map(part => part.name),
        ],
    };
}

export async function assembleRack(
    sources: string,
    profile: SourceProfile,
    parameters: Parameters,
    options: RackOptions = {},
): Promise<RackAssembly> {
    let { railSize = "full", nvmeMount = "generic" } = options;
    validateParameters(parameters);
    checkMount(parameters, nvmeMount);
    let allocation = allocate(buildFrame(profile, railSize), parameters, railSize);
    let { frame, z } = allocation;
    let components = frame.placements.map(part => sourceComponent(profile, part, "source_frame"));
    let macParts = macPlacements(profile, z.mac, frame.moduleY).map(part =>
        sourceComponent(profile, part, "source_module"),
    );
    components.push(...macParts);
    let shapes = new Map<string, Shape>();
    if (nvmeMount === "owc-reference") {
        let shelf = owcPlacement(profile, z.nvme, frame.moduleY);
        components.push(sourceComponent(profile, shelf, "source_module"));
    }
    let carriers = await carrierComponents(sources, parameters, frame, z, nvmeMount, shapes);
    components.push(...carriers.components);
    components.push(...(await deviceComponents(profile, parameters, frame, z, nvmeMount, shapes)));
    let metadata = await rackMetadata(sources, profile, parameters, allocation, nvmeMount, {
        interfaces: carriers.interfaces,
        macParts,
    });
    return { components, shapes, metadata };
}

/** Checks every destination before moving anything: a refused rack leaves the output untouched. */
async function claimTargets(output: string, relatives: readonly string[]): Promise<void> {
    for (let relative of relatives) {
        let target = await ownedPath(output, relative);
        if (await exists(target)) {
            throw new MacrackError(`Unowned rack output exists: ${relative}`);
        }
        let parent = dirname(target);
        if ((await exists(parent)) && !(await isDirectory(parent))) {
            throw new MacrackError(`Rack output directory is occupied by a file: ${parent}`);
        }
    }
}

export async function exportRack(
    sources: string,
    profilePath: string,
    parameters: Parameters,
    output: string,
    options: RackOptions = {},
): Promise<RackManifest> {
    await mkdir(output, { recursive: true });
    await invalidateRack(output);
    let profile = await SourceProfile.open(profilePath);
    let assembly = await assembleRack(sources, profile, parameters, options);
    let report = await inspectScene(assembly.components);
    if (!report.physical_geometry_ok) {
        throw new MacrackError(
            `Full rack has physical-part intersections: ${JSON.stringify(report.physical_interferences)}`,
        );
    }
    let staging = await mkdtemp(join(output, ".rack-"));
    try {
        let manifest = await writeGeometry(
            staging,
            assembly.components,
            assembly.shapes,
            report,
            assembly.metadata,
        );
        let relatives = Object.keys(manifest.files);
        await claimTargets(output, relatives);
        for (let relative of relatives) {
            let target = await ownedPath(output, relative);
            await mkdir(dirname(target), { recursive: true });
            await rename(join(staging, relative), target);
        }
        await rename(join(staging, MANIFEST_NAME), join(output, MANIFEST_NAME));
        return manifest;
    } finally {
        await rm(staging, { recursive: true, force: true });
    }
}
