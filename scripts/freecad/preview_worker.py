"""Single-STEP preview adapter for FreeCAD's GUI.

FreeCAD's API lives only in its bundled Python, so this file stays Python. Colours, camera
orientation, image size and output paths arrive in the JSON job.
"""

import json
import sys
from pathlib import Path


def style_for(job: dict, label: str) -> dict:
    for style in job["styles"]:
        if any(text in label for text in style["match"]):
            return style
    return job["default_style"]


def dress(document, job: dict) -> None:
    for obj in document.Objects:
        if not hasattr(obj.ViewObject, "ShapeColor"):
            continue
        style = style_for(job, obj.Label)
        obj.ViewObject.ShapeColor = tuple(style["color"])
        if "transparency" in style:
            obj.ViewObject.Transparency = style["transparency"]
    document.recompute()


def main(job_path: str) -> None:
    import FreeCAD as App
    import FreeCADGui as Gui
    from PySide6 import QtWidgets

    job = json.loads(Path(job_path).read_text())
    application = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
    Gui.showMainWindow()
    import ImportGui

    document = App.newDocument("RackCandidate")
    try:
        ImportGui.insert(job["step"], document.Name)
        dress(document, job)
        application.processEvents()
        view = Gui.activeDocument().activeView()
        # Navigation animation otherwise captures an intermediate pose, not the requested view.
        view.setAnimationEnabled(False)
        view.setCameraType("Orthographic")
        view.setCameraOrientation(tuple(job["orientation"]))
        view.fitAll()
        view.redraw()
        view.saveImage(job["image"], job["width"], job["height"], "Current")
        facts = {"image": job["image"], "orientation": list(view.getCameraOrientation().Q)}
        if job["document"] is not None:
            document.saveAs(job["document"])
    finally:
        App.closeDocument(document.Name)
        application.quit()
    Path(job["facts"]).write_text(json.dumps(facts, indent=2) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
