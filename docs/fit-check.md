# Fit and validation boundaries

## Compatibility evidence

Custom carriers import the original STEP solids and rotate them +90° around X. Only the central body is replaced. Protected side strips retain the slide chamfers, lateral pockets where present, and outer flange geometry. Boolean checks reject both removed interface material and added material in that region.

The original rails are now assembled from the supplied 3MF. Measured nominal allowances are 0.2 mm per side at the body and slide, and 0.2 mm vertically in the groove. This is source-geometry evidence, not a printed fit proof. Shrinkage, warp, surface finish, insert installation and insertion force remain unmeasured.

The 1U/2U coupons are full-depth right-hand interface slices. The 2U coupon includes the blind pocket; the 1U template has no pocket and its custom carriers have no added screw retention. Do not transfer an inferred fastening pattern or select inserts solely from their nominal M3 thread size.

## Frame and allocation

The full assembly uses original base/top parts, six full rails, the Mac cradle, its lid and two handles. The optional OWC mode also uses the original 1U holder. Placements derive from measured mating features, not print-plate coordinates or the scattered Bambu `assemble` metadata.

The STEP blanks are 25/50/75 mm high; rail slots repeat at 25.4 mm. The current HDD/SATA/NVMe/cooling/Mac arrangement needs eight units. Full rails provide nine usable full units; short rails provide six and are rejected for this layout. The last groove beneath either top is only a partial bay. See [dimensions](dimensions.md) for all datums.

The complete modeled envelope, including handles, is 172.6×178.8×262 mm. It excludes unselected connectors, bridges and supplies. The separate `macrack build` carrier study uses nominal-height spacing and ground skids, not the measured frame placement; its dimensions must not be substituted for this assembly.

## Collision coverage

The full-rack checker uses float64 Manifold intersections on original source meshes and native CAD tessellated at 0.02 mm linear tolerance. Positive-volume overlaps above 0.01 mm³ between printed parts, or between printed parts and the airflow reservation, fail export. Face contact is permitted. Every modeled mesh must be watertight, consistently wound and positive-volume; placement matrices must be proper rigid transforms.

Conservative reference-envelope overlaps remain a separate, explicit result. They are checked against printed parts, other references and the airflow reservation, not silently excluded. The current OWC comparison has one: the 127×127×50 square Mac box overlaps the rounded cradle by approximately 23,832 mm³. The actual Mac corner profile is not supplied, so that overlap cannot be cleared or called a physical collision. No fabricated corner radius is used to make the check pass.

The two published OWC whole-box envelopes do not overlap the source holder. They meet at the centerline and front stop; outer-side, depth and nominal-height allowances are small. This does not verify enclosure manufacturing tolerances, retention, connectors, P310 compatibility or continuous-transfer cooling.

Absent from these checks: SATA bridges, hubs, plugs, cable bend volumes, power supplies, straps, fasteners, thermal pads and isolators. Generic mode also omits unselected NVMe enclosures. None of those components is cleared by a zero printed-part intersection result.

## HDD support and service access

The assembled HDD carrier has continuous 8.6 mm skids, derived from the lowest slot at Z=12.6 and base-rib tops at Z=4. They rest nominally on the ribs and can slide over them. Ground-level skids with rib notches were rejected: they became trapped behind a rib when pulled forward. A regression exercises the initial 2 mm of withdrawal; a separate geometry smoke check found zero base overlap at 0, 2, 25.4, 50.8, 101.6 and 180 mm of withdrawal. These are sampled geometry checks, not a continuous motion or loaded-stability proof.

The proposed load path is carrier → skids → base ribs → supporting surface, rather than an unverified rail-slide cantilever. Nominal zero-clearance contact does not establish real load sharing. Bearing flatness, creep, wear, frame rigidity, accidental pull-out and support while partially withdrawn still require testing with an inert representative load.

SATA/HDD candidates use strap slots rather than guessed screw patterns. Printed support strips leave air under the case; their 3 mm height is a provisional design allowance, not a vibration isolator. Straps must avoid electronics, connectors and prohibited HDD cover-pressure areas. Confirm the exact Samsung model and chosen HDD drawing before replacing this arrangement with screw/grommet mounts.

No factory shielding or heatsinks are removed. Bare P310 boards must not be installed in the empty generic carrier. A commercial enclosure or a measured bridge/heatsink assembly with suitable protection is required.

The rear remains open, but plug access, bend radii, Mac power-button/port access and screw access are not validated for the unselected hardware. Disconnecting cables and maintaining support during removal are still part of the service procedure to establish.

## Stability and thermal gates

The frame footprint is measured, but selected-device/adapter masses, centers of gravity, cable forces, foot friction and the loaded withdrawal condition are unresolved. No tipping factor, rated payload or safe cantilever load is claimed. Keeping the HDD low is a layout decision, not stability proof.

Keep the complete 25.4 mm cooling band beneath the Mac empty. Do not place trays, cables or power bricks there. Sustained-transfer temperature measurements are required for the Mac, drives, bridges and printed parts. HDD start-up vibration, acoustic coupling and long-term creep need physical evaluation.

## Executed software checks

- The real CLI generated both the OWC comparison and generic empty-NVMe assembly, and rejected the short frame with a six-unit-versus-eight-unit diagnostic.
- The OWC assembly contains 21 component solids. FreeCAD independently validated 25 input/converted/full-assembly shapes, including per-source faceted STEP round trips. Full-assembly bounds, volume and solid count match the generated scene within the exporter tolerances. Reopening the saved FCStd also verified all 21 component shapes and placement matrices.
- Bambu Studio `--info` imported all ten exported STL files in the OWC output: two custom candidates and eight source files. Each was manifold and one part. The HDD candidate measures 166.8×155×58.6; the SATA candidate 166.8×108×25. Original source files retain local axes and are not arranged print jobs.
- All 50 regression tests passed, including source parsing, measured slots, rigid placement, reference/airflow collisions, HDD withdrawal, short-frame rejection, symlink/file preservation, output-directory obstruction and failed-render preservation. Ruff passed.
- FreeCAD generated front, rear and cutaway PNGs plus the interactive FCStd document. Camera animation is disabled and saved orientations are checked, so the PNGs do not capture intermediate view transitions. The installed GUI reports a missing optional 3Dconnexion input library; STEP conversion and rendering still succeed.
- Report-only mechanical and export audits were completed. Ownership/provenance/publication findings were corrected before final export.

`rack.json` records all source-template/3MF hashes and generated-file hashes. `freecad-rack-report.json` records independent shape checks and camera orientations. Rebuilding invalidates prior owned outputs; modified files and unowned destinations are refused. Full assembly STEP and FCStd byte hashes are not promised stable across regeneration, because CAD presentation ordering and document metadata can vary.

No printer/material toolpath slice, support preview, physical print, hardware fit, thermal test, vibration test or structural load test has been validated.

## Physical acceptance sequence

1. Confirm the exact Mac, drives, bridges/enclosures, commercial power supplies and connection topology. Add their actual plugs and cable bends to the model.
2. Print mating source rails and interface coupons with the intended printer/material. Measure fit and establish a suitable fastener/insert combination, including positive retention for custom 1U carriers.
3. Slice every full part with the selected profiles. Inspect first layers, wall counts, supports, bed fit and warnings; use dimensional gauges and an inert representative load.
4. Validate HDD bearing contact, retention, loaded withdrawal, tipping, rigidity, sustained temperatures and vibration before installing valuable hardware.
5. Keep existing storage untouched until a separate verified-backup and migration plan permits disassembly.
