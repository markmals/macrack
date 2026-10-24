import argparse
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

COLORS = {
    "source_frame": (0.16, 0.18, 0.21),
    "source_module": (0.73, 0.76, 0.79),
    "candidate": (0.18, 0.55, 0.57),
    "reference": (0.88, 0.48, 0.18),
    "reservation": (0.20, 0.50, 0.85),
}
FRONT = (0.4247082, 0.1759199, 0.3398511, 0.8204732)
BACK = (-0.1759199, 0.4247082, 0.8204732, -0.3398511)


def checked_path(root: Path, relative: str) -> Path:
    path = root / relative
    if Path(relative).is_absolute() or ".." in Path(relative).parts:
        raise ValueError(f"Invalid rack path: {relative}")
    if root.resolve() not in path.resolve().parents:
        raise ValueError(f"Rack file escapes output directory: {relative}")
    current = root
    for segment in Path(relative).parts:
        current /= segment
        if current.is_symlink():
            raise ValueError(f"Refusing symlinked rack file: {current}")
    return path


def load_manifest(path: Path) -> dict:
    manifest = json.loads(path.read_text())
    if manifest.get("schema") != "macrack.rack/1":
        raise ValueError("Expected a macrack.rack/1 manifest")
    if not manifest["validation"]["physical_geometry_ok"]:
        raise ValueError("Refusing a rack with unresolved physical-part intersections")
    for relative, expected in manifest["files"].items():
        actual = hashlib.sha256(checked_path(path.parent, relative).read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError(f"Changed rack artifact: {relative}; regenerate the rack first")
    return manifest


def load_shape(path: Path):
    import Mesh
    import Part

    if path.suffix == ".step":
        shape = Part.read(str(path))
    else:
        mesh = Mesh.Mesh(str(path))
        shell = Part.Shape()
        shell.makeShapeFromMesh(mesh.Topology, 0.00001)
        shape = Part.makeSolid(shell)
    if not shape.isValid() or len(shape.Solids) != 1 or shape.Volume <= 0:
        raise ValueError(f"{path}: conversion did not produce a valid single solid")
    return shape


def shape_bounds(shape) -> list[list[float]]:
    bounds = shape.BoundBox
    return [
        [bounds.XMin, bounds.YMin, bounds.ZMin],
        [bounds.XMax, bounds.YMax, bounds.ZMax],
    ]


def verify_shape(shape, expected: dict, name: str) -> dict:
    if not shape.isValid() or shape.Volume <= 0:
        raise ValueError(f"{name}: FreeCAD imported invalid or non-positive geometry")
    bounds = shape_bounds(shape)
    difference = max(
        abs(bounds[side][axis] - expected["bounds_mm"][side][axis])
        for side in range(2)
        for axis in range(3)
    )
    volume_difference = abs(shape.Volume / expected["volume_mm3"] - 1)
    if difference > 0.001 or volume_difference > 0.001:
        raise ValueError(f"{name}: FreeCAD geometry differs from the generated scene")
    return {
        "valid": shape.isValid(),
        "solids": len(shape.Solids),
        "volume_mm3": shape.Volume,
        "bounds_mm": bounds,
        "max_bound_difference_mm": difference,
        "relative_volume_difference": volume_difference,
    }


def populate_document(document, root: Path, staging: Path, manifest: dict):
    import FreeCAD as App

    shapes = {}
    groups = {}
    report = {}
    outputs = []
    for relative, expected in manifest["geometry"].items():
        path = checked_path(root, relative)
        shape = load_shape(path)
        report[relative] = verify_shape(shape, expected, relative)
        if path.suffix == ".stl":
            step = checked_path(staging, str(Path(relative).with_suffix(".step")))
            step.parent.mkdir(parents=True, exist_ok=True)
            shape.exportStep(str(step))
            outputs.append(step)
            shape = load_shape(step)
            report[str(step.relative_to(staging))] = verify_shape(shape, expected, str(step))
        shapes[relative] = shape
    objects = []
    for component in manifest["validation"]["components"]:
        role = component["role"]
        if role not in groups:
            groups[role] = document.addObject("App::DocumentObjectGroup", role)
        obj = document.addObject("Part::Feature", component["name"])
        obj.Label = component["name"]
        obj.Shape = shapes[component["file"]]
        matrix = App.Matrix(*[number for row in component["transform"] for number in row])
        obj.Placement = App.Placement(matrix)
        obj.addProperty("App::PropertyString", "Evidence")
        obj.Evidence = component["note"]
        obj.ViewObject.ShapeColor = COLORS[role]
        obj.ViewObject.DisplayMode = "Flat Lines" if role == "candidate" else "Shaded"
        obj.ViewObject.Transparency = 65 if role == "reference" else 0
        if role == "reservation":
            obj.ViewObject.Transparency = 90
        groups[role].addObject(obj)
        objects.append(obj)
    document.recompute()
    return objects, report, outputs


def save_view(application, view, orientation, path: Path) -> tuple:
    application.processEvents()
    # Navigation animation otherwise captures an intermediate pose, not the requested view.
    view.setAnimationEnabled(False)
    view.setCameraType("Orthographic")
    view.setCameraOrientation(orientation)
    view.fitAll()
    view.redraw()
    view.saveImage(str(path), 1400, 1200, "Current")
    actual = view.getCameraOrientation().Q
    error = min(
        sum((a - b) ** 2 for a, b in zip(actual, orientation, strict=True)),
        sum((a + b) ** 2 for a, b in zip(actual, orientation, strict=True)),
    )
    if error > 1e-10:
        raise ValueError(f"{path.name}: camera did not reach the requested orientation")
    return actual


def export_document(document, root: Path, staging: Path, manifest: dict, application) -> list[Path]:
    import FreeCADGui as Gui
    import ImportGui
    import Part

    objects, report, outputs = populate_document(document, root, staging, manifest)
    assembly_step = staging / "rack.step"
    ImportGui.export(objects, str(assembly_step))
    imported = Part.read(str(assembly_step))
    expected = {
        "bounds_mm": manifest["validation"]["bounds_mm"],
        "volume_mm3": sum(item["volume_mm3"] for item in manifest["validation"]["components"]),
    }
    report["rack.step"] = verify_shape(imported, expected, "rack.step")
    if len(imported.Solids) != len(objects):
        raise ValueError("Full-rack STEP lost or combined component solids")
    outputs.append(assembly_step)
    view = Gui.activeDocument().activeView()
    report["views"] = {}
    for name, orientation in (("rack-front.png", FRONT), ("rack-back.png", BACK)):
        image = staging / name
        report["views"][name] = save_view(application, view, orientation, image)
        outputs.append(image)
    hidden = []
    for obj, component in zip(objects, manifest["validation"]["components"], strict=True):
        if component["name"] in manifest["cutaway_hide"]:
            obj.Visibility = False
            hidden.append(obj)
    image = staging / "rack-cutaway.png"
    report["views"][image.name] = save_view(application, view, FRONT, image)
    outputs.append(image)
    for obj in hidden:
        obj.Visibility = True
    view.setCameraOrientation(FRONT)
    view.fitAll()
    document_path = staging / "rack.FCStd"
    document.saveAs(str(document_path))
    outputs.append(document_path)
    report_path = staging / "freecad-rack-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    outputs.append(report_path)
    return outputs


def render_outputs(root: Path, staging: Path, manifest: dict) -> list[Path]:
    import FreeCAD as App
    import FreeCADGui as Gui
    from PySide6 import QtWidgets

    application = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
    Gui.showMainWindow()
    document = App.newDocument("FullRackCandidate")
    try:
        return export_document(document, root, staging, manifest, application)
    finally:
        App.closeDocument(document.Name)
        application.quit()


def check_outputs(root: Path, names: list[str], manifest: dict) -> None:
    for relative in names:
        target = checked_path(root, relative)
        if target.exists() and relative not in manifest["files"]:
            raise ValueError(f"Refusing to overwrite unowned FreeCAD output: {relative}")
        if target.parent.exists() and not target.parent.is_dir():
            raise ValueError(f"Output directory is occupied by a file: {target.parent}")


def export_rack(manifest_path: Path) -> None:
    if manifest_path.is_symlink():
        raise ValueError("Refusing a symlinked rack manifest")
    manifest_path = manifest_path.resolve()
    root = manifest_path.parent
    manifest = load_manifest(manifest_path)
    generated = [
        "rack.step",
        "rack.FCStd",
        "rack-front.png",
        "rack-back.png",
        "rack-cutaway.png",
        "freecad-rack-report.json",
    ]
    generated.extend(
        str(Path(relative).with_suffix(".step"))
        for relative in manifest["geometry"]
        if relative.endswith(".stl")
    )
    check_outputs(root, generated, manifest)
    with TemporaryDirectory(prefix=".freecad-", dir=root) as temporary:
        staging = Path(temporary)
        outputs = render_outputs(root, staging, manifest)
        if load_manifest(manifest_path) != manifest:
            raise ValueError("Rack manifest changed during FreeCAD export")
        check_outputs(root, generated, manifest)
        manifest["files"].update(
            {
                str(path.relative_to(staging)): hashlib.sha256(path.read_bytes()).hexdigest()
                for path in outputs
            }
        )
        staged_manifest = staging / manifest_path.name
        staged_manifest.write_text(json.dumps(manifest, indent=2) + "\n")
        for path in outputs:
            target = checked_path(root, str(path.relative_to(staging)))
            target.parent.mkdir(parents=True, exist_ok=True)
            path.replace(target)
        staged_manifest.replace(manifest_path)
    print(f"Full rack: {root / 'rack.step'}; {root / 'rack.FCStd'}; three PNG views", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Inspect, export and render the full rack in FreeCAD"
    )
    parser.add_argument("manifest", type=Path)
    export_rack(parser.parse_args().manifest)
