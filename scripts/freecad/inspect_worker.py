"""STEP measurement adapter for FreeCAD's own OpenCascade build.

FreeCAD's API lives only in its bundled Python, so this file stays Python. It reports raw
measurements; which files to read, how they are rounded and what counts as an issue is decided
by the caller.
"""

import json
import sys
from pathlib import Path


def measure(shape) -> dict:
    box = shape.BoundBox
    return {
        "shape_type": shape.ShapeType,
        "is_valid": bool(shape.isValid()),
        "solid_count": len(shape.Solids),
        "shell_count": len(shape.Shells),
        "face_count": len(shape.Faces),
        "volume_mm3": shape.Volume,
        "bbox": {
            "min": [box.XMin, box.YMin, box.ZMin],
            "max": [box.XMax, box.YMax, box.ZMax],
            "size": [box.XLength, box.YLength, box.ZLength],
        },
    }


def write_document(path: str, steps: list[str]) -> dict:
    import FreeCAD
    import Import

    document = FreeCAD.newDocument("macrack_inspect")
    for step in steps:
        Import.insert(step, document.Name)
    document.recompute()
    document.saveAs(path)
    result = {"object_labels": [obj.Label for obj in document.Objects]}
    FreeCAD.closeDocument(document.Name)
    return result


def main(job_path: str) -> None:
    import FreeCAD
    import Part

    job = json.loads(Path(job_path).read_text())
    files = []
    for step in job["steps"]:
        shape = Part.Shape()
        shape.read(step)
        files.append(measure(shape))
    document = None if job["document"] is None else write_document(job["document"], job["steps"])
    facts = {
        "tool": {
            "freecad_version": ".".join(FreeCAD.Version()[:3]),
            "executable": sys.executable,
            "python": sys.version.split()[0],
        },
        "files": files,
        "document": document,
    }
    Path(job["facts"]).write_text(json.dumps(facts, indent=2) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
