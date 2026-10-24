import { readFile } from "node:fs/promises";
import { parse } from "smol-toml";

import { MacrackError } from "./errors.ts";

export const ENVELOPE_STATUSES = [
    "manufacturer-confirmed",
    "physical-measurement",
    "provisional",
] as const;
export type EnvelopeStatus = (typeof ENVELOPE_STATUSES)[number];

/** Overall device dimensions in mm, with where they came from and how far they are trusted. */
export interface Envelope {
    readonly width: number;
    readonly depth: number;
    readonly height: number;
    readonly source: string;
    readonly status: EnvelopeStatus;
}

/** Design allowances, not measured hardware dimensions; all lengths are mm. */
export interface Design {
    readonly floor: number;
    readonly sideWall: number;
    readonly clearance: number;
    readonly deviceFront: number;
    readonly standOff: number;
    readonly topClearance: number;
    readonly hddFeet: number;
    readonly ventWidth: number;
    readonly ventPitch: number;
    readonly strapWidth: number;
    readonly strapLength: number;
    readonly nvmeUnits: number;
    readonly sataUnits: number;
    readonly hddUnits: number;
}

export interface Parameters {
    readonly design: Design;
    readonly sata: Envelope;
    readonly hdd: Envelope;
    readonly mac: Envelope;
    readonly nvme: Envelope | null;
}

export const DEFAULT_DESIGN: Design = {
    floor: 3.0,
    sideWall: 3.0,
    clearance: 1.0,
    deviceFront: 4.0,
    standOff: 3.0,
    topClearance: 4.0,
    hddFeet: 8.0,
    ventWidth: 8.0,
    ventPitch: 16.0,
    strapWidth: 5.0,
    strapLength: 12.0,
    nvmeUnits: 1,
    sataUnits: 1,
    hddUnits: 2,
};

export const DEFAULT_PARAMETERS: Parameters = {
    design: DEFAULT_DESIGN,
    sata: {
        width: 69.85,
        depth: 100.0,
        height: 6.8,
        source: "Samsung 870 QVO datasheet; reference only until exact owner model is confirmed",
        status: "provisional",
    },
    hdd: {
        width: 101.854,
        depth: 147.0,
        height: 26.11,
        source: "Seagate ST12000NT001 manual 206815300 Rev B; screening envelope, NOT a selected drive",
        status: "provisional",
    },
    mac: {
        width: 127.0,
        depth: 127.0,
        height: 50.0,
        source: "https://support.apple.com/en-us/121555; original M4 cradle reference only",
        status: "provisional",
    },
    nvme: null,
};

const ENVELOPE_SECTIONS = ["sata", "hdd", "mac", "nvme"] as const;
const UNIT_FIELDS = ["nvmeUnits", "sataUnits", "hddUnits"] as const;

/** TOML and manifest keys are snake_case; the TypeScript fields are their camelCase twins. */
function snakeCase(name: string): string {
    return name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function camelCase(name: string): string {
    return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function isPositiveFinite(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function validateEnvelope(envelope: Envelope, name: string): void {
    for (let axis of ["width", "depth", "height"] as const) {
        if (!isPositiveFinite(envelope[axis])) {
            throw new MacrackError(`${name}.${axis} must be a finite positive millimeter value`);
        }
    }
    if (
        typeof envelope.source !== "string" ||
        envelope.source.trim() === "" ||
        !(ENVELOPE_STATUSES as readonly unknown[]).includes(envelope.status)
    ) {
        throw new MacrackError(`${name} needs source and recognized status`);
    }
}

export function validateDesign(design: Design): void {
    for (let [field, value] of Object.entries(design)) {
        if (typeof value !== "number") {
            throw new MacrackError(`design.${snakeCase(field)} must be numeric`);
        }
        if (!isPositiveFinite(value)) {
            throw new MacrackError(`design.${snakeCase(field)} must be finite and positive`);
        }
    }
    for (let field of UNIT_FIELDS) {
        if (![1, 2, 3].includes(design[field])) {
            throw new MacrackError(
                `${snakeCase(field)} must select an original 1U, 2U or 3U template`,
            );
        }
    }
    if (design.floor < 2.4 || design.floor > 6 || design.sideWall < 3 || design.sideWall > 8) {
        throw new MacrackError("floor must be 2.4..6 and side_wall 3..8 mm");
    }
    if (design.ventWidth + 4 > design.ventPitch) {
        throw new MacrackError("Vent webs must be at least 4 mm");
    }
    if (design.strapWidth > 8 || design.strapLength > 20) {
        throw new MacrackError("strap slots exceed the supported carrier geometry");
    }
}

export function validateParameters(parameters: Parameters): void {
    validateDesign(parameters.design);
    for (let name of ENVELOPE_SECTIONS) {
        let envelope = parameters[name];
        if (envelope !== null) validateEnvelope(envelope, name);
    }
    if (parameters.design.hddFeet < 4) {
        throw new MacrackError("HDD feet must retain at least 4 mm of support depth");
    }
}

/** The manifest form: the configuration file's snake_case keys, `null` for an absent NVMe. */
export function parametersMetadata(parameters: Parameters): Record<string, unknown> {
    let design = Object.fromEntries(
        Object.entries(parameters.design).map(([field, value]) => [snakeCase(field), value]),
    );
    return {
        design,
        sata: { ...parameters.sata },
        hdd: { ...parameters.hdd },
        mac: { ...parameters.mac },
        nvme: parameters.nvme === null ? null : { ...parameters.nvme },
    };
}

/**
 * smol-toml reads integers as BigInt here so that `hdd_units = 2.0` stays distinguishable from
 * `hdd_units = 2`; unit counts must be TOML integers, every other number may be either.
 */
function tomlValue(section: string, key: string, value: unknown): unknown {
    if (typeof value !== "bigint") {
        if (section === "design" && (UNIT_FIELDS as readonly string[]).includes(camelCase(key))) {
            throw new MacrackError(`${key} must select an original 1U, 2U or 3U template`);
        }
        return value;
    }
    return Number(value);
}

function updatedSection(
    name: string,
    current: object | null,
    changes: Record<string, unknown>,
): object {
    let fields = new Set(Object.keys(current ?? DEFAULT_PARAMETERS.sata));
    let updated: Record<string, unknown> = { ...current };
    for (let [key, value] of Object.entries(changes)) {
        let field = name === "design" ? camelCase(key) : key;
        if (!fields.has(field) || (name === "design" && snakeCase(field) !== key)) {
            throw new MacrackError(`Invalid ${name} configuration: unexpected key '${key}'`);
        }
        updated[field] = tomlValue(name, key, value);
    }
    let missing = [...fields].filter(field => !(field in updated));
    if (missing.length > 0) {
        throw new MacrackError(
            `Invalid ${name} configuration: missing ${missing.map(field => `'${field}'`).join(", ")}`,
        );
    }
    return updated;
}

/** The defaults, overridden table by table from a TOML file, then validated. */
export async function loadParameters(path?: string): Promise<Parameters> {
    let parameters: Parameters = DEFAULT_PARAMETERS;
    if (path !== undefined) {
        let settings = parse(await readFile(path, "utf8"), { integersAsBigInt: true });
        let known = Object.keys(DEFAULT_PARAMETERS);
        let unknown = Object.keys(settings).filter(name => !known.includes(name));
        if (unknown.length > 0) {
            throw new MacrackError(
                `Unknown configuration sections: ${unknown
                    .toSorted()
                    .map(name => `'${name}'`)
                    .join(", ")}`,
            );
        }
        for (let [name, changes] of Object.entries(settings)) {
            if (typeof changes !== "object" || changes === null || Array.isArray(changes)) {
                throw new MacrackError(`${name} must be a TOML table`);
            }
            let current = parameters[name as keyof Parameters];
            let updated = updatedSection(name, current, changes as Record<string, unknown>);
            parameters = { ...parameters, [name]: updated };
        }
    }
    validateParameters(parameters);
    return parameters;
}
