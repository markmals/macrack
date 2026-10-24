from dataclasses import replace
from pathlib import Path

import pytest

from macrack.full_assembly import assemble_rack, export_rack
from macrack.parameters import load_parameters
from macrack.rack_scene import inspect_scene
from macrack.source_profile import SourceProfile

SOURCE = Path("assets/rack-pro")
PROFILE = SOURCE / "rack-pro.3mf"


@pytest.fixture(scope="module")
def profile():
    if not PROFILE.exists():
        pytest.skip("Private Rack Pro 3MF is required")
    return SourceProfile(PROFILE)


@pytest.fixture(scope="module")
def rack(profile):
    return assemble_rack(SOURCE, profile, load_parameters(None), "full", "generic")


def test_full_rack_preserves_clearance_and_reports_conservative_mac_overlap(rack):
    components, _, metadata = rack
    report = inspect_scene(components)
    assert report["physical_geometry_ok"]
    assert any(
        pair["a"] == "mac_cradle" and pair["b"] == "reference_Mac_NOT_SELECTED"
        for pair in report["reference_envelope_interferences"]
    )
    floors = metadata["allocation"]["bay_floor_z_mm"]
    assert floors["mac"] - floors["air"] >= 25
    assert floors["sata"] - floors["hdd"] == pytest.approx(50.8)


def test_hdd_can_begin_front_withdrawal_without_catching_base_ribs(rack):
    components, _, _ = rack
    hdd = next(part for part in components if part.name == "hdd_carrier")
    frame = [part for part in components if part.role == "source_frame"]
    transform = hdd.transform.copy()
    transform[1, 3] -= 2
    moving_hdd = replace(hdd, transform=transform)
    assert inspect_scene([*frame, moving_hdd])["physical_geometry_ok"]


def test_short_frame_rejects_storage_mac_and_cooling_stack(profile):
    with pytest.raises(ValueError):
        assemble_rack(SOURCE, profile, load_parameters(None), "short", "generic")


def test_occupied_output_directory_does_not_publish_partial_rack(profile, tmp_path):
    output = tmp_path / "rack"
    output.mkdir()
    obstruction = output / "references"
    obstruction.write_text("owner file")
    with pytest.raises(ValueError):
        export_rack(SOURCE, PROFILE, load_parameters(None), output)
    assert obstruction.read_text() == "owner file"
    assert not (output / "source").exists()
    assert not (output / "candidates").exists()
    assert not (output / "rack.json").exists()
