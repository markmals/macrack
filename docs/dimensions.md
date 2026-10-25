# Dimensions and measurement record

Measurements come from the three STEP templates and original Bambu 3MF in `assets/rack-pro/`, manufacturer sources cited in `docs/hardware-bom.md`, or explicitly provisional design parameters. All lengths are millimeters. The 3MF is tessellated source geometry, not recovered analytic CAD.

Nothing here has been printed or test-fitted. Geometry agreeing in CAD is not a fit proof.

## Original source inventory

The model's CAD-file download list contains exactly the three templates already in `assets/rack-pro/`. The original frame and device modules are packaged separately in the [Rack Essentials, Mac mini M4, and Equipment Modules print profile](https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons#profileId-854246), profile 854246. The previously supplied anchor 1040265 selects a third-party half-U logo plate and cable comb.

The main profile has 14 plates. These are the relevant original parts:

| Plate | Designer's part name | Needed for |
| --- | --- | --- |
| 1 | Rack Rails | Full-height frame and measured rail fit |
| 2 | Rack Top with Apple Logo | Top closure and complete exterior dimensions |
| 3 | Rack Base | Ground contact, base clearance and HDD support integration |
| 4 | Mac Mini Pro (Rack) | Original Mac cradle, mounting and port access |
| 5 | Mac Mini Pro Lid | Original cradle closure |
| 6 | 1U SSD Shelf (OWC 1M2 or similar) | Optional reuse with the matching enclosures |
| 13 | Alternate Short Rails | Smaller-frame feasibility |

`assets/rack-pro/rack-pro.3mf` is that main 14-plate project. The parser resolves component-file transforms but discards build-plate positions and the scattered `assemble` metadata. Those coordinates are not a finished rack assembly. Frame sockets, slot faces and module mating features determine the new placements; the manifest records their transforms, source hashes and measurements.

## Measured frame

| Feature                          | Full rails | Short rails |
| -------------------------------- | ---------: | ----------: |
| Original rail length             |      254.0 |       177.8 |
| Assembled frame width            |      172.6 |       172.6 |
| Assembled frame depth            |      175.0 |       175.0 |
| Assembled frame height           |      262.0 |       185.8 |
| Groove positions                 |         10 |           7 |
| Usable full-height 1U positions  |          9 |           6 |
| Lowest groove floor above ground |       12.6 |        12.6 |
| Groove pitch                     |       25.4 |        25.4 |
| Usable ceiling under top skirt   |      252.0 |       175.8 |

The last groove is not a full usable bay: a 25 mm module there would intersect the top skirt. The central top-plate underside is 5 mm above that skirt, but the skirt overlaps the full module width. Counting grooves alone overstates usable capacity.

The rail inner faces are X=±73.2, giving a 146.4 mm opening. Groove roots are X=±77.2; grooves are 4.0 deep and 8.2 high. Against the STEP slides, these give nominal 0.2 mm side allowances and 0.2 mm vertical allowance. There is 0.4 mm between the 25 mm module height and the 25.4 mm pitch. These are geometric allowances, not print tolerances or physical-fit evidence.

Assembly coordinates are centered across X, +Y rearward, and Z=0 at the base underside. Module-local Y=0 is placed at assembly Y=-72; front flanges occupy Y=-75..-72. Six rails seat at X=±78.2 and Y=-59.4, 0, +59.4. Their bottoms are Z=4.

The base has two transverse ribs at Y=-72..-46.8 and 46.8..72, spanning X=-70.1..70.1, with tops at Z=4. The assembled HDD skid height is derived as 12.6-4=8.6, placing continuous skids on those ribs. Notched ground-level feet were rejected because they caught behind a rib during front withdrawal.

The original Mac cradle occupies 75 mm above its slot; its lid and two handles are seated on measured interfaces. A 127×127×50 reference box stands 9.5 mm above the cradle floor, centered in a 127.8×127.8 pocket. Its square corners overlap the rounded pocket; no unpublished Mac corner radius is substituted to clear that overlap.

The original OWC shelf's bay is 143.0 wide, 132.4 deep and has a 1.8 mm floor. The two 71.1×132×22.8 comparison boxes fit geometrically as a touching pair, with 0.4 mm at each side wall, 0.4 mm total depth allowance and 0.4 mm below the nominal 25 mm module ceiling. Their front faces touch the stop; there is no center divider or inter-enclosure air gap in this comparison.

## Coordinate conventions

The source STEP files arrive with width on X, height on Y, and depth running negative on Z: the raw bounding box of every template is X -83.4 to 83.4, Y 0 to the module height, Z -100 to 3.

This project normalises each imported template with a single `rotate(Axis.X, 90)`, which gives:

| Axis | Meaning after normalisation | Range |
| --- | --- | --- |
| X | Width, centred on the module | -83.4 to +83.4 |
| Y | Depth, increasing rearward | -3 at the front flange face, 0 at the body front, +100 at the rear |
| Z | Height above the module floor | 0 to 25 / 50 / 75 |

Module-local coordinates use that frame. Full-rack placement adds the measured module Y datum and slot Z origin. The carrier-only study instead retains nominal 25 mm height spacing and is not a rack placement model.

## Template measurements

Measured with build123d's `import_step` followed by `rotate(Axis.X, 90)`, reading bounding boxes, face areas, face types, and edge lengths. Each file imports as exactly one solid. The TypeScript tooling reproduces the bounding boxes, volumes and pocket faces with caddy's `importCAD` and the same rotation.

| File               | Solids | Width X | Depth Y | Height Z | Volume (mm3) |
| ------------------ | -----: | ------: | ------: | -------: | -----------: |
| `1U Template.step` |      1 |   166.8 |   103.0 |     25.0 |     383867.7 |
| `2U Template.step` |      1 |   166.8 |   103.0 |     50.0 |     761282.4 |
| `3U Template.step` |      1 |   166.8 |   103.0 |     75.0 |    1138792.4 |

The templates are solid stock, not shells. For the 1U file, body 146 x 100 x 25 plus two slide strips 4 x 100 x 8 plus a flange 166.8 x 3 x 25 comes to about 383910 before chamfer removal, which matches the measured 383867.7. The author's instruction is to subtract device geometry from these blocks, so a carrier is cut out of the template rather than built up against it.

### Profile features, all three templates

| Feature | Measurement |
| --- | --- |
| Front flange | Y -3 to 0, full width 166.8, full module height |
| Body side walls | planar faces at X = +/-73, so 146.0 between them |
| Slide strips | X 73 to 77 on each side, so 154.0 across the outside, Y 0 to 100, Z 0 to 8 |
| Floor | planar face at Z = 0, area 15808.4 |
| Top | planar face at Z = module height, area 15088.4 |
| Chamfers | shortest straight edges measure 0.566, which is 0.4 x sqrt(2): a 0.4 x 0.4 chamfer at 45 degrees |

The 146.0 body width is slightly smaller than the measured 146.4 rail opening. The 154.0 across the slide strips engages the grooves whose roots span 154.4. The original slide profile is retained, not reconstructed from those dimensions.

### Flange corners are rounds, not holes

Each template has four cylindrical faces at the flange ears, area 9.425 each, bounded by X 81.4 to 83.4, Y -3 to 0, Z 0 to 2 and Z (height - 2) to height, with axes along Y.

Those are R2 quarter-round corner fillets on the flange, 3 deep through the flange thickness. A quarter cylinder of radius 2 and depth 3 has area (2 x pi x 2 / 4) x 3 = 9.42, which is what is measured. A full 4 mm through-hole in the same 3 mm flange would present about 37.7 of cylindrical area. The templates contain no through-holes of any kind. Do not read a hole out of a radius: an arc edge of radius 2 and a drilled hole of diameter 4 produce the same radius and completely different faces.

### Lateral blind pockets, 2U and 3U only

| Property | Value |
| --- | --- |
| Diameter | 3.8 |
| Depth | 4.2, measured inward from the slide outer face |
| Axis | along X |
| Extent | X 77.0 down to 72.8 on each side |
| Centre, normalised | Y 12.5, Z 4.0 |
| Cylindrical face area | 50.14, which equals pi x 3.8 x 4.2 |
| Pocket bottom | flat circular face at X = +/-72.8, area 11.3, which equals pi x 1.9 squared |

The author's description identifies heat-set insert pockets and gives example hardware of 4 mm long M3 inserts and M3×8 flat-head screws. These measured pocket dimensions do not establish compatibility with a particular insert's outside diameter, taper, insertion depth or installation temperature. Test the coupon before specifying hardware.

The 1U STEP template has no pocket, so its custom carriers have no screw retention added here. The original 1U OWC holder is now available, but its fastening details and a suitable insert/fastener combination still need a dedicated check before transferring any retention feature to the custom 1U carrier. The 2U/3U pocket cannot by itself establish a validated 1U fastening design.

## Device envelopes used by the model

Full sourcing, links and caveats are in `docs/hardware-bom.md`. Summary of what the CAD consumes:

| Envelope | Value (X x Y x Z as used) | Status |
| --- | --- | --- |
| Mac mini | 127.0 x 127.0 x 50.0 | manufacturer figure for Mac mini (2024), machine not purchased |
| 2.5-inch SATA SSD | 69.85 x 100.0 x 6.8 | manufacturer figure, Samsung 870 QVO datasheet; owner's exact submodel still to be read off the drive |
| 3.5-inch HDD | 101.854 x 147.0 x 26.11 | Seagate IronWolf ST12000VN0008 maxima, with 146.99 mm depth rounded up; selected, not purchased |
| M.2 2280 card | not modeled as a solid | 22 x 80 footprint known; 4TB thickness unpublished |
| NVMe enclosure | absent in generic mode; 71.1 x 132.0 x 22.8 in OWC mode | manufacturer dimensions for original 40Gb/s Express 1M2; planned, not purchased |

The SATA figure is nominal. The linked product flyer gives a worst-case envelope of 100.45 long, 70.10 wide and 7.00 thick; the nominal datasheet differs slightly, so confirm the physical drive before final fit. The HDD width comes from the high side of 4.000 +/-0.010 in. These values screen the referenced products only; they do not establish an envelope for every future drive or a press fit.

## Provisional screening values

These are model parameters chosen so the stack can be exercised. They are not product specifications and no test backs them:

| Parameter | Value | Why provisional |
| --- | --- | --- |
| Printed retention pad thickness | 3 | No measured drive-to-shell clearance, no durometer, no creep data |
| HDD ground skid height in carrier-only study | 8 | Provisional isolated-study value; full-rack skids instead derive to 8.6 from measured base/slot datums |
| Carrier interface strip preserved | all geometry at abs(X) >= 70 | Keeps the author's slide and pocket geometry untouched rather than reconstructing it |
| Strap retention instead of screws | n/a | The Samsung's hole pattern is unpublished; the IronWolf's is now published but not yet applied |

Drive retention by strap and pad started as a consequence of unknown hole patterns, not a preference. The selected IronWolf's manual now gives its 6-32 UNC hole pattern, and the HDD tray's strap path conflicts with its skids (see the fit check), so the HDD tray needs a screw-mount revision. The Samsung tray keeps straps until its holes are measured on the drive.

## Current assembled stack

| Module                            | Allocated U | Floor Z above ground |
| --------------------------------- | ----------: | -------------------: |
| HDD carrier                       |           2 |                 12.6 |
| SATA SSD carrier                  |           1 |                 63.4 |
| OWC shelf or generic NVMe carrier |           1 |                 88.8 |
| Empty Mac cooling band            |           1 |                114.2 |
| Original Mac module               |           3 |                139.6 |

The cooling band is 25.4 mm high and the cradle ends at Z=214.6. This eight-unit arrangement fits the full frame, not the short frame. A 3U HDD allocation moves the upper bays by another measured pitch and requires nine units.

The frame alone is 172.6×175×262. The handles extend the modeled depth to 178.8. Compared with the approximate 170×190×322 Computer-1 exterior, this reference assembly is slightly wider, shallower and shorter. It excludes unselected electronics, plugs and cable bends, so it is not a final system-envelope comparison.

The separate carrier-only study totals 200 mm of nominal module heights plus default 8 mm ground skids. That 208 mm allocation must not be substituted for the measured complete-rack dimensions.

## What these measurements do not prove

1. Nominal source-mesh clearance does not establish printed slide fit, insertion force, screw alignment or fastener suitability.
2. No printed part exists. Tolerance, shrinkage, warp, layer adhesion and support behaviour are unmeasured.
3. No physical test fit of any device in any carrier has happened.
4. No thermal analysis or measurement exists, for the Mac, the drives, or any bridge.
5. The base-supported HDD load path has no validated payload, creep margin, vibration isolation or tipping factor.
6. Three of the five devices are not purchased or not identified, so their envelopes may change.

## Reproducing the measurements

`node src/cli.ts inspect` reports template dimensions/hashes and the selected frame's measured datums. `node src/cli.ts rack` records source-module features, placements and intersection results in `rack.json`. Frame measurements use face planes and pocket ray probes; original mesh coordinates are retained. Native STEP templates are normalized with `rotate(Axis.X, 90)` and checked by Boolean subtraction. Source files and geometry derived from them remain private; see `docs/hardware-bom.md`.
