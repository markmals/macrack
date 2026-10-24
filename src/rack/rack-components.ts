import type { Shape } from "@roonieone/caddy";

import type { InterfaceCheck } from "../carriers/rack-interface.ts";
import type { Vector3 } from "../mesh/affine.ts";
import type { Envelope, Parameters } from "../parameters.ts";
import type { FrameLayout } from "../source/rack-frame.ts";
import type { SourcePlacement, SourceProfile } from "../source/source-profile.ts";
import type { SceneComponent, SceneRole } from "./rack-scene.ts";

import { buildHddInsert } from "../carriers/hdd-insert.ts";
import { buildNvmeInsert, enclosureCenters, nvmeDeviceFront } from "../carriers/nvme-insert.ts";
import { block, interfaceCheck } from "../carriers/rack-interface.ts";
import { buildSataInsert } from "../carriers/sata-ssd-insert.ts";
import { MacrackError } from "../errors.ts";
import { translation } from "../mesh/affine.ts";
import { macReferenceOrigin, owcReferenceOrigins } from "../source/source-modules.ts";
import { cadMesh } from "./rack-scene.ts";

const CANDIDATE_NOTE =
    "Parametric candidate with exact STEP-template side geometry; hardware retention unvalidated.";
const RESERVATION_NOTE =
    "One measured rail pitch kept empty below the original Mac module; airflow untested.";

export type Bay = "hdd" | "sata" | "nvme" | "air" | "mac";
export type BayFloors = Record<Bay, number>;

export interface CadComponent {
    readonly name: string;
    readonly shape: Shape;
    readonly role: SceneRole;
    readonly position: Vector3;
    readonly note: string;
}

export function sourceComponent(
    profile: SourceProfile,
    placement: SourcePlacement,
    role: SceneRole,
): SceneComponent {
    return {
        name: placement.name,
        role,
        mesh: profile.mesh(placement.objectId),
        transform: placement.transform,
        file: `source/object_${placement.objectId}.stl`,
        note: placement.note,
    };
}

export async function cadComponent(
    component: CadComponent,
    cadShapes: Map<string, Shape>,
): Promise<SceneComponent> {
    let { name, shape, role, position, note } = component;
    if (!shape.isValid || shape.solids.length !== 1 || shape.volume <= 0) {
        throw new MacrackError(`${name}: expected a valid, positive single CAD solid`);
    }
    let directory = role === "candidate" ? "candidates" : "references";
    let file = `${directory}/${name}.step`;
    cadShapes.set(file, shape);
    return {
        name,
        role,
        mesh: await cadMesh(shape),
        transform: translation(...position),
        file,
        note,
    };
}

export function referenceComponent(
    name: string,
    envelope: Envelope,
    position: Vector3,
    cadShapes: Map<string, Shape>,
): Promise<SceneComponent> {
    return cadComponent(
        {
            name,
            shape: block(envelope.width, envelope.depth, envelope.height),
            role: "reference",
            position,
            note: `Conservative body envelope only; not vendor CAD or a hardware selection. ${envelope.source}`,
        },
        cadShapes,
    );
}

/** The HDD carrier's skids are sized to land on the base ribs under its own bay floor. */
export function supportedHdd(
    sources: string,
    parameters: Parameters,
    frame: FrameLayout,
    floorZ: number,
): Promise<Shape> {
    let skidHeight = floorZ - frame.measurements.base.base_rib_top_z;
    if (skidHeight <= 0) {
        throw new MacrackError("HDD floor must sit above the base bearing surfaces");
    }
    return buildHddInsert(sources, {
        ...parameters,
        design: { ...parameters.design, hddFeet: skidHeight },
    });
}

export interface CarrierComponents {
    readonly components: SceneComponent[];
    readonly interfaces: Record<string, InterfaceCheck>;
}

export async function carrierComponents(
    sources: string,
    parameters: Parameters,
    frame: FrameLayout,
    z: BayFloors,
    nvmeMount: string,
    cadShapes: Map<string, Shape>,
): Promise<CarrierComponents> {
    let { design } = parameters;
    let hdd = await supportedHdd(sources, parameters, frame, z.hdd);
    let candidates: [name: string, shape: Shape, units: number, bay: Bay][] = [
        ["hdd_carrier", hdd, design.hddUnits, "hdd"],
        ["sata_ssd_carrier", await buildSataInsert(sources, parameters), design.sataUnits, "sata"],
    ];
    if (nvmeMount === "generic") {
        let nvme = await buildNvmeInsert(sources, parameters);
        candidates.push(["dual_nvme_carrier", nvme, design.nvmeUnits, "nvme"]);
    }
    let components: SceneComponent[] = [];
    let interfaces: Record<string, InterfaceCheck> = {};
    for (let [name, shape, units, bay] of candidates) {
        interfaces[name] = await interfaceCheck(shape, sources, units, design.sideWall);
        components.push(
            await cadComponent(
                {
                    name,
                    shape,
                    role: "candidate",
                    position: [0, frame.moduleY, z[bay]],
                    note: CANDIDATE_NOTE,
                },
                cadShapes,
            ),
        );
    }
    return { components, interfaces };
}

function enclosureOrigins(
    profile: SourceProfile,
    parameters: Parameters,
    frame: FrameLayout,
    z: BayFloors,
    nvmeMount: string,
): Vector3[] {
    if (nvmeMount === "owc-reference") {
        return owcReferenceOrigins(profile, z.nvme, frame.moduleY);
    }
    let { design } = parameters;
    let front = frame.moduleY + nvmeDeviceFront(parameters);
    return enclosureCenters(parameters).map(x => [
        x,
        front,
        z.nvme + design.floor + design.standOff,
    ]);
}

export async function deviceComponents(
    profile: SourceProfile,
    parameters: Parameters,
    frame: FrameLayout,
    z: BayFloors,
    nvmeMount: string,
    cadShapes: Map<string, Shape>,
): Promise<SceneComponent[]> {
    let { design } = parameters;
    let deviceHeight = design.floor + design.standOff;
    let components: SceneComponent[] = [];
    let bays: [name: string, envelope: Envelope, bay: Bay][] = [
        ["reference_HDD_NOT_SELECTED", parameters.hdd, "hdd"],
        ["reference_Samsung_NOT_CONFIRMED", parameters.sata, "sata"],
    ];
    for (let [name, envelope, bay] of bays) {
        let position: Vector3 = [0, frame.moduleY + design.deviceFront, z[bay] + deviceHeight];
        components.push(await referenceComponent(name, envelope, position, cadShapes));
    }
    components.push(
        await referenceComponent(
            "reference_Mac_NOT_SELECTED",
            parameters.mac,
            macReferenceOrigin(profile, z.mac, frame.moduleY),
            cadShapes,
        ),
    );
    if (parameters.nvme !== null) {
        let origins = enclosureOrigins(profile, parameters, frame, z, nvmeMount);
        for (let [index, position] of origins.entries()) {
            let name = `reference_NVMe_enclosure_${index + 1}_NOT_SELECTED`;
            components.push(await referenceComponent(name, parameters.nvme, position, cadShapes));
        }
    }
    components.push(
        await cadComponent(
            {
                name: "Mac_airflow_reservation",
                shape: block(146, Math.max(146.4, parameters.mac.depth), z.mac - z.air),
                role: "reservation",
                position: [0, frame.moduleY, z.air],
                note: RESERVATION_NOTE,
            },
            cadShapes,
        ),
    );
    return components;
}
