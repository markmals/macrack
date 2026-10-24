import { CaddyError } from "@roonieone/caddy";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { TomlError } from "smol-toml";

import { inspectSources } from "./carriers/rack-interface.ts";
import { MacrackError } from "./errors.ts";
import { renderPreview } from "./freecad/preview.ts";
import { renderRack } from "./freecad/rack-render.ts";
import { inspectSteps } from "./freecad/step-inspect.ts";
import { loadParameters } from "./parameters.ts";
import { exportRack } from "./rack/full-assembly.ts";
import { buildFrame } from "./source/rack-frame.ts";
import { SourceProfile } from "./source/source-profile.ts";
import { buildAssembly } from "./study/assembly.ts";
import { exportProject } from "./study/export.ts";
import { invalidateOutput } from "./study/output-state.ts";

const USAGE = `usage: macrack <command> [options]

Generate private-use Rack Pro candidate CAD in millimeters.

  inspect          [--sources DIR] [--profile 3MF] [--rail-size full|short]
  build            [--sources DIR] [--config TOML] [--output DIR]
  rack             [--sources DIR] [--profile 3MF] [--config TOML] [--output DIR]
                   [--rail-size full|short] [--nvme-mount generic|owc-reference]
  freecad-rack     RACK_JSON
  freecad-inspect  STEP... [--report JSON] [--document FCSTD]
  freecad-preview  STEP IMAGE [--document FCSTD]`;

const CAD_OPTIONS = {
    sources: { type: "string", default: "assets/rack-pro" },
    config: { type: "string" },
    output: { type: "string" },
    profile: { type: "string" },
    "rail-size": { type: "string", default: "full" },
    "nvme-mount": { type: "string", default: "generic" },
} as const;

interface CadArguments {
    readonly sources: string;
    readonly config: string | undefined;
    readonly output: string | undefined;
    readonly profile: string;
    /** Whether `--profile` was given, which makes a missing 3MF an error rather than a note. */
    readonly profileGiven: boolean;
    readonly railSize: string;
    readonly nvmeMount: string;
}

function choice(name: string, value: string, allowed: readonly string[]): string {
    if (!allowed.includes(value)) {
        let choices = allowed.map(option => `'${option}'`).join(", ");
        throw new MacrackError(
            `argument --${name}: invalid choice: '${value}' (choose from ${choices})`,
        );
    }
    return value;
}

function parseCadArguments(argv: string[]): CadArguments {
    let { values } = parseArgs({ args: argv, options: CAD_OPTIONS, strict: true });
    return {
        sources: values.sources,
        config: values.config,
        output: values.output,
        profile: values.profile ?? join(values.sources, "rack-pro.3mf"),
        profileGiven: values.profile !== undefined,
        railSize: choice("rail-size", values["rail-size"], ["full", "short"]),
        nvmeMount: choice("nvme-mount", values["nvme-mount"], ["generic", "owc-reference"]),
    };
}

async function inspect(args: CadArguments): Promise<void> {
    let report = await inspectSources(args.sources);
    if (args.profileGiven || existsSync(args.profile)) {
        let original = await SourceProfile.open(args.profile);
        report.original_profile = original.inventory();
        report.frame = buildFrame(original, args.railSize).measurements;
    } else {
        report.original_profile = { available: false, expected_file: args.profile };
    }
    console.log(JSON.stringify(report, null, 2));
}

async function build(args: CadArguments): Promise<void> {
    let output = args.output ?? "exports";
    await invalidateOutput(output);
    let sourceReport = await inspectSources(args.sources);
    let parameters = await loadParameters(args.config);
    let { artifacts, coupons, metadata } = await buildAssembly(args.sources, parameters);
    await exportProject(artifacts, coupons, output, {
        ...metadata,
        source_measurements: sourceReport,
    });
    let printable = artifacts.filter(part => part.kind === "printable").length;
    console.log(
        `Exported ${printable} candidate carriers and ${coupons.length} fit coupons to ${output}`,
    );
    console.log(
        `Allocation: ${metadata.allocation.total_U}U; complete exterior and hardware fit remain unvalidated.`,
    );
    console.log(`Measured checks and limitations: ${join(output, "manifest.json")}`);
}

async function rack(args: CadArguments): Promise<void> {
    let output = args.output ?? "exports/full-rack";
    let manifest = await exportRack(
        args.sources,
        args.profile,
        await loadParameters(args.config),
        output,
        { railSize: args.railSize, nvmeMount: args.nvmeMount },
    );
    let { validation } = manifest;
    console.log(`Full-rack source geometry and candidate parts: ${join(output, "rack.json")}`);
    console.log(`Modeled envelope (mm): ${JSON.stringify(validation.size_mm)}`);
    console.log(
        `Unresolved conservative reference intersections: ${validation.reference_envelope_interferences.length}`,
    );
    console.log(
        `Use \`node src/cli.ts freecad-rack ${join(output, "rack.json")}\` for the full STEP, FreeCAD document and PNGs.`,
    );
}

async function freecadInspect(argv: string[]): Promise<number> {
    let { values, positionals } = parseArgs({
        args: argv,
        options: {
            report: { type: "string", default: "freecad-report.json" },
            document: { type: "string" },
        },
        allowPositionals: true,
    });
    if (positionals.length === 0) throw new MacrackError("freecad-inspect needs STEP files");
    let { ok } = await inspectSteps(positionals, values);
    return ok ? 0 : 1;
}

async function freecadPreview(argv: string[]): Promise<void> {
    let { values, positionals } = parseArgs({
        args: argv,
        options: { document: { type: "string" } },
        allowPositionals: true,
    });
    let [step, image, ...extra] = positionals;
    if (step === undefined || image === undefined || extra.length > 0) {
        throw new MacrackError("freecad-preview needs a STEP file and an image path");
    }
    await renderPreview(step, image, values);
}

async function freecadRack(argv: string[]): Promise<void> {
    let { positionals } = parseArgs({ args: argv, allowPositionals: true });
    let [manifest, ...extra] = positionals;
    if (manifest === undefined || extra.length > 0) {
        throw new MacrackError("freecad-rack needs one rack.json manifest");
    }
    await renderRack(manifest);
}

async function run(command: string | undefined, argv: string[]): Promise<number> {
    switch (command) {
        case "inspect":
            await inspect(parseCadArguments(argv));
            return 0;
        case "build":
            await build(parseCadArguments(argv));
            return 0;
        case "rack":
            await rack(parseCadArguments(argv));
            return 0;
        case "freecad-rack":
            await freecadRack(argv);
            return 0;
        case "freecad-inspect":
            return freecadInspect(argv);
        case "freecad-preview":
            await freecadPreview(argv);
            return 0;
        default:
            throw new MacrackError(`unknown command '${command ?? ""}'\n${USAGE}`);
    }
}

/** Failures a user can act on: reported as one line, not a stack trace. */
function isExpected(error: unknown): error is Error {
    if (
        error instanceof MacrackError ||
        error instanceof CaddyError ||
        error instanceof TomlError
    ) {
        return true;
    }
    let code = error instanceof Error && "code" in error ? String(error.code) : "";
    return code === "ENOENT" || code.startsWith("ERR_PARSE_ARGS");
}

export async function main(argv: readonly string[]): Promise<number> {
    let [command, ...rest] = argv;
    if (command === "--help" || command === "-h") {
        console.log(USAGE);
        return 0;
    }
    try {
        return await run(command, rest);
    } catch (error) {
        if (!isExpected(error)) throw error;
        process.stderr.write(`macrack: ${error.message}\n`);
        return 2;
    }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
