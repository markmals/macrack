import numpy as np
import pytest
import trimesh

from macrack.rack_scene import SceneComponent, inspect_scene, translation


def component(name, role, x):
    return SceneComponent(
        name, role, trimesh.creation.box((10, 10, 10)), translation(x=x), f"source/{name}.stl"
    )


def test_physical_overlap_fails_but_reference_overlap_remains_visible():
    rail = component("rail", "source_frame", 0)
    tray = component("tray", "candidate", 9)
    report = inspect_scene([rail, tray])
    assert not report["physical_geometry_ok"]
    assert report["physical_interferences"][0]["common_volume_mm3"] == pytest.approx(100)

    envelope = component("device_envelope", "reference", 9)
    report = inspect_scene([rail, envelope])
    assert report["physical_geometry_ok"]
    assert report["reference_envelope_interferences"][0]["common_volume_mm3"] == pytest.approx(100)


def test_airflow_reservation_excludes_physical_parts_but_allows_face_contact():
    tray = component("tray", "candidate", 0)
    air = component("air", "reservation", 10)
    assert inspect_scene([tray, air])["physical_geometry_ok"]
    overlapping_air = component("blocked_air", "reservation", 9)
    assert not inspect_scene([tray, overlapping_air])["physical_geometry_ok"]


def test_scene_dimensions_use_transformed_geometry():
    matrix = np.array([[0, -1, 0, 20], [1, 0, 0, -30], [0, 0, 1, 40], [0, 0, 0, 1]])
    part = SceneComponent(
        "rotated", "source_frame", trimesh.creation.box((10, 20, 30)), matrix, "source/rail.stl"
    )
    report = inspect_scene([part])
    assert np.allclose(report["bounds_mm"], [[10, -35, 25], [30, -25, 55]])
    assert report["components"][0]["volume_mm3"] == pytest.approx(6000)


@pytest.mark.parametrize("matrix", [np.diag([-1, 1, 1, 1]), np.diag([2, 1, 1, 1])])
def test_scene_rejects_transforms_freecad_placement_cannot_preserve(matrix):
    part = SceneComponent(
        "unsupported_transform",
        "source_frame",
        trimesh.creation.box((10, 10, 10)),
        matrix,
        "source/rail.stl",
    )
    with pytest.raises(ValueError, match="proper rigid transform"):
        inspect_scene([part])


def test_reference_overlap_with_airflow_is_reported():
    device = component("device", "reference", 0)
    neighbor = component("air", "reservation", 9)
    report = inspect_scene([device, neighbor])
    assert not report["reference_envelopes_clear"]
    assert report["reference_envelope_interferences"][0]["common_volume_mm3"] == pytest.approx(100)
