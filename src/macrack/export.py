"""Export artifacts to STEP/STL plus a measured manifest.

Every exported file is re-read and measured against its CAD source before the run is
reported as ok. Any failed measurement raises ExportError after the manifest is written;
nothing here falls back to a partial or unchecked result.
"""

from __future__ import annotations

import hashlib
import json
import platform
import re
from datetime import datetime
from importlib.metadata import version
from pathlib import Path
from tempfile import TemporaryDirectory

import trimesh
from build123d import Color, Compound, Shape, export_step, export_stl, import_step

from macrack.model import Artifact
from macrack.output_state import invalidate_output
from macrack.validation import inspect_shape, validate_artifacts

# A fixed STEP header timestamp keeps wall-clock metadata out of generated geometry.
STEP_TIMESTAMP = datetime(1980, 1, 1)

# OCC meshes with a *relative* linear deflection, so a small curved feature is tessellated
# finer than a large one. 0.002 of edge size is ~0.008 mm chord error on a 3.8 mm pocket and
# the 0.1 rad angular limit dominates on larger radii: both are far below FDM resolution.
STL_LINEAR_DEFLECTION = 0.002
STL_ANGULAR_DEFLECTION_RAD = 0.1

# Allow tessellation error while rejecting unit mismatches and material volume loss.
MESH_VOLUME_REL_TOL = 1e-3
MESH_BBOX_TOL_MM = 0.05

# STEP is an exact BRep round trip; measured deviation is at float noise (1e-15). The
# dimension floor is 1e-5 mm because the compared values are reported rounded to 1e-6 mm.
STEP_VOLUME_REL_TOL = 1e-9
STEP_DIM_TOL_MM = 1e-5

SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")

KIND_COLORS = {
    "printable": Color(0.70, 0.72, 0.75, 1.0),
    "keepout": Color(0.85, 0.25, 0.20, 0.35),
    "reservation": Color(0.20, 0.55, 0.85, 0.25),
}

LIMITATIONS = (
    "Exported geometry is candidate CAD only: no physical fit, print, thermal, vibration or load test is implied.",
    "Part STEP/STL files are in local model coordinates, not bed coordinates; a carrier whose local bbox starts below z=0 (ground skids) must be dropped to the bed in the slicer before slicing.",
    "assembly.step carries placed parts, device keepouts and cooling reservations; keepouts and reservations are reference volumes and must not be printed.",
    "Mesh checks prove a watertight, correctly scaled tessellation of the CAD solid; they do not prove printability, support strategy or bed fit.",
    "Checks performed here are geometric. Rail engagement, fastener fit and device clearance against unselected hardware remain unvalidated.",
)


class ExportError(RuntimeError):
    """A requested export could not be produced, or a produced file failed its measurement."""


def _tooling() -> dict:
    return {
        "python": platform.python_version(),
        "build123d": version("build123d"),
        "trimesh": trimesh.__version__,
        "step_timestamp": STEP_TIMESTAMP.isoformat(),
    }


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _inside(root: Path, *parts: str) -> Path:
    """Resolve a path under root, refusing anything that escapes it."""
    candidate = root.joinpath(*parts)
    resolved = candidate.resolve()
    if resolved != root.resolve() and root.resolve() not in resolved.parents:
        raise ExportError(f"generated path {candidate} escapes output directory {root}")
    return resolved


def _require_safe_name(name: str) -> str:
    if not SAFE_NAME.match(name):
        raise ExportError(
            f"artifact name {name!r} is not usable as a file name; "
            "use letters, digits, dot, dash or underscore"
        )
    return name


def _rel_diff(measured: float, reference: float) -> float:
    return abs(measured - reference) / abs(reference) if reference else abs(measured)


def _export_one(shape: Shape, name: str, directory: Path, role: str, note: str) -> dict:
    """Write one STEP and one STL of a local-coordinate shape and measure both back."""
    step_path = _inside(directory, f"{name}.step")
    stl_path = _inside(directory, f"{name}.stl")
    if step_path.exists() or stl_path.exists():
        raise ExportError(f"Refusing to overwrite unowned export files for {name}")
    cad = inspect_shape(shape)
    issues: list[str] = []
    if cad["solid_count"] != 1:
        issues.append(f"expected a single solid, found {cad['solid_count']}")
    if not cad["is_valid"]:
        issues.append("shape fails OpenCascade validity check")
    if cad["volume_mm3"] <= 0:
        issues.append(f"non-positive volume {cad['volume_mm3']} mm^3")

    shape.label = name
    if shape.color is None:
        shape.color = KIND_COLORS["printable"]
    if not export_step(shape, step_path, timestamp=STEP_TIMESTAMP):
        raise ExportError(f"{name}: STEP export failed ({step_path})")
    if not export_stl(
        shape,
        stl_path,
        tolerance=STL_LINEAR_DEFLECTION,
        angular_tolerance=STL_ANGULAR_DEFLECTION_RAD,
    ):
        raise ExportError(f"{name}: STL export failed ({stl_path})")

    reimported = import_step(step_path)
    step_measured = inspect_shape(reimported)
    step_volume_diff = _rel_diff(step_measured["volume_mm3"], cad["volume_mm3"])
    step_dim_diff = max(
        abs(a - b) for a, b in zip(step_measured["bbox"]["size"], cad["bbox"]["size"])
    )
    if not step_measured["is_valid"]:
        issues.append("STEP re-import fails OpenCascade validity check")
    if step_measured["solid_count"] != cad["solid_count"]:
        issues.append(
            f"STEP re-import has {step_measured['solid_count']} solids, CAD has {cad['solid_count']}"
        )
    if step_volume_diff > STEP_VOLUME_REL_TOL:
        issues.append(f"STEP re-import volume differs by {step_volume_diff:.3e} (relative)")
    if step_dim_diff > STEP_DIM_TOL_MM:
        issues.append(f"STEP re-import dimensions differ by {step_dim_diff:.3e} mm")

    mesh = trimesh.load_mesh(stl_path)
    if not isinstance(mesh, trimesh.Trimesh):
        raise ExportError(f"{name}: {stl_path.name} did not load as a single mesh")
    mesh_volume_diff = _rel_diff(float(mesh.volume), cad["volume_mm3"])
    cad_size = cad["bbox"]["size"]
    cad_min = cad["bbox"]["min"]
    mesh_extent_diff = max(abs(float(e) - s) for e, s in zip(mesh.extents, cad_size))
    mesh_corner_diff = max(abs(float(c) - m) for c, m in zip(mesh.bounds[0], cad_min))
    if not bool(mesh.is_watertight):
        issues.append("STL mesh is not watertight")
    if not bool(mesh.is_winding_consistent):
        issues.append("STL mesh winding is inconsistent")
    if float(mesh.volume) <= 0:
        issues.append(f"STL mesh volume is {float(mesh.volume):.6g} mm^3")
    if mesh_volume_diff > MESH_VOLUME_REL_TOL:
        issues.append(f"STL volume differs from CAD by {mesh_volume_diff:.3e} (relative)")
    if max(mesh_extent_diff, mesh_corner_diff) > MESH_BBOX_TOL_MM:
        issues.append(
            f"STL bounds differ from CAD by {max(mesh_extent_diff, mesh_corner_diff):.4f} mm"
        )

    notes = [note] if note else []
    if cad_min[2] < 0:
        notes.append(
            f"local geometry reaches {cad_min[2]:.3f} mm below z=0; drop to bed in the slicer."
        )

    return {
        "name": name,
        "role": role,
        "kind": "printable",
        "notes": notes,
        "files": {
            "step": f"{directory.name}/{step_path.name}",
            "stl": f"{directory.name}/{stl_path.name}",
        },
        "sha256": {"step": _sha256(step_path), "stl": _sha256(stl_path)},
        "bytes": {"step": step_path.stat().st_size, "stl": stl_path.stat().st_size},
        "cad": cad,
        "step_reimport": {
            "is_valid": step_measured["is_valid"],
            "solid_count": step_measured["solid_count"],
            "volume_mm3": step_measured["volume_mm3"],
            "volume_rel_diff": step_volume_diff,
            "max_dimension_diff_mm": step_dim_diff,
            "bbox": step_measured["bbox"],
        },
        "mesh": {
            "facets": int(len(mesh.faces)),
            "watertight": bool(mesh.is_watertight),
            "winding_consistent": bool(mesh.is_winding_consistent),
            "volume_mm3": round(float(mesh.volume), 6),
            "volume_rel_diff": mesh_volume_diff,
            "max_extent_diff_mm": mesh_extent_diff,
            "max_corner_diff_mm": mesh_corner_diff,
        },
        "status": "failed" if issues else "ok",
        "issues": issues,
    }


def _assembly_compound(artifacts: list[Artifact]) -> Compound:
    groups = []
    for kind, color in KIND_COLORS.items():
        members = []
        for artifact in artifacts:
            if artifact.kind != kind:
                continue
            placed = artifact.placed()
            placed.label = artifact.name
            placed.color = artifact.shape.color or color
            members.append(placed)
        if not members:
            continue
        group = Compound(children=members)
        group.label = kind
        groups.append(group)
    assembly = Compound(children=groups)
    assembly.label = "macrack_assembly"
    return assembly


def _export_assembly(artifacts: list[Artifact], root: Path, validation: dict) -> dict:
    path = _inside(root, "assembly.step")
    if path.exists():
        raise ExportError(f"Refusing to overwrite unowned assembly: {path}")
    assembly = _assembly_compound(artifacts)
    if not export_step(assembly, path, timestamp=STEP_TIMESTAMP):
        raise ExportError(f"assembly STEP export failed ({path})")

    reimported = import_step(path)
    measured = inspect_shape(reimported)
    labels = {
        group.label: sorted(child.label for child in group.children)
        for group in reimported.children
    }
    expected = {
        kind: sorted(a.name for a in artifacts if a.kind == kind)
        for kind in KIND_COLORS
        if any(a.kind == kind for a in artifacts)
    }
    expected_solids = sum(entry["solid_count"] for entry in validation["artifacts"])
    expected_volume = sum(entry["volume_mm3"] for entry in validation["artifacts"])
    envelope = validation["envelope"]["all"]
    dim_diff = max(abs(a - b) for a, b in zip(measured["bbox"]["size"], envelope["size"]))
    volume_diff = _rel_diff(measured["volume_mm3"], expected_volume)

    issues: list[str] = []
    if not measured["is_valid"]:
        issues.append("assembly re-import fails OpenCascade validity check")
    if labels != expected:
        issues.append(f"assembly labels {labels} do not match artifacts {expected}")
    if measured["solid_count"] != expected_solids:
        issues.append(
            f"assembly re-import has {measured['solid_count']} solids, expected {expected_solids}"
        )
    if volume_diff > STEP_VOLUME_REL_TOL:
        issues.append(f"assembly volume differs by {volume_diff:.3e} (relative)")
    if dim_diff > STEP_DIM_TOL_MM:
        issues.append(f"assembly envelope differs by {dim_diff:.3e} mm")

    return {
        "file": "assembly.step",
        "sha256": _sha256(path),
        "bytes": path.stat().st_size,
        "labels": labels,
        "is_valid": measured["is_valid"],
        "solid_count": measured["solid_count"],
        "volume_mm3": measured["volume_mm3"],
        "bbox": measured["bbox"],
        "expected_envelope": envelope,
        "max_dimension_diff_mm": dim_diff,
        "volume_rel_diff": volume_diff,
        "status": "failed" if issues else "ok",
        "issues": issues,
    }


def _write_manifest(root: Path, manifest: dict) -> Path:
    path = _inside(root, "manifest.json")
    path.write_text(json.dumps(manifest, indent=2, sort_keys=False) + "\n")
    return path


def _export_staged(
    artifacts: list[Artifact], coupons: list[Artifact], root: Path, metadata: dict
) -> dict:
    parts_dir = _inside(root, "parts")
    coupons_dir = _inside(root, "coupons")

    validation = validate_artifacts(artifacts)
    manifest: dict = {
        "schema": "macrack.export/1",
        "ok": False,
        "output_dir": str(root),
        "generated_by": _tooling(),
        "tolerances": {
            "stl_linear_deflection_relative": STL_LINEAR_DEFLECTION,
            "stl_angular_deflection_rad": STL_ANGULAR_DEFLECTION_RAD,
            "mesh_volume_rel_tol": MESH_VOLUME_REL_TOL,
            "mesh_bbox_tol_mm": MESH_BBOX_TOL_MM,
            "step_volume_rel_tol": STEP_VOLUME_REL_TOL,
            "step_dimension_tol_mm": STEP_DIM_TOL_MM,
            "collision_volume_tol_mm3": validation["tolerances"]["collision_volume_mm3"],
        },
        "metadata": metadata,
        "validation": validation,
        "parts": [],
        "assembly": None,
        "limitations": list(LIMITATIONS),
        "failures": [],
    }

    if not validation["ok"]:
        manifest["failures"] = [f"validation: {issue}" for issue in validation["issues"]]
        _write_manifest(root, manifest)
        raise ExportError(
            "artifact validation failed, nothing exported: " + "; ".join(validation["issues"])
        )

    parts_dir.mkdir(parents=True, exist_ok=True)
    coupons_dir.mkdir(parents=True, exist_ok=True)

    records = []
    for artifact in artifacts:
        if artifact.kind != "printable":
            continue
        name = _require_safe_name(artifact.name)
        records.append(_export_one(artifact.shape, name, parts_dir, "part", artifact.note))
    for coupon in coupons:
        name = _require_safe_name(coupon.name)
        if coupon.kind != "printable":
            raise ExportError(f"coupon {name!r} has kind {coupon.kind!r}, expected printable")
        records.append(_export_one(coupon.shape, name, coupons_dir, "coupon", coupon.note))
    manifest["parts"] = records

    manifest["assembly"] = _export_assembly(artifacts, root, validation)

    failures = [f"{r['name']}: {issue}" for r in records for issue in r["issues"]]
    failures += [f"assembly: {issue}" for issue in manifest["assembly"]["issues"]]
    manifest["failures"] = failures
    manifest["ok"] = not failures
    _write_manifest(root, manifest)
    if failures:
        raise ExportError("exported files failed measurement: " + "; ".join(failures))
    return manifest


def _planned_files(artifacts: list[Artifact], coupons: list[Artifact]) -> list[str]:
    coupon_names = [coupon.name for coupon in coupons]
    if len(set(coupon_names)) != len(coupon_names):
        raise ExportError("duplicate coupon names would overwrite output files")
    paths = ["assembly.step"]
    for directory, members in (("parts", artifacts), ("coupons", coupons)):
        for artifact in members:
            if artifact.kind != "printable":
                if directory == "coupons":
                    raise ExportError(f"coupon {artifact.name!r} must be printable")
                continue
            name = _require_safe_name(artifact.name)
            paths.extend(f"{directory}/{name}.{suffix}" for suffix in ("step", "stl"))
    return paths


def _check_targets(root: Path, paths: list[str]) -> None:
    for relative in paths:
        target = _inside(root, relative)
        if target.parent.exists() and not target.parent.is_dir():
            raise ExportError(f"Output directory is occupied by a file: {target.parent}")
        if target.exists():
            raise ExportError(f"Refusing to overwrite unowned export: {target}")


def export_project(
    artifacts: list[Artifact], coupons: list[Artifact], output: Path, metadata: dict
) -> dict:
    """Publish local part STEP/STLs and a placed assembly only after all checks pass."""
    root = Path(output)
    root.mkdir(parents=True, exist_ok=True)
    invalidate_output(root)
    paths = _planned_files(artifacts, coupons)
    _check_targets(root, paths)
    for relative in paths:
        _inside(root, relative).parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".macrack-", dir=root) as temporary:
        staging = Path(temporary)
        try:
            manifest = _export_staged(artifacts, coupons, staging, metadata)
        except ExportError:
            report = staging / "manifest.json"
            if report.exists():
                failed = json.loads(report.read_text())
                failed.update(output_dir=str(root), parts=[], assembly=None)
                _write_manifest(root, failed)
            raise
        _check_targets(root, paths)
        for relative in paths:
            target = _inside(root, relative)
            (staging / relative).replace(target)
        manifest["output_dir"] = str(root)
        _write_manifest(root, manifest)
    return manifest
