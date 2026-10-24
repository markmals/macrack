import hashlib
import json

import pytest

from macrack.rack_output import invalidate_rack, owned_path


def test_modified_rack_geometry_and_unrelated_files_are_preserved(tmp_path):
    directory = tmp_path / "candidates"
    directory.mkdir()
    step = directory / "hdd.step"
    original = b"generated STEP artifact"
    step.write_bytes(original)
    unrelated = tmp_path / "notes.txt"
    unrelated.write_text("owner notes")
    manifest = tmp_path / "rack.json"
    manifest.write_text(
        json.dumps(
            {
                "schema": "macrack.rack/1",
                "files": {"candidates/hdd.step": hashlib.sha256(original).hexdigest()},
            }
        )
    )
    step.write_bytes(b"owner-edited geometry")
    with pytest.raises(ValueError, match="modified"):
        invalidate_rack(tmp_path)
    assert step.read_bytes() == b"owner-edited geometry"
    assert manifest.exists()

    step.write_bytes(original)
    invalidate_rack(tmp_path)
    assert not step.exists()
    assert not manifest.exists()
    assert unrelated.read_text() == "owner notes"


def test_rack_manifest_cannot_claim_files_through_symlink(tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    root = tmp_path / "output"
    root.mkdir()
    (root / "source").symlink_to(outside, target_is_directory=True)
    with pytest.raises(ValueError, match="escapes"):
        owned_path(root, "source/rail.step")


def test_recorded_symlink_cannot_delete_an_unowned_saved_copy(tmp_path):
    directory = tmp_path / "candidates"
    directory.mkdir()
    saved = tmp_path / "saved.step"
    saved.write_bytes(b"original geometry")
    generated = directory / "hdd.step"
    generated.symlink_to(saved)
    manifest = tmp_path / "rack.json"
    manifest.write_text(
        json.dumps(
            {
                "schema": "macrack.rack/1",
                "files": {"candidates/hdd.step": hashlib.sha256(saved.read_bytes()).hexdigest()},
            }
        )
    )
    with pytest.raises(ValueError):
        invalidate_rack(tmp_path)
    assert generated.is_symlink()
    assert saved.read_bytes() == b"original geometry"
    assert manifest.exists()
