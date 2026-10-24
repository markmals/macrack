import argparse
import json
from pathlib import Path

from macrack.assembly import build_assembly
from macrack.export import ExportError, export_project
from macrack.full_assembly import export_rack
from macrack.output_state import invalidate_output
from macrack.parameters import load_parameters
from macrack.rack_frame import build_frame
from macrack.rack_interface import inspect_sources
from macrack.source_profile import SourceProfile


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate private-use Rack Pro candidate CAD in millimeters"
    )
    parser.add_argument("command", choices=("inspect", "build", "rack"))
    parser.add_argument("--sources", type=Path, default=Path("assets/rack-pro"))
    parser.add_argument("--config", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--profile", type=Path)
    parser.add_argument("--rail-size", choices=("full", "short"), default="full")
    parser.add_argument("--nvme-mount", choices=("generic", "owc-reference"), default="generic")
    args = parser.parse_args()
    output = args.output or Path("exports/full-rack" if args.command == "rack" else "exports")
    profile = args.profile or args.sources / "rack-pro.3mf"
    try:
        if args.command == "rack":
            manifest = export_rack(
                args.sources,
                profile,
                load_parameters(args.config),
                output,
                args.rail_size,
                args.nvme_mount,
            )
            print(f"Full-rack source geometry and candidate parts: {output / 'rack.json'}")
            print(f"Modeled envelope (mm): {manifest['validation']['size_mm']}")
            print(
                "Unresolved conservative reference intersections: "
                f"{len(manifest['validation']['reference_envelope_interferences'])}"
            )
            print("Use scripts/freecad_rack.py to export the full STEP, FreeCAD document and PNGs.")
            return
        if args.command == "build":
            invalidate_output(output)
        source_report = inspect_sources(args.sources)
        if args.command == "inspect":
            if args.profile is not None or profile.exists():
                original = SourceProfile(profile)
                source_report["original_profile"] = original.inventory()
                source_report["frame"] = build_frame(original, args.rail_size).measurements
            else:
                source_report["original_profile"] = {
                    "available": False,
                    "expected_file": str(profile),
                }
            print(json.dumps(source_report, indent=2))
            return
        parameters = load_parameters(args.config)
        artifacts, coupons, metadata = build_assembly(args.sources, parameters)
        metadata["source_measurements"] = source_report
        export_project(artifacts, coupons, output, metadata)
        print(
            f"Exported {len([part for part in artifacts if part.kind == 'printable'])} candidate carriers and {len(coupons)} fit coupons to {output}"
        )
        print(
            f"Allocation: {metadata['allocation']['total_U']}U; complete exterior and hardware fit remain unvalidated."
        )
        print(f"Measured checks and limitations: {output / 'manifest.json'}")
    except (ValueError, FileNotFoundError, ExportError) as error:
        parser.exit(2, f"macrack: {error}\n")
