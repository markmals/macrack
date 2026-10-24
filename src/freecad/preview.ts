import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { FRONT } from "./camera.ts";
import { runFreecadJob } from "./freecad-python.ts";

const STYLES = [
    { color: [0.75, 0.3, 0.2], match: ["reference_", "nvme_enclosure_"], transparency: 65 },
    { color: [0.2, 0.5, 0.85], match: ["reservation"], transparency: 85 },
];

const DEFAULT_STYLE = { color: [0.7, 0.73, 0.77] };

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 1000;

/** One STEP file, dressed by label and photographed from the rack's front view. */
export async function renderPreview(
    step: string,
    image: string,
    options: { readonly document?: string | undefined } = {},
): Promise<void> {
    await mkdir(dirname(resolve(image)), { recursive: true });
    if (options.document !== undefined) {
        await mkdir(dirname(resolve(options.document)), { recursive: true });
    }
    await runFreecadJob("preview_worker.py", {
        default_style: DEFAULT_STYLE,
        document: options.document === undefined ? null : resolve(options.document),
        height: IMAGE_HEIGHT,
        image: resolve(image),
        orientation: FRONT,
        step: resolve(step),
        styles: STYLES,
        width: IMAGE_WIDTH,
    });
    console.log(`FreeCAD preview: ${image}`);
}
