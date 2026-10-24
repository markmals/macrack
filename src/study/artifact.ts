import type { Shape } from "@roonieone/caddy";

import type { Vector3 } from "../mesh/affine.ts";
import type { Envelope } from "../parameters.ts";

import { block } from "../carriers/rack-interface.ts";

export const ARTIFACT_KINDS = ["printable", "keepout", "reservation"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** One named solid of the study, in local coordinates plus the offset it sits at. */
export interface Artifact {
    readonly name: string;
    readonly shape: Shape;
    readonly kind: ArtifactKind;
    readonly position: Vector3;
    readonly note: string;
}

export interface ArtifactOptions {
    readonly kind?: ArtifactKind;
    readonly position?: Vector3;
    readonly note?: string;
}

export function artifact(name: string, shape: Shape, options: ArtifactOptions = {}): Artifact {
    let { kind = "printable", position = [0, 0, 0] as Vector3, note = "" } = options;
    return { name, shape, kind, position, note };
}

export function placed(item: Artifact): Shape {
    return item.shape.translate(item.position);
}

export function deviceKeepout(name: string, envelope: Envelope, position: Vector3): Artifact {
    return artifact(name, block(envelope.width, envelope.depth, envelope.height), {
        kind: "keepout",
        position,
        note: `Envelope only; ${envelope.status}; ${envelope.source}. Connectors and cables are NOT included.`,
    });
}
