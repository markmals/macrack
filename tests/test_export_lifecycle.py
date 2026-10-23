import json
from dataclasses import replace

import pytest

from macrack.cli import main
from macrack.export import ExportError, export_project
from macrack.model import Artifact
from macrack.rack_interface import block


def small_part():
    return Artifact("fixture", block(10, 12, 3))


def test_rebuild_preserves_foreign_cad_files(tmp_path):
    part = small_part()
    export_project([part], [], tmp_path, {})
    foreign = tmp_path / "parts" / "unrelated.step"
    foreign.write_bytes(b"user-owned geometry")
    export_project([part], [], tmp_path, {})
    assert foreign.read_bytes() == b"user-owned geometry"


def test_duplicate_coupon_names_cannot_overwrite_manifest_records(tmp_path):
    coupon = Artifact("coupon", block(3, 4, 5))
    other = replace(coupon, shape=block(6, 4, 5))
    with pytest.raises(ExportError, match="duplicate coupon"):
        export_project([small_part()], [coupon, other], tmp_path, {})
    assert not (tmp_path / "coupons" / "coupon.step").exists()


def test_rebuild_invalidates_old_independent_inspection(tmp_path):
    export_project([small_part()], [], tmp_path, {})
    report = tmp_path / "freecad-report.json"
    report.write_text(json.dumps({"schema": "macrack.freecad-inspect/1", "ok": True}))
    export_project([replace(small_part(), shape=block(10, 12, 6))], [], tmp_path, {})
    assert not report.exists()


def test_failed_configuration_does_not_leave_previous_print_files(tmp_path, monkeypatch):
    export_project([small_part()], [], tmp_path, {})
    config = tmp_path / "invalid.toml"
    config.write_text("[design]\nhdd_units = 4\n")
    monkeypatch.setattr(
        "sys.argv", ["macrack", "build", "--config", str(config), "--output", str(tmp_path)]
    )
    with pytest.raises(SystemExit) as exit_status:
        main()
    assert exit_status.value.code == 2
    assert not (tmp_path / "manifest.json").exists()
    assert not (tmp_path / "assembly.step").exists()
    assert not (tmp_path / "parts" / "fixture.stl").exists()


def test_modified_generated_geometry_is_preserved(tmp_path):
    export_project([small_part()], [], tmp_path, {})
    modified = tmp_path / "parts" / "fixture.step"
    modified.write_bytes(b"user-modified geometry")
    with pytest.raises(ValueError, match="modified"):
        export_project([small_part()], [], tmp_path, {})
    assert modified.read_bytes() == b"user-modified geometry"
    assert (tmp_path / "manifest.json").exists()


def test_unowned_target_cannot_be_overwritten(tmp_path):
    directory = tmp_path / "parts"
    directory.mkdir()
    foreign = directory / "fixture.step"
    foreign.write_bytes(b"user-owned geometry")
    with pytest.raises(ExportError, match="unowned"):
        export_project([small_part()], [], tmp_path, {})
    assert foreign.read_bytes() == b"user-owned geometry"


def test_assembly_collision_leaves_no_partial_parts(tmp_path):
    foreign = tmp_path / "assembly.step"
    foreign.write_bytes(b"user-owned assembly")
    with pytest.raises(ExportError, match="unowned"):
        export_project([small_part()], [], tmp_path, {})
    assert foreign.read_bytes() == b"user-owned assembly"
    assert not (tmp_path / "parts" / "fixture.step").exists()


def test_invalid_coupon_does_not_publish_partial_exports(tmp_path):
    from build123d import Compound

    coupon = Artifact("disconnected", Compound(children=[block(2, 2, 2), block(2, 2, 2, x=10)]))
    with pytest.raises(ExportError, match="single solid"):
        export_project([small_part()], [coupon], tmp_path, {})
    assert not (tmp_path / "parts" / "fixture.step").exists()
    assert not (tmp_path / "coupons" / "disconnected.stl").exists()


def test_directory_collision_is_rejected_before_any_publication(tmp_path):
    foreign = tmp_path / "coupons"
    foreign.write_bytes(b"user-owned file")
    coupon = Artifact("coupon", block(3, 4, 5))
    with pytest.raises(ExportError, match="directory"):
        export_project([small_part()], [coupon], tmp_path, {})
    assert foreign.read_bytes() == b"user-owned file"
    assert not (tmp_path / "assembly.step").exists()
    assert not (tmp_path / "parts" / "fixture.step").exists()
