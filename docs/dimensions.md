# Dimensions and measurement record

Everything in this file is either measured from the three STEP templates in `assets/rack-pro/`, published by a manufacturer and cited in `docs/hardware-bom.md`, or flagged as a provisional screening value. All lengths are millimetres.

Nothing here has been printed or test-fitted. Geometry agreeing in CAD is not a fit proof.

## Coordinate conventions

The source STEP files arrive with width on X, height on Y, and depth running negative on Z: the raw bounding box of every template is X -83.4 to 83.4, Y 0 to the module height, Z -100 to 3.

This project normalises each imported template with a single `rotate(Axis.X, 90)`, which gives:

| Axis | Meaning after normalisation | Range |
|---|---|---|
| X | Width, centred on the module | -83.4 to +83.4 |
| Y | Depth, increasing rearward | -3 at the front flange face, 0 at the body front, +100 at the rear |
| Z | Height above the module floor | 0 to 25 / 50 / 75 |

Module-local coordinates use that frame. Assembly placement is a translation applied on top of it.

## Template measurements

Measured with `build123d.import_step` followed by `rotate(Axis.X, 90)`, reading bounding boxes, face areas, face types, and edge lengths. Each file imports as exactly one solid.

| File | Solids | Width X | Depth Y | Height Z | Volume (mm3) |
|---|---:|---:|---:|---:|---:|
| `1U Template.step` | 1 | 166.8 | 103.0 | 25.0 | 383867.7 |
| `2U Template.step` | 1 | 166.8 | 103.0 | 50.0 | 761282.4 |
| `3U Template.step` | 1 | 166.8 | 103.0 | 75.0 | 1138792.4 |

The templates are solid stock, not shells. For the 1U file, body 146 x 100 x 25 plus two slide strips 4 x 100 x 8 plus a flange 166.8 x 3 x 25 comes to about 383910 before chamfer removal, which matches the measured 383867.7. The author's instruction is to subtract device geometry from these blocks, so a carrier is cut out of the template rather than built up against it.

### Profile features, all three templates

| Feature | Measurement |
|---|---|
| Front flange | Y -3 to 0, full width 166.8, full module height |
| Body side walls | planar faces at X = +/-73, so 146.0 between them |
| Slide strips | X 73 to 77 on each side, so 154.0 across the outside, Y 0 to 100, Z 0 to 8 |
| Floor | planar face at Z = 0, area 15808.4 |
| Top | planar face at Z = module height, area 15088.4 |
| Chamfers | shortest straight edges measure 0.566, which is 0.4 x sqrt(2): a 0.4 x 0.4 chamfer at 45 degrees |

The 146.0 between the body walls matches the author's published 146 mm rail opening. The 154.0 across the slide strips is the part that engages the rails, and the rails are not in this repo.

### Flange corners are rounds, not holes

Each template has four cylindrical faces at the flange ears, area 9.425 each, bounded by X 81.4 to 83.4, Y -3 to 0, Z 0 to 2 and Z (height - 2) to height, with axes along Y.

Those are R2 quarter-round corner fillets on the flange, 3 deep through the flange thickness. A quarter cylinder of radius 2 and depth 3 has area (2 x pi x 2 / 4) x 3 = 9.42, which is what is measured. A full 4 mm through-hole in the same 3 mm flange would present about 37.7 of cylindrical area. The templates contain no through-holes of any kind. Do not read a hole out of a radius: an arc edge of radius 2 and a drilled hole of diameter 4 produce the same radius and completely different faces.

### Lateral blind pockets, 2U and 3U only

| Property | Value |
|---|---|
| Diameter | 3.8 |
| Depth | 4.2, measured inward from the slide outer face |
| Axis | along X |
| Extent | X 77.0 down to 72.8 on each side |
| Centre, normalised | Y 12.5, Z 4.0 |
| Cylindrical face area | 50.14, which equals pi x 3.8 x 4.2 |
| Pocket bottom | flat circular face at X = +/-72.8, area 11.3, which equals pi x 1.9 squared |

The author's description identifies heat-set insert pockets and gives example hardware of 4 mm long M3 inserts and M3×8 flat-head screws. These measured pocket dimensions do not establish compatibility with a particular insert's outside diameter, taper, insertion depth or installation temperature. Test the coupon before specifying hardware.

The 1U template has no pocket. A 1U carrier derived from it therefore has no screw retention at all unless the pocket is added, and the correct pocket for a 1U module cannot be measured from anything in this repo: the Z 4.0 centre of the 2U and 3U pocket sits inside the 0 to 8 slide strip, so the same height is geometrically available at 1U, but that is inference from the 2U and 3U parts, not a measurement of an author-supplied 1U module.

## Device envelopes used by the model

Full sourcing, links and caveats are in `docs/hardware-bom.md`. Summary of what the CAD consumes:

| Envelope | Value (X x Y x Z as used) | Status |
|---|---|---|
| Mac mini | 127.0 x 127.0 x 50.0 | manufacturer figure for Mac mini (2024), machine not purchased |
| 2.5-inch SATA SSD | 69.85 x 100.0 x 6.8 | manufacturer figure, Samsung 870 QVO datasheet; owner's exact submodel still to be read off the drive |
| 3.5-inch HDD | 101.854 x 147.0 x 26.11 | reference drawing maxima, with 146.99 mm depth rounded up; drive not selected |
| M.2 2280 card | not modeled as a solid | 22 x 80 footprint known; 4TB thickness unpublished |
| NVMe enclosure | none | no bridge selected, so no envelope is invented |

The SATA figure is nominal. The linked product flyer gives a worst-case envelope of 100.45 long, 70.10 wide and 7.00 thick; the nominal datasheet differs slightly, so confirm the physical drive before final fit. The HDD width comes from the high side of 4.000 +/-0.010 in. These values screen the referenced products only; they do not establish an envelope for every future drive or a press fit.

## Provisional screening values

These are model parameters chosen so the stack can be exercised. They are not product specifications and no test backs them:

| Parameter | Value | Why provisional |
|---|---|---|
| Printed retention pad thickness | 3 | No measured drive-to-shell clearance, no durometer, no creep data |
| HDD ground skid height | 8 | Chosen to clear the rear extension, not derived from a load case |
| Carrier interface strip preserved | all geometry at abs(X) >= 70 | Keeps the author's slide and pocket geometry untouched rather than reconstructing it |
| Strap retention instead of screws | n/a | The drive hole patterns are unverified, so no mounting holes are drilled in CAD |

Drive retention by strap and pad is a deliberate consequence of unknown hole patterns, not a preference. Once an actual drive is in hand and its holes are measured, hard mounting can replace it.

## Current stack arithmetic

| Slot | Height |
|---|---:|
| HDD carrier | 2U |
| SATA SSD carrier | 1U |
| NVMe carrier | 1U |
| Air gap under the Mac | 1U |
| Mac mini module | 3U |
| Total | 8U = 200 |

Plus 8 for the ground skids under the HDD carrier, so about 208 of stacked height. The exterior frame is not part of that number: rails, feet, top and bottom plates, cable routing and connector overhang are all missing from this repo, so there is no exterior envelope yet and no comparison against the Computer-1 chassis can be made.

The 1U air gap under the Mac follows the author's recommendation to leave 1U free for the Mac's intake and exhaust.

## What these measurements do not prove

1. No rail geometry is in `assets/`, so slide fit, insertion force, and screw alignment into the rails are untested and untestable here.
2. No printed part exists. Tolerance, shrinkage, warp, layer adhesion and support behaviour are unmeasured.
3. No physical test fit of any device in any carrier has happened.
4. No thermal analysis or measurement exists, for the Mac, the drives, or any bridge.
5. No load case has been computed for printed slides carrying a 655 g class drive, and no vibration isolation has been designed.
6. Three of the five devices are not purchased or not identified, so their envelopes may change.

## Reproducing the measurements

The numbers above come from importing each file with build123d, normalising with `rotate(Axis.X, 90)`, then reading bounding boxes, planar face positions and areas grouped by normal, cylindrical face areas and bounds, and the sorted set of edge lengths. The templates are licensed for private use only, so they are not redistributed and neither are exports derived from them. See the licensing note in `docs/hardware-bom.md`.
