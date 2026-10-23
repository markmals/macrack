# Print notes

## Candidate status

The exports are candidate solids, not approved print jobs. No printer, nozzle, material brand, filament condition or service temperature is selected. No 3MF project or G-code is supplied, and no physical print or fit test has been performed.

PETG or ASA are candidates for thermally loaded brackets after operating temperatures are measured. PLA is not presumed suitable for continuous load near hot drives or bridges. Use an appropriately enclosed printer and ventilation if ASA is chosen.

## Geometry and orientation

| Part | Starting orientation to inspect | Main risks |
| --- | --- | --- |
| SATA SSD carrier | Local Z=0 floor on bed | Vent bridges, narrow strap webs, layer strength at slide and side walls |
| Dual NVMe carrier | Local Z=0 floor on bed | Enclosures absent by default; support-pad and slot placement must be re-sliced after configuration |
| HDD carrier | Translate local Z=-8 skid bottoms to bed | Floor hangs 8 mm above the bed between skids; support required unless a different orientation is validated; long-term creep and skid/frame interference unresolved |
| 1U/2U rail coupons | Local Z=0 on bed | Preserve original sliding faces, chamfers and pocket; no automatic hole compensation |

The carrier front width is 166.8 mm from the source. Bed fit also depends on the configured depth, orientation, supports, brim, skirt and printer exclusion zones. Do not infer usable bed fit solely from a nominal 180 mm bed or assume the future frame will fit the same printer.

The 3 mm floors and side walls are design allowances. Inspect actual perimeter counts and thin-wall treatment with the chosen nozzle and extrusion width. A nominal wall thickness does not guarantee the slicer produces a useful toolpath. Do not use coarse mesh repair or automatic scaling to make a part pass: regenerate or correct the source and re-run the geometry checks.

The integral HDD skids deliberately prioritize a direct ground load path over support-free printing. Check the first skid layers, the supported floor transition, support removal access, the long rear edge and the finished floor's flatness. Print an inert-load trial before relying on it to carry a spinning drive.

## Slicer acceptance

Open each STL as millimeters in Bambu Studio. Inspect:

1. Part dimensions and scale against `manifest.json`; translate to the bed without scaling.
2. First-layer contact, vent bridging, all overhangs, and support contact with slide mating faces.
3. Bed/exclusion-zone fit including brim and supports, wall toolpaths, top/bottom layers and thin sections around straps/pockets.
4. Mesh repair, floating-region, support, collision and cooling warnings. Record the exact printer, nozzle, filament and process profiles used.

A mesh-import check does not validate these sliced toolpaths. A clean slice does not prove a safe load-bearing print.

## Fit coupons

Test the original 1U slide before spending material on a full carrier. The separate 2U coupon includes the measured Ø3.8 × 4.2 mm blind pocket. Evaluate the actual M3 insert's outside profile, installed depth, surrounding wall integrity and pull-out behavior before choosing it. The original 1U template has no pocket; no guessed equivalent is added.

Retain both the unmodified coupon and recorded printer/material settings. Change fit allowances only after measuring the real rail and understanding whether an error comes from source geometry, process shrinkage, warping or calibration. The project currently preserves the imported rail-slide surface without compensation.
