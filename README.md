# Frankenmac Rack

Private-use parametric CAD derived from Jerrod H's [Mac mini Rack Pro](https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons#profileId-854246). build123d generates the custom storage carriers while retaining the original STEP-template interfaces. The supplied `assets/rack-pro/rack-pro.3mf` provides the actual frame, Mac cradle, lid, handles and optional OWC shelf.

The assembled comparison model measures approximately **172.6 × 178.8 × 262 mm**, including the Mac handles but excluding unselected bridges, cables and power supplies. It is a CAD candidate, not a validated hardware installation or print job.

## Build the full rack

Run from the repository root with Python 3.13 or newer and `uv`:

```sh
uv sync --locked
uv run macrack inspect
uv run macrack rack --config config/owc-reference.toml --nvme-mount owc-reference
PYTHONPATH=/Applications/FreeCAD.app/Contents/Resources/lib /Applications/FreeCAD.app/Contents/Resources/bin/python scripts/freecad_rack.py exports/full-rack/rack.json
open -a FreeCAD exports/full-rack/rack.FCStd
```

The OWC configuration is an explicit comparison using the manufacturer's dimensions for two original 40Gb/s Express 1M2 enclosures. It does not imply that they have been selected, purchased or confirmed compatible with the 4TB P310s. The original OWC shelf is used unchanged; those enclosures do not fit the narrower generic carrier.

For the alternative empty custom NVMe carrier, without inventing enclosure dimensions:

```sh
uv run macrack rack --output exports/generic-rack
```

Run the same FreeCAD script against that directory's `rack.json` to produce its assembly and previews. `--profile PATH` selects an authorized Bambu source project; `--sources PATH` selects the STEP-template directory. `--rail-size short` is available, but the current eight-unit stack is rejected because the supplied short frame has only six usable full units.

## View and inspect

Open `exports/full-rack/rack.FCStd` in FreeCAD. Use the navigation cube to orbit, scroll to zoom, and select a tree item then press Space to hide/show it. Press V, then F to fit the view. The groups separate original frame parts, original modules, custom candidates, reference bodies and the airflow reservation.

This is an interactive snapshot, not automatic Python hot reload. Change the TOML, rerun the rack command and FreeCAD exporter, then reopen the document. The Python source remains authoritative for custom geometry.

| Artifact under `exports/full-rack/` | Purpose |
| --- | --- |
| [`rack.FCStd`](exports/full-rack/rack.FCStd) | Interactive, grouped FreeCAD assembly with evidence notes |
| [`rack.step`](exports/full-rack/rack.step) | Full assembly, including non-printable reference volumes |
| [`rack-front.png`](exports/full-rack/rack-front.png) | Front isometric preview |
| [`rack-back.png`](exports/full-rack/rack-back.png) | Rear isometric preview |
| [`rack-cutaway.png`](exports/full-rack/rack-cutaway.png) | Top and Mac cradle hidden to expose device envelopes |
| `candidates/*.step`, `candidates/*.stl` | Native parametric SATA/HDD carriers; also NVMe in generic mode |
| `source/*.stl`, `source/*.step` | Original local-coordinate meshes and their faceted STEP conversions |
| `rack.json` | Input hashes, measured frame, parameters, transforms, intersections and output hashes |
| `freecad-rack-report.json` | Independent per-part/full-assembly import checks and camera orientations |

PNGs are 1400 × 1200. Dark parts are the original frame, light gray parts the original modules, teal parts custom candidates, amber volumes conservative device references, and blue the reserved Mac airflow space. Source STEP conversions retain the 3MF facets; they do not recover the author's analytic CAD. Custom carrier STEP files retain native CAD surfaces.

Never slice the full assembly: it contains non-printable devices and reserved air. Original source exports are not an arranged print job and do not encode quantities; use the original 3MF to inspect the author's frame orientations and six-rail layout. Select and validate your own printer/material settings before printing any part.

## Geometry and packaging

The stack is HDD 2U, SATA SSD 1U, dual NVMe 1U, empty cooling space 1U, and the original Mac module 3U. The STEP blanks are 25/50/75 mm high, but the measured rail pitch is **25.4 mm**, not 25 mm. The full frame has nine usable full units; the short frame has six. The full frame is the shortest supplied option that accommodates this provisional stack. A final minimum-height frame depends on the selected electronics and cooling requirements.

The assembled HDD sled has continuous 8.6 mm skids resting nominally on the base's ribs at Z=4 mm. This transfers load into the base rather than relying solely on the rail slides. The skids can slide over the ribs; load capacity, retention, wear, vibration and loaded withdrawal stability remain untested.

The two P310s are bare NVMe boards. Each needs a commercial USB4/Thunderbolt bridge, heatsink and protective housing. The generic empty carrier has none of those functions and must not hold bare boards. A built-in housing requires selecting and measuring the bridge/heatsink first; no PCB outline, connector location or thermal interface is invented here.

The Samsung 2.5-inch SATA SSD can retain its factory case and sit directly in a carrier with a suitable USB-to-SATA bridge and strain relief. A second external case is optional. The future 3.5-inch HDD needs a supported bridge and commercial supply providing its required 5 V and 12 V rails. Neither bridge nor supply is modeled before selection.

The modeled printed parts have no positive-volume intersections above the stated mesh tolerance. One unresolved reference intersection remains: the square Mac bounding box overlaps the rounded cradle corners. The actual Mac corner profile is not supplied, so that overlap is neither hidden nor treated as physical fit proof. See [fit checks](docs/fit-check.md) and [hardware requirements](docs/hardware-bom.md).

## Parameters and carrier-only studies

`config/reference.toml` records the generic baseline; `config/owc-reference.toml` supplies the unselected OWC comparison. Every device envelope records `source` and `status`: `manufacturer-confirmed`, `physical-measurement`, or `provisional`. Manufacturer dimensions do not establish ownership or compatibility. Design allowances remain configurable; original interface dimensions and measured frame datums are not arbitrary fit knobs.

For two identical alternative enclosures, add `[nvme]` with whole-enclosure `width`, `depth`, `height`, `source` and `status`, then use generic mode. The carrier adjusts its supports and depth and rejects insufficient width or height. Two different enclosure sizes require separate parameter support. Cable/plug geometry still needs actual product selection.

Increase a module's configured U count if required; supported heights use the original 1U/2U/3U templates. Upper modules move to the corresponding measured slots and the empty pitch beneath the Mac is retained. A stack exceeding the selected frame's capacity is rejected.

The separate carrier-only command remains useful for coupons and isolated design studies:

```sh
uv run macrack build --config config/reference.toml
uv run python scripts/freecad_inspect.py exports/assembly.step exports/parts/*.step exports/coupons/*.step --report exports/freecad-report.json --document exports/inspect.FCStd
```

That study uses nominal 25 mm module-height spacing, no original frame/cradle, and default 8 mm ground skids. It is not the assembled rack. Its output is `exports/parts/`, `exports/coupons/`, `exports/assembly.step` and `exports/manifest.json`; use the full-rack carrier files for the base-supported HDD variant. All STEP/STL part files use local millimeter coordinates. Translate their lowest surface to the slicer bed without scaling.

Individual STEP previews remain available:

```sh
PYTHONPATH=/Applications/FreeCAD.app/Contents/Resources/lib /Applications/FreeCAD.app/Contents/Resources/bin/python scripts/freecad_preview.py exports/full-rack/candidates/sata_ssd_carrier.step exports/previews/sata-ssd-carrier.png
```

## Checks and output ownership

```sh
uv run pytest
uv run ruff check .
/Applications/BambuStudio.app/Contents/MacOS/BambuStudio --outputdir exports/full-rack --info exports/full-rack/candidates/*.stl exports/full-rack/source/*.stl
```

The 3MF-dependent regressions require the private source file. CAD checks and Bambu `--info` do not establish physical fit or validate a sliced toolpath. FreeCAD rendering requires a graphical macOS session.

Use dedicated output directories and do not run concurrent builds into one directory. A new rack build invalidates its previous manifest and removes only unchanged files it owns, including derived FreeCAD outputs. Modified files, symlinks and unowned target paths are refused. Native geometry and FreeCAD outputs are staged before publication; a failed FreeCAD render preserves the previous completed outputs. Only consume files matching a successful current manifest. A valid manifest is still not permission to print without the physical and slicer gates in [print notes](docs/print-notes.md).

## Code map

- `parameters.py`, `rack_interface.py`, `*_insert.py`: configurable device/design values and exact STEP-derived carriers.
- `source_profile.py`: Bambu component-mesh import without print-bed or scattered assembly transforms.
- `rack_frame.py`, `source_modules.py`: measured original geometry and rigid assembly placements.
- `full_assembly.py`, `rack_scene.py`, `rack_output.py`: layout, conservative references, mesh intersection checks and reproducible exports.
- `assembly.py`, `validation.py`, `export.py`: isolated carrier studies and exact-solid/export checks.
- `scripts/freecad_rack.py`: full assembly conversion, independent inspection, interactive document and PNGs.

The optional VS Code viewer extra is not required. See [dimensions](docs/dimensions.md) for measured datums and [fit checks](docs/fit-check.md) for the remaining thermal, structural, service-access and stability gates.

Keep `assets/` and `exports/` private. Original STEP files were tracked in the initial repository; ignore rules do not remove them from Git history. Do not publish this repository or original/derived geometry without the author's permission. No source files are removed.

This project never accesses storage devices. The non-redundant `biggie` pool must remain untouched; migration and a verified external backup are separate prerequisites to disassembly.
