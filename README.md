# Frankenmac Rack

Parametric, private-use storage carriers derived from Jerrod H's [Mac mini Rack Pro](https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons#profileId-1040265). build123d is the source of truth. The supplied 1U/2U/3U STEP solids retain their original side/slide geometry; the central material is replaced with ventilated carrier floors.

## Build and inspect

Run from the repository root with Python 3.13 or newer and `uv`:

```sh
uv sync --locked
uv run macrack inspect
uv run macrack build --config config/reference.toml
uv run pytest
uv run ruff check .
```

`inspect` reports normalized dimensions, source hashes and lateral pocket geometry. `build` generates and checks the real solids before exporting. The default output directory is `exports/`; use `--output PATH` to keep separate configurations. The CLI accepts `--sources PATH` for another authorized copy of the templates.

Use an output directory dedicated to this project. A new build removes unchanged STEP/STL files owned by the previous manifest and invalidates the default FreeCAD report, even if the new configuration subsequently fails. Unrelated CAD files are preserved. Modified generated files cause a refusal that retains their manifest; unowned target files and unusable destination directories are rejected before export. Geometry is checked in a temporary directory before publication. Keep separate configurations in separate output directories, and do not run concurrent builds into one directory. Only consume files whose hashes match a successful current manifest; absent or failed manifests do not authorize printing.

Outputs:

| File | Purpose |
| --- | --- |
| `parts/hdd_carrier.step`, `.stl` | Provisional 2U HDD carrier with rear extension and integral ground skids |
| `parts/sata_ssd_carrier.step`, `.stl` | 1U Samsung-reference carrier with ventilation, support pads and strap slots |
| `parts/dual_nvme_carrier.step`, `.stl` | Empty 1U dual carrier until two specific enclosures are configured |
| `coupons/rail_coupon_1U.step`, `.stl` | Original right-hand slide slice without a pocket |
| `coupons/rail_coupon_2U.step`, `.stl` | Original right-hand slide slice with the lateral blind pocket |
| `assembly.step` | Positioned carriers, reference device envelopes and the reserved Mac airflow volume |
| `manifest.json` | Source provenance, parameters, placement, solid/mesh checks and limitations |

STEP/STL part files use local coordinates. Assembly placement is separate. The HDD's local underside is Z=-8 mm by default; move its lowest surface to the slicer bed. All coordinates are millimeters. STL has no unit metadata, so import it as millimeters.

Independent FreeCAD import and Bambu Studio mesh inspection:

```sh
uv run python scripts/freecad_inspect.py exports/assembly.step exports/parts/*.step exports/coupons/*.step --report exports/freecad-report.json --document exports/inspect.FCStd
/Applications/BambuStudio.app/Contents/MacOS/BambuStudio --outputdir exports --info exports/parts/*.stl exports/coupons/*.stl
```

Generate an isometric FreeCAD preview with transparent reference envelopes (red) and airflow reservation (blue):

```sh
PYTHONPATH=/Applications/FreeCAD.app/Contents/Resources/lib /Applications/FreeCAD.app/Contents/Resources/bin/python scripts/freecad_preview.py exports/assembly.step exports/assembly-preview.png --document exports/assembly-preview.FCStd
```

The preview requires a graphical macOS session. Open `exports/assembly-preview.FCStd` for interactive inspection. The STEP assembly includes non-printable references; send individual files from `parts/` or `coupons/` to the slicer, never the full assembly.

## What is implemented

The baseline allocation is HDD 2U + SATA 1U + dual NVMe 1U + empty cooling 1U + Mac bay 3U = 8U, or 200 mm of module pitch. Ground skids add 8 mm below the module stack. This is a planning allocation, not a measured complete enclosure size: the frame, Mac cradle, connectors and power hardware are missing.

The bottom HDD carrier extends behind the original 100 mm slide depth. Integral longitudinal skids carry the rear extension to a flat supporting surface rather than relying solely on an unverified printed-rail cantilever. Skid interference with the actual frame, retention, isolation and load capacity still need validation.

No unselected bridge dimensions or drive screw patterns are fabricated. SATA/HDD retention is a provisional strap arrangement; straps must avoid electronics, connectors and HDD pressure-sensitive areas. Do not install valuable hardware until retention and load tests pass. The original source contains no front mounting holes. Its 2U/3U lateral pockets are preserved unchanged; the 1U source has no such pockets.

## Change parameters

`config/reference.toml` records the baseline. Every device envelope has a `source` and a `status`: `manufacturer-confirmed`, `physical-measurement`, or `provisional`. Defaults are references, not confirmation of the owner's hardware. Design allowances are provisional millimeter values; measured source interface dimensions are deliberately not configurable because arbitrary changes would break compatibility.

Edit the copy of the TOML you intend to build. Module height must select an available 1U, 2U or 3U template. A device that exceeds the configured width or vertical allowances is rejected; changing HDD height to require 3U also moves every bay above it while keeping the 1U airflow reservation.

There is no `[nvme]` section by default. After choosing two identical enclosed USB4/Thunderbolt devices, add that table with their actual `width`, `depth`, `height`, `source`, and `status`. These are whole-enclosure dimensions, including heatsinks, not bare M.2 board dimensions. The model then creates two labeled keep-outs and adjusts their support pads, strap-slot positions and carrier depth. Connector/cable keep-outs still require hardware selection and further modeling. Two different enclosures require separate parameter support before use.

The OWC Express 1M2 pair should use the author's dedicated insert if chosen. Its 71.1 mm enclosure width cannot fit twice inside this custom carrier's 140 mm interior. The existing OWC insert is listed publicly but absent from the local downloads.

## Code map

- `parameters.py`: reference envelopes, configuration loading and bounds.
- `rack_interface.py`: original STEP import, coordinate transform, exact interface preservation and fit coupons.
- `carriers.py`, `*_insert.py`: ventilated floors, device support, retention slots and HDD skids.
- `device_envelopes.py`, `assembly.py`: non-printable reference envelopes, bay placement and airflow reservation.
- `validation.py`, `export.py`: solid intersections, mesh checks, STEP round trips and manifest output.
- `scripts/freecad_inspect.py`: independent STEP import and checks in the installed FreeCAD runtime.

The optional VS Code viewer is available through `uv sync --locked --extra viewer`. It is not required for generation or validation.

## Remaining validation

See [dimensions](docs/dimensions.md), [hardware requirements](docs/hardware-bom.md), [fit checks](docs/fit-check.md), and [print notes](docs/print-notes.md). CAD checks cannot establish real rail fit, fastener pull-out strength, safe temperatures, HDD vibration behavior or tipping stability.

Keep `assets/` and `exports/` private. The original STEP files were already tracked in the initial repository; adding ignore rules does not remove them from Git history. Do not publish this repository or original/derived geometry without the author's permission. No source files are removed by this project.

This project never accesses storage devices. The existing non-redundant `biggie` pool must remain untouched; migration and verified external backup are separate prerequisites to disassembly.
