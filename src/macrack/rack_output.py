import hashlib
import json
from pathlib import Path

import numpy as np
import trimesh
from build123d import export_step

from macrack.export import STEP_TIMESTAMP
from macrack.rack_scene import SceneComponent

MANIFEST_NAME = "rack.json"


def owned_path(root: Path, relative: str) -> Path:
    path = Path(relative)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"Invalid rack output path: {relative}")
    allowed_directory = (
        len(path.parts) == 2
        and path.parts[0] in {"source", "candidates", "references"}
        and path.suffix in {".step", ".stl"}
    )
    allowed_root_file = len(path.parts) == 1 and path.name in {
        "rack.step",
        "rack.FCStd",
        "rack-front.png",
        "rack-back.png",
        "rack-cutaway.png",
        "freecad-rack-report.json",
    }
    if not (allowed_directory or allowed_root_file):
        raise ValueError(f"Unrecognized rack output path: {relative}")
    target = root / path
    if root.resolve() not in target.resolve().parents:
        raise ValueError(f"Rack output escapes directory: {relative}")
    current = root
    for segment in path.parts:
        current /= segment
        if current.is_symlink():
            raise ValueError(f"Refusing symlinked rack output: {current}")
    return target


def invalidate_rack(root: Path) -> None:
    manifest_path = root / MANIFEST_NAME
    if manifest_path.is_symlink():
        raise ValueError(f"Refusing a symlinked rack manifest: {manifest_path}")
    if not manifest_path.exists():
        return
    previous = json.loads(manifest_path.read_text())
    if previous.get("schema") != "macrack.rack/1":
        raise ValueError(f"Refusing an unrecognized rack manifest: {manifest_path}")
    owned = [(owned_path(root, name), digest) for name, digest in previous["files"].items()]
    for path, digest in owned:
        if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(
                f"Generated rack file was modified; preserve it before rebuilding: {path}"
            )
    manifest_path.unlink()
    for path, _ in owned:
        path.unlink(missing_ok=True)


def write_geometry(
    root: Path, components: list[SceneComponent], cad_shapes: dict, report: dict, metadata: dict
) -> dict:
    root.mkdir(parents=True, exist_ok=True)
    geometry = {}
    files = {}
    for component in components:
        if component.file in geometry:
            continue
        path = owned_path(root, component.file)
        if path.exists():
            raise ValueError(f"Refusing to overwrite unowned rack geometry: {path}")
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.suffix == ".step":
            if not export_step(cad_shapes[component.file], path, timestamp=STEP_TIMESTAMP):
                raise ValueError(f"STEP export failed: {path}")
        else:
            component.mesh.export(path)
        geometry[component.file] = {
            "bounds_mm": component.mesh.bounds.tolist(),
            "volume_mm3": float(component.mesh.volume),
        }
        files[component.file] = hashlib.sha256(path.read_bytes()).hexdigest()
        if component.role == "candidate":
            stl = path.with_suffix(".stl")
            if stl.exists():
                raise ValueError(f"Refusing to overwrite unowned carrier STL: {stl}")
            component.mesh.export(stl)
            reimported = trimesh.load_mesh(stl)
            if not reimported.is_volume or not np.allclose(
                reimported.bounds, component.mesh.bounds, atol=0.0001, rtol=0
            ):
                raise ValueError(f"Candidate STL failed round-trip checks: {stl}")
            files[str(stl.relative_to(root))] = hashlib.sha256(stl.read_bytes()).hexdigest()
    manifest = {
        "schema": "macrack.rack/1",
        "metadata": metadata,
        "validation": report,
        "geometry": geometry,
        "files": files,
        "cutaway_hide": metadata["cutaway_hide"],
    }
    (root / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest
