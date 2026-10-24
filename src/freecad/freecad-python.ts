import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";

import { MacrackError } from "../errors.ts";
import { isFile } from "../files.ts";

export const ENV_PYTHON = "MACRACK_FREECAD_PYTHON";

const BUNDLE_PYTHON = "/Applications/FreeCAD.app/Contents/Resources/bin/python";
const WORKERS = resolve(import.meta.dirname, "..", "..", "scripts", "freecad");
const MISSING_FREECAD =
    `FreeCAD not found. Install FreeCAD.app or set ${ENV_PYTHON} to a Python ` +
    "interpreter shipped with FreeCAD (its ../lib must contain FreeCAD.so).";

export interface FreecadPython {
    readonly executable: string;
    readonly lib: string;
}

/** Bundled interpreter plus the lib directory holding FreeCAD.so/Part.so. */
export async function freecadPython(): Promise<FreecadPython | null> {
    let override = process.env[ENV_PYTHON];
    let candidates = override === undefined || override === "" ? [] : [override];
    candidates.push(BUNDLE_PYTHON);
    for (let candidate of candidates) {
        if (!(await isFile(candidate))) continue;
        let lib = join(dirname(dirname(candidate)), "lib");
        if (!(await isFile(join(lib, "FreeCAD.so")))) continue;
        return { executable: candidate, lib };
    }
    return null;
}

function run(python: FreecadPython, args: string[]): Promise<number> {
    let pythonpath = [python.lib, process.env["PYTHONPATH"] ?? ""]
        .join(delimiter)
        .replace(new RegExp(`${delimiter}+$`), "");
    let { promise, reject, resolve: settle } = Promise.withResolvers<number>();
    let child = spawn(python.executable, args, {
        env: { ...process.env, PYTHONPATH: pythonpath },
        stdio: "inherit",
    });
    child.on("error", (error: Error) => {
        reject(new MacrackError(`Could not run FreeCAD's Python: ${error.message}`));
    });
    child.on("close", code => settle(code ?? 1));
    return promise;
}

/**
 * Runs a FreeCAD worker on a JSON job and returns the facts it measured. The workers only drive
 * FreeCAD; every tolerance, comparison and report stays on this side.
 */
export async function runFreecadJob(worker: string, job: object): Promise<unknown> {
    let python = await freecadPython();
    if (python === null) throw new MacrackError(MISSING_FREECAD);
    let directory = await mkdtemp(join(tmpdir(), "macrack-freecad-"));
    try {
        let facts = join(directory, "facts.json");
        let jobPath = join(directory, "job.json");
        await writeFile(jobPath, `${JSON.stringify({ ...job, facts }, null, 2)}\n`);
        let code = await run(python, [join(WORKERS, worker), jobPath]);
        if (code !== 0) {
            throw new MacrackError(`FreeCAD worker ${worker} failed with exit code ${code}`);
        }
        try {
            return JSON.parse(await readFile(facts, "utf8")) as unknown;
        } catch {
            throw new MacrackError(`FreeCAD worker ${worker} wrote no measurements`);
        }
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
}
