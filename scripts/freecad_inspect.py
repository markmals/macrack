#!/usr/bin/env python3
"""Independent STEP check with FreeCAD's own OpenCascade build.

The exports are produced by build123d/OCP; re-reading them in FreeCAD catches problems
that a round trip through the writing library would hide. The measurements stay in this
JSON report: the optional FreeCAD document is an inspection aid, never a source of truth.

Run with any Python; it re-executes itself under the FreeCAD interpreter when needed:

    python scripts/freecad_inspect.py exports/assembly.step exports/parts/*.step \
        --report exports/freecad-report.json [--document exports/inspect.FCStd]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

ENV_PYTHON = "MACRACK_FREECAD_PYTHON"

BUNDLE = Path("/Applications/FreeCAD.app/Contents/Resources")

API_CALLS = [
    "FreeCAD.Version()",
    "Part.Shape().read(path)",
    "Shape.isValid()",
    "Shape.Solids / Shape.Shells / Shape.Faces",
    "Shape.Volume",
    "Shape.BoundBox (XMin..ZMax, XLength/YLength/ZLength)",
    "Import.insert(path, doc.Name) and FreeCAD.ActiveDocument.saveAs(path)  [--document only]",
]

LIMITATIONS = [
    "Validity, solid count and bounding box are geometric facts about the file, not a fit, print or load result.",
    "Part.read() ignores assembly structure: labels and colors are only reported in --document mode.",
    "A FreeCAD document written by --document is for visual inspection; the JSON report is the measured result.",
]


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Measure STEP files with FreeCAD.")
    parser.add_argument("steps", nargs="+", help="STEP files to inspect")
    parser.add_argument("--report", default="freecad-report.json", help="JSON report path")
    parser.add_argument("--document", default=None, help="optional .FCStd to write for inspection")
    return parser.parse_args(argv)


def _bbox(shape) -> dict:
    box = shape.BoundBox
    return {
        "min": [round(box.XMin, 6), round(box.YMin, 6), round(box.ZMin, 6)],
        "max": [round(box.XMax, 6), round(box.YMax, 6), round(box.ZMax, 6)],
        "size": [round(box.XLength, 6), round(box.YLength, 6), round(box.ZLength, 6)],
        "volume_mm3": round(box.XLength * box.YLength * box.ZLength, 6),
    }


def inspect_steps(step_paths: list[str], document: str | None) -> dict:
    import FreeCAD
    import Part

    files = []
    issues: list[str] = []
    for raw in step_paths:
        path = Path(raw)
        entry: dict = {"path": str(path), "exists": path.is_file()}
        if not entry["exists"]:
            entry["issues"] = ["file not found"]
            issues.append(f"{path}: file not found")
            files.append(entry)
            continue
        shape = Part.Shape()
        shape.read(str(path))
        file_issues = []
        entry.update(
            {
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "shape_type": shape.ShapeType,
                "is_valid": bool(shape.isValid()),
                "solid_count": len(shape.Solids),
                "shell_count": len(shape.Shells),
                "face_count": len(shape.Faces),
                "volume_mm3": round(shape.Volume, 6),
                "bbox": _bbox(shape),
            }
        )
        if not entry["is_valid"]:
            file_issues.append("shape fails FreeCAD validity check")
        if entry["solid_count"] < 1:
            file_issues.append("no solid in file")
        if entry["volume_mm3"] <= 0:
            file_issues.append(f"non-positive volume {entry['volume_mm3']} mm^3")
        if entry["bbox"]["volume_mm3"] <= 0:
            file_issues.append("degenerate bounding box")
        entry["issues"] = file_issues
        issues.extend(f"{path}: {text}" for text in file_issues)
        files.append(entry)

    document_result = None
    if document is not None:
        import Import

        doc = FreeCAD.newDocument("macrack_inspect")
        for entry in files:
            if entry["exists"]:
                Import.insert(entry["path"], doc.Name)
        doc.recompute()
        doc_path = Path(document)
        doc_path.parent.mkdir(parents=True, exist_ok=True)
        doc.saveAs(str(doc_path))
        document_result = {
            "path": str(doc_path),
            "object_labels": [obj.Label for obj in doc.Objects],
        }
        FreeCAD.closeDocument(doc.Name)

    return {
        "schema": "macrack.freecad-inspect/1",
        "ok": not issues,
        "tool": {
            "freecad_version": ".".join(FreeCAD.Version()[:3]),
            "executable": sys.executable,
            "python": sys.version.split()[0],
        },
        "api_calls": API_CALLS,
        "files": files,
        "document": document_result,
        "limitations": LIMITATIONS,
        "issues": issues,
    }


def _freecad_python() -> list[str] | None:
    """Bundled interpreter plus the lib directory holding FreeCAD.so/Part.so."""
    override = os.environ.get(ENV_PYTHON)
    candidates = [Path(override)] if override else []
    candidates.append(BUNDLE / "bin" / "python")
    for candidate in candidates:
        if candidate.is_file():
            lib = candidate.parent.parent / "lib"
            if not (lib / "FreeCAD.so").is_file():
                continue
            return [str(candidate), str(lib)]
    return None


def _reexec(argv: list[str]) -> int:
    interpreter = _freecad_python()
    if interpreter is None:
        print(
            f"FreeCAD not found. Install FreeCAD.app or set {ENV_PYTHON} to a Python "
            "interpreter shipped with FreeCAD (its ../lib must contain FreeCAD.so).",
            file=sys.stderr,
        )
        return 2
    executable, lib = interpreter
    pythonpath = os.pathsep.join([lib, os.environ.get("PYTHONPATH", "")]).rstrip(os.pathsep)
    env = dict(os.environ, PYTHONPATH=pythonpath)
    command = [executable, str(Path(__file__).resolve()), *argv]
    return subprocess.run(command, env=env, check=False).returncode


def main() -> int:
    argv = sys.argv[1:]
    args = parse_args(argv)
    report_path = Path(args.report)
    # A previous report must never survive a failed run.
    report_path.unlink(missing_ok=True)
    try:
        import FreeCAD  # noqa: F401
    except ModuleNotFoundError:
        return _reexec(argv)

    report = inspect_steps(args.steps, args.document)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print(
        json.dumps(
            {"ok": report["ok"], "report": str(report_path), "issues": report["issues"]}, indent=2
        )
    )
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
