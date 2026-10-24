import type { Shape } from "@roonieone/caddy";

import * as caddy from "@roonieone/caddy";
import { CADFileType } from "@roonieone/caddy";

/** A fixed STEP header timestamp keeps wall-clock metadata out of generated geometry. */
export const STEP_TIMESTAMP = "1980-01-01T00:00:00";

export function exportStep(shape: Shape, path: string): Promise<void> {
    return caddy.export(shape, { name: path, type: CADFileType.Step, timestamp: STEP_TIMESTAMP });
}
