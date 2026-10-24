# Print notes

## Candidate status

Exports are candidate solids, not approved print jobs. No owner printer, nozzle, material brand, filament condition or service temperature is selected. The original author's Bambu 3MF is available for inspection, but no custom configured print project or G-code is supplied. No physical print or fit test has been performed.

PETG or ASA are candidates for thermally loaded brackets after operating temperatures are measured. PLA is not presumed suitable for continuous load near hot drives or bridges. Use an appropriately enclosed printer and ventilation if ASA is chosen.

## Geometry and orientation

| Part | Starting orientation to inspect | Main risks |
| --- | --- | --- |
| SATA SSD carrier | Local Z=0 floor on bed | Vent bridges, narrow strap webs, layer strength at slide and side walls |
| Dual NVMe carrier | Local Z=0 floor on bed | Enclosures absent by default; support-pad and slot placement must be re-sliced after configuration |
| HDD carrier | Full-rack variant: translate local Z=-8.6 skid bottoms to bed; isolated-study default: Z=-8 | Elevated floor needs support unless another orientation is validated; inspect skid strength, removal and bearing flatness |
| 1U/2U rail coupons | Local Z=0 on bed | Preserve original sliding faces, chamfers and pocket; no automatic hole compensation |

The carrier front width is 166.8 mm. The original full rails are 254 mm long. Bed fit depends on depth, orientation, supports, brim, skirt and exclusion zones; do not assume these fit a nominal 180 mm bed. Use the original 3MF to inspect source-part orientations and quantities, including six rails. The exported `source/*.stl` files retain authored local axes, not necessarily a useful bed orientation, and do not encode print quantities.

The 3 mm floors and side walls are design allowances. Inspect actual perimeter counts and thin-wall treatment with the chosen nozzle and extrusion width. A nominal wall thickness does not guarantee the slicer produces a useful toolpath. Do not use coarse mesh repair or automatic scaling to make a part pass: regenerate or correct the source and re-run the geometry checks.

Full-rack HDD skids transfer load nominally into the original base ribs; the isolated carrier study instead uses ground-contact skids. Both prioritize a supported load path over support-free printing. Inspect the first skid layers, supported floor transition, support removal access, long rear edge and bearing flatness. The full-rack base contact is nominal zero-clearance CAD contact, not a manufacturing tolerance; use a coupon or inert-load trial to establish fit and load sharing before relying on it for a spinning drive.

## Slicer acceptance

Open each STL as millimeters in Bambu Studio. Inspect:

1. Dimensions and scale against `rack.json` for full-rack parts or `manifest.json` for isolated studies; translate to the bed without scaling.
2. First-layer contact, vent bridging, all overhangs, and support contact with slide mating faces.
3. Bed/exclusion-zone fit including brim and supports, wall toolpaths, top/bottom layers and thin sections around straps/pockets.
4. Mesh repair, floating-region, support, collision and cooling warnings. Record the exact printer, nozzle, filament and process profiles used.

A mesh-import check does not validate these sliced toolpaths. A clean slice does not prove a safe load-bearing print.

Never slice `rack.step` or the carrier-study `assembly.step`: they include non-printable device envelopes and reserved air. The OWC comparison uses the original shelf, not the narrower generic NVMe carrier. Bambu `--info` checks mesh import only; it does not exercise printer/material settings, support generation, first-layer toolpaths or thermal behavior.

## Fit coupons

Test the original 1U slide before spending material on a full carrier. The separate 2U coupon includes the measured Ø3.8 × 4.2 mm blind pocket. Evaluate the actual M3 insert's outside profile, installed depth, surrounding wall integrity and pull-out behavior before choosing it. The original 1U template has no pocket; no guessed equivalent is added.

Retain both the unmodified coupon and recorded printer/material settings. Change fit allowances only after measuring the real rail and understanding whether an error comes from source geometry, process shrinkage, warping or calibration. The project currently preserves the imported rail-slide surface without compensation.
