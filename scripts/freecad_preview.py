import argparse
from pathlib import Path


def render_preview(step: Path, image: Path, document: Path | None) -> None:
    import FreeCAD as App
    import FreeCADGui as Gui
    from PySide6 import QtWidgets

    application = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
    Gui.showMainWindow()
    import ImportGui

    cad_document = App.newDocument("RackCandidate")
    ImportGui.insert(str(step.resolve()), cad_document.Name)
    for obj in cad_document.Objects:
        if not hasattr(obj.ViewObject, "ShapeColor"):
            continue
        if "reference_" in obj.Label or "nvme_enclosure_" in obj.Label:
            obj.ViewObject.ShapeColor = (0.75, 0.3, 0.2)
            obj.ViewObject.Transparency = 65
        elif "reservation" in obj.Label:
            obj.ViewObject.ShapeColor = (0.2, 0.5, 0.85)
            obj.ViewObject.Transparency = 85
        else:
            obj.ViewObject.ShapeColor = (0.7, 0.73, 0.77)
    cad_document.recompute()
    application.processEvents()
    view = Gui.activeDocument().activeView()
    orientation = (0.4247082, 0.1759199, 0.3398511, 0.8204732)
    view.setCameraOrientation(orientation)
    view.fitAll()
    application.processEvents()
    # Window activation can reset the camera after the first event delivery.
    view.setCameraOrientation(orientation)
    view.redraw()
    image.parent.mkdir(parents=True, exist_ok=True)
    view.saveImage(str(image.resolve()), 1200, 1000, "Current")
    if document is not None:
        document.parent.mkdir(parents=True, exist_ok=True)
        cad_document.saveAs(str(document.resolve()))
    App.closeDocument(cad_document.Name)
    application.quit()
    print(f"FreeCAD preview: {image}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render STEP with FreeCAD's bundled Python and GUI"
    )
    parser.add_argument("step", type=Path)
    parser.add_argument("image", type=Path)
    parser.add_argument("--document", type=Path)
    options = parser.parse_args()
    render_preview(options.step, options.image, options.document)


if __name__ == "__main__":
    main()
