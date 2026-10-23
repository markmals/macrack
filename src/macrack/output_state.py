import hashlib
import json
from pathlib import Path


def _owned_path(root: Path, relative: str) -> Path:
    path = Path(relative)
    valid_part = (
        len(path.parts) == 2
        and path.parts[0] in {"parts", "coupons"}
        and path.suffix in {".step", ".stl"}
    )
    if path.is_absolute() or not (relative == "assembly.step" or valid_part):
        raise ValueError(f"Invalid owned export path: {relative}")
    resolved = (root / path).resolve()
    if root.resolve() not in resolved.parents:
        raise ValueError(f"Owned export escapes output directory: {relative}")
    return resolved


def invalidate_output(output: Path) -> None:
    """Remove only unchanged files recorded by the previous export, before a new build."""
    manifest_path = output / "manifest.json"
    inspection = output / "freecad-report.json"
    if inspection.exists():
        report = json.loads(inspection.read_text())
        if report.get("schema") == "macrack.freecad-inspect/1":
            inspection.unlink()
    if not manifest_path.exists():
        return
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("schema") != "macrack.export/1":
        raise ValueError(f"Refusing to replace an unrecognized manifest: {manifest_path}")
    owned = []
    for part in manifest["parts"]:
        for kind in ("step", "stl"):
            owned.append((_owned_path(output, part["files"][kind]), part["sha256"][kind]))
    if manifest.get("assembly"):
        assembly = manifest["assembly"]
        owned.append((_owned_path(output, assembly["file"]), assembly["sha256"]))
    for path, expected_hash in owned:
        if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() != expected_hash:
            raise ValueError(
                f"Previous export was modified; preserve or move it before rebuilding: {path}"
            )
    manifest_path.unlink()
    for path, _ in owned:
        path.unlink(missing_ok=True)
