import argparse
import json
from pathlib import Path

from macrack.assembly import build_assembly
from macrack.export import ExportError, export_project
from macrack.output_state import invalidate_output
from macrack.parameters import load_parameters
from macrack.rack_interface import inspect_sources


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate private-use Rack Pro candidate CAD in millimeters"
    )
    parser.add_argument("command", choices=("inspect", "build"))
    parser.add_argument("--sources", type=Path, default=Path("assets/rack-pro"))
    parser.add_argument("--config", type=Path)
    parser.add_argument("--output", type=Path, default=Path("exports"))
    args = parser.parse_args()
    try:
        if args.command == "build":
            invalidate_output(args.output)
        source_report = inspect_sources(args.sources)
        if args.command == "inspect":
            print(json.dumps(source_report, indent=2))
            return
        parameters = load_parameters(args.config)
        artifacts, coupons, metadata = build_assembly(args.sources, parameters)
        metadata["source_measurements"] = source_report
        export_project(artifacts, coupons, args.output, metadata)
        print(
            f"Exported {len([part for part in artifacts if part.kind == 'printable'])} candidate carriers and {len(coupons)} fit coupons to {args.output}"
        )
        print(
            f"Allocation: {metadata['allocation']['total_U']}U; complete exterior and hardware fit remain unvalidated."
        )
        print(f"Measured checks and limitations: {args.output / 'manifest.json'}")
    except (ValueError, FileNotFoundError, ExportError) as error:
        parser.exit(2, f"macrack: {error}\n")
