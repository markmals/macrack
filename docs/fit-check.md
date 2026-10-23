# Fit and validation boundaries

## Compatibility evidence

The adapter imports the original STEP solids and rotates them +90° around X. It removes only the central body. The full side strips, including the slide chamfers, lateral pockets where present, and outer front flange, remain exact source geometry. Each build subtracts the candidate from the protected source strips and checks for both removed interface material and added interference material in that region.

This proves preservation against the supplied templates. Rail-to-slide clearance is unknown because the mating rails are absent. A successful Boolean operation, valid STEP import, or watertight mesh does not prove that a printed coupon slides freely or that the source author's hardware fits.

The 1U/2U coupons are full-depth slices of the right-hand interface. Use the 2U coupon to evaluate the original blind pocket with the intended insert. The 1U coupon deliberately has no pocket. Do not drill a guessed hole in a full carrier or add a guessed heat-set pocket before checking the rail and mounting hardware.

## Allocation and missing frame

The reference stack allocates 8U (200 mm): a 2U HDD carrier at the bottom, 1U SATA, 1U dual NVMe, 1U clear airflow space, and 3U for the Mac. The ground skids add 8 mm below the module stack. All bay origins stay on the measured 25 mm pitch. The Mac envelope is centered vertically within a provisional 3U reservation; this is not a measured cradle placement.

Only three template STEP files are available. The original rail height, usable U count, base, top, Mac cradle, screw access and OWC insert are unknown. No replacement rails or extensions are fabricated. Obtain those files before finalizing the frame or comparing the complete exterior with the approximately 170 × 190 × 322 mm Computer-1 chassis.

## Collision coverage

Build validation tests exact solid intersections, allowing face contact, among the generated carriers, the modeled reference device envelopes and the Mac airflow reservation. Each carrier is a valid single solid with positive volume. Exports receive STEP round-trip and STL watertightness, winding, volume and scale checks. Regression checks cover source-interface damage, blind-pocket backing, floor material, source-width preservation, bay relocation for a taller HDD, selected NVMe envelopes, invalid parameters and deliberate collisions.

Missing from these checks: all actual rails/frame parts, the Mac cradle, NVMe bridge/enclosure dimensions in the default build, SATA bridges, hubs, connector plugs, cable bend volumes, power supplies, straps, thermal pads and isolators. No zero-collision result can clear those absent components. Do not route power or USB cables through a modeled free space until their actual connector and bend requirements are added.

## Retention and service access

SATA and HDD candidates use side strap slots instead of guessed drive mounting holes. Printed support strips leave air under the case. Their 3 mm height is a design allowance, not a validated vibration isolator. Choose straps that cannot contact a bare PCB, exert pressure on a prohibited HDD cover area, or foul ports; establish positive retention and connector strain relief before installing hardware. Confirm the owner's exact Samsung drive and the chosen HDD drawing before replacing straps with screw/grommet mounts.

No factory heatsinks or shielding are removed. The NVMe carrier accepts whole enclosed devices only when configured. The bare P310 footprint alone cannot define its thermal packaging or electrical connection.

The rear is open for service. Connector access, bend radius, Mac ports/power button and screw/insert access remain unvalidated without the missing original parts and selected electronics.

## Load, stability and thermal gates

The HDD carrier's two longitudinal ground skids reach beneath its extended rear floor. In the reference assembly they contact Z=0, providing a proposed load path directly to the supporting surface. They are not fastened to a validated rack base. Frame interference, floor flatness, load sharing, creep, accidental pull-out and movement during drive start-up still require examination. Do not let the printed rail slides become the sole cantilever support.

A loaded tipping calculation needs the actual frame footprint, device and adapter masses, centers of gravity and cable forces. Those are unresolved, so the project reports no stability factor or safe payload. Keeping the HDD low is a layout choice, not stability proof.

Preserve the complete 1U beneath the Mac; do not fill it with a solid tray, cables or power bricks. Drive and bridge temperature measurements under continuous transfers are still required. Test HDD vibration and acoustic coupling with a sacrificial load before using valuable storage.

## Physical acceptance sequence

1. Obtain the original rails/frame, Mac cradle and any selected original enclosure module. Measure their mating geometry and usable height.
2. Print both rail coupons using the intended machine, material and orientation. Measure slide clearance and test pocket/insert retention without loading the rack.
3. Confirm exact device/bridge drawings and model all plugs, power blocks and cable bends. Verify vendor screw penetration limits and clearances.
4. Slice each full part with the selected printer/material, inspect supports and layer orientation, and test with dimensional gauges and an inert representative load.
5. Validate retention, HDD support, tipping, service access, sustained temperatures and vibration. Existing storage stays untouched until a separate verified-backup and migration plan permits disassembly.

## Executed software checks

The reference configuration built successfully with build123d 0.13.0. All three carriers and both coupons exported as single, valid solids and watertight, consistently wound meshes; every STEP was re-imported and measured against its source. The manifest reports zero positive-volume interference among modeled assembly components. This excludes the missing hardware listed above.

| Candidate | Width X | Depth Y | Height Z |
| --- | ---: | ---: | ---: |
| HDD carrier including skids | 166.8 | 155.0 | 58.0 |
| SATA SSD carrier | 166.8 | 108.0 | 25.0 |
| Empty dual NVMe carrier | 166.8 | 103.0 | 25.0 |
| Each rail coupon | 16.0 | 103.0 | 10.0 |

FreeCAD 1.1.4 independently imported the assembly and all five part/coupon STEP files: every shape was valid, the assembly contained seven solids, and each part/coupon contained one. Measurements are in `exports/freecad-report.json`. The modeled assembly bounds are 166.8 × 155 × 195.5 mm; the separate 208 mm allocation includes the whole reserved 3U Mac bay. Neither number includes an actual frame or electronics/cables omitted from the model.

Bambu Studio 2.8.2.61 imported all five STL files with `--info` and reported each as manifold and one part, with dimensions matching the CAD. This was an import/mesh check only. No printer/material profile, toolpath slice, support preview or physical print was validated.

The geometry and export-lifecycle regression suite passed 25 tests, including damaged/expanded rail interfaces, an intentional 100 mm³ collision, invalid vent/strap configurations, foreign-file preservation, failed-build invalidation and rejection of partial exports. Ruff checks passed. A FreeCAD GUI render was inspected at `exports/assembly-preview.png`; it shows the unsupported reference Mac envelope above the reserved airflow region because the original cradle is missing. The GUI logged a missing optional 3Dconnexion input-driver library, but rendering and STEP inspection succeeded.

A second default CLI build reproduced all ten individual STEP/STL files byte-for-byte. The assembly STEP reproduced its dimensions, volume, solid count and label hierarchy; OpenCascade changed presentation-style entity ordering, so the full assembly file is not promised to have a stable byte hash. A separate synthetic configuration exercised 3U HDD allocation and two configured NVMe enclosures through the real export command, yielding a validated 9U allocation and nine-solid assembly. These synthetic dimensions are test inputs, not hardware selections.

Report-only mechanical and export-pipeline reviews converged after regression-tested fixes. FreeCAD reports now record each STEP's SHA-256; compare those hashes before reusing a report from a custom location. The standard report is invalidated whenever a new build starts.
