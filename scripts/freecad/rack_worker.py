"""Full-rack FreeCAD adapter: runs the job it is given and reports what FreeCAD measured.

FreeCAD's API lives only in its bundled Python, so this file stays Python. It decides nothing:
paths, colours, camera orientations and image sizes arrive in the JSON job, and every tolerance,
comparison and report is applied by the caller on the measurements written back here.
"""

import json
import sys
from pathlib import Path


def measure(shape) -> dict:
    box = shape.BoundBox
    return {
        "valid": bool(shape.isValid()),
        "solids": len(shape.Solids),
        "volume_mm3": shape.Volume,
        "bounds_mm": [
            [box.XMin, box.YMin, box.ZMin],
            [box.XMax, box.YMax, box.ZMax],
        ],
    }


def load_shape(path: str, kind: str):
    import Mesh
    import Part

    if kind == "step":
        return Part.read(path)
    mesh = Mesh.Mesh(path)
    shell = Part.Shape()
    shell.makeShapeFromMesh(mesh.Topology, 0.00001)
    return Part.makeSolid(shell)


def load_shapes(job: dict, facts: dict) -> dict:
    shapes = {}
    for entry in job["shapes"]:
        shape = load_shape(entry["path"], entry["kind"])
        facts["shapes"][entry["key"]] = measure(shape)
        convert = entry["convert"]
        if convert is not None:
            shape.exportStep(convert["path"])
            shape = load_shape(convert["path"], "step")
            facts["shapes"][convert["key"]] = measure(shape)
        shapes[entry["key"]] = shape
    return shapes


def populate(document, job: dict, facts: dict) -> list:
    import FreeCAD as App

    shapes = load_shapes(job, facts)
    groups = {}
    objects = []
    for component in job["components"]:
        role = component["role"]
        if role not in groups:
            groups[role] = document.addObject("App::DocumentObjectGroup", role)
        obj = document.addObject("Part::Feature", component["name"])
        obj.Label = component["name"]
        obj.Shape = shapes[component["shape"]]
        matrix = App.Matrix(*[number for row in component["transform"] for number in row])
        obj.Placement = App.Placement(matrix)
        obj.addProperty("App::PropertyString", "Evidence")
        obj.Evidence = component["note"]
        obj.ViewObject.ShapeColor = tuple(component["color"])
        obj.ViewObject.DisplayMode = component["display_mode"]
        obj.ViewObject.Transparency = component["transparency"]
        groups[role].addObject(obj)
        objects.append(obj)
    document.recompute()
    return objects


def save_view(application, view, item: dict) -> list:
    application.processEvents()
    # Navigation animation otherwise captures an intermediate pose, not the requested view.
    view.setAnimationEnabled(False)
    view.setCameraType("Orthographic")
    view.setCameraOrientation(tuple(item["orientation"]))
    view.fitAll()
    view.redraw()
    view.saveImage(item["path"], item["width"], item["height"], "Current")
    return list(view.getCameraOrientation().Q)


def render(document, job: dict, facts: dict, application) -> None:
    import FreeCADGui as Gui
    import ImportGui
    import Part

    objects = populate(document, job, facts)
    facts["components"] = len(objects)
    ImportGui.export(objects, job["assembly"])
    facts["assembly"] = measure(Part.read(job["assembly"]))
    view = Gui.activeDocument().activeView()
    for item in job["views"]:
        hidden = [objects[index] for index in item["hide"]]
        for obj in hidden:
            obj.Visibility = False
        facts["views"][item["name"]] = save_view(application, view, item)
        for obj in hidden:
            obj.Visibility = True
    view.setCameraOrientation(tuple(job["final_orientation"]))
    view.fitAll()
    document.saveAs(job["document"])


def main(job_path: str) -> None:
    import FreeCAD as App
    import FreeCADGui as Gui
    from PySide6 import QtWidgets

    job = json.loads(Path(job_path).read_text())
    facts = {"shapes": {}, "views": {}}
    application = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
    Gui.showMainWindow()
    document = App.newDocument("FullRackCandidate")
    try:
        render(document, job, facts, application)
    finally:
        App.closeDocument(document.Name)
        application.quit()
    Path(job["facts"]).write_text(json.dumps(facts, indent=2) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
