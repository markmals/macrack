import { Color } from "@roonieone/caddy";

import type { ArtifactKind } from "./artifact.ts";

/** Display colour of each artifact kind, in the order assembly groups are written. */
export const KIND_COLORS: Record<ArtifactKind, Color> = {
    printable: new Color(0.7, 0.72, 0.75, 1.0),
    keepout: new Color(0.85, 0.25, 0.2, 0.35),
    reservation: new Color(0.2, 0.55, 0.85, 0.25),
};
