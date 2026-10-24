import hashlib
import importlib.util
import json
from pathlib import Path

import pytest


def test_failed_renderer_preserves_completed_artifacts_and_manifest(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("freecad_rack", Path("scripts/freecad_rack.py"))
    renderer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(renderer)
    previous = tmp_path / "rack.step"
    previous.write_bytes(b"previous completed export")
    manifest = tmp_path / "rack.json"
    manifest.write_text(
        json.dumps(
            {
                "schema": "macrack.rack/1",
                "validation": {"physical_geometry_ok": True},
                "geometry": {},
                "files": {"rack.step": hashlib.sha256(previous.read_bytes()).hexdigest()},
            }
        )
    )
    original_manifest = manifest.read_bytes()

    def fail_after_partial_export(root, staging, metadata):
        (staging / "rack.step").write_bytes(b"partial export")
        raise RuntimeError("CAD export failed")

    monkeypatch.setattr(renderer, "render_outputs", fail_after_partial_export)
    with pytest.raises(RuntimeError):
        renderer.export_rack(manifest)
    assert previous.read_bytes() == b"previous completed export"
    assert manifest.read_bytes() == original_manifest
