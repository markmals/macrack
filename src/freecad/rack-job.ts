import { join } from "node:path";

import type { RackManifest } from "./rack-manifest.ts";

import { MacrackError } from "../errors.ts";
import { BACK, FRONT } from "./camera.ts";
import { checkedPath } from "./paths.ts";
import { stepName } from "./rack-manifest.ts";

const COLORS: Record<string, [number, number, number]> = {
    candidate: [0.18, 0.55, 0.57],
    reference: [0.88, 0.48, 0.18],
    reservation: [0.2, 0.5, 0.85],
    source_frame: [0.16, 0.18, 0.21],
    source_module: [0.73, 0.76, 0.79],
};

const TRANSPARENCY: Record<string, number> = { reference: 65, reservation: 90 };

export const VIEWS = [
    { cutaway: false, name: "rack-front.png", orientation: FRONT },
    { cutaway: false, name: "rack-back.png", orientation: BACK },
    { cutaway: true, name: "rack-cutaway.png", orientation: FRONT },
];

const IMAGE_WIDTH = 1400;
const IMAGE_HEIGHT = 1200;

export interface RackShapeJob {
    readonly key: string;
    readonly path: string;
    readonly kind: "step" | "stl";
    readonly convert: { readonly key: string; readonly path: string } | null;
}

export interface RackComponentJob {
    readonly name: string;
    readonly role: string;
    readonly shape: string;
    readonly transform: readonly (readonly number[])[];
    readonly note: string;
    readonly color: readonly [number, number, number];
    readonly display_mode: string;
    readonly transparency: number;
}

export interface RackViewJob {
    readonly name: string;
    readonly path: string;
    readonly orientation: readonly number[];
    readonly hide: readonly number[];
    readonly width: number;
    readonly height: number;
}

export interface RackJob {
    readonly staging: string;
    readonly document: string;
    readonly assembly: string;
    readonly final_orientation: readonly number[];
    readonly shapes: readonly RackShapeJob[];
    readonly components: readonly RackComponentJob[];
    readonly views: readonly RackViewJob[];
}

function color(role: string): [number, number, number] {
    let value = COLORS[role];
    if (value === undefined) throw new MacrackError(`Unknown rack component role: ${role}`);
    return value;
}

async function shapeJobs(
    root: string,
    staging: string,
    manifest: RackManifest,
): Promise<RackShapeJob[]> {
    let shapes: RackShapeJob[] = [];
    for (let relative of Object.keys(manifest.geometry)) {
        let key = stepName(relative);
        shapes.push({
            convert: relative.endsWith(".stl")
                ? { key, path: await checkedPath(staging, key) }
                : null,
            key: relative,
            kind: relative.endsWith(".step") ? "step" : "stl",
            path: await checkedPath(root, relative),
        });
    }
    return shapes;
}

function componentJobs(manifest: RackManifest): RackComponentJob[] {
    return manifest.validation.components.map(component => ({
        color: color(component.role),
        display_mode: component.role === "candidate" ? "Flat Lines" : "Shaded",
        name: component.name,
        note: component.note,
        role: component.role,
        shape: component.file,
        transform: component.transform,
        transparency: TRANSPARENCY[component.role] ?? 0,
    }));
}

/** The whole render as data: which shapes to load, how to dress them and what to save. */
export async function buildRackJob(
    root: string,
    staging: string,
    manifest: RackManifest,
): Promise<RackJob> {
    let components = componentJobs(manifest);
    let hide = components.flatMap((component, index) =>
        manifest.cutaway_hide.includes(component.name) ? [index] : [],
    );
    return {
        assembly: join(staging, "rack.step"),
        components,
        document: join(staging, "rack.FCStd"),
        final_orientation: FRONT,
        shapes: await shapeJobs(root, staging, manifest),
        staging,
        views: VIEWS.map(view => ({
            height: IMAGE_HEIGHT,
            hide: view.cutaway ? hide : [],
            name: view.name,
            orientation: view.orientation,
            path: join(staging, view.name),
            width: IMAGE_WIDTH,
        })),
    };
}
