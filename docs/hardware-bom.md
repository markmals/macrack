# Hardware BOM and sourcing evidence

Private project notes for the Mac mini Rack Pro build. Every row below is either a manufacturer-published figure with a link, a value measured from the local STEP templates, or an explicitly provisional screening value. Nothing here is a fit proof: no part of this project has been printed, test-fitted, or assembled, and several devices have not been bought.

All lengths are millimetres. Inch conversions use 25.4 mm/in.

## Provenance labels

| Label | Meaning |
|---|---|
| `datasheet` | Published by the manufacturer in a datasheet, product manual, or tech-spec page that is linked here. |
| `vendor-image` | Published by the vendor, but only as a dimensioned marketing image, not a drawing. |
| `measured-local` | Measured by this repo from `assets/rack-pro/*.step` with build123d. See `docs/dimensions.md`. |
| `provisional` | A user-configurable screening number chosen so the model can be exercised. Not a product spec. |
| `unknown` | Not published, not measured, not decided. Stays unknown until someone supplies it. |

## Devices

### Apple Silicon Mac mini (1, not purchased)

| Property | Value | Provenance |
|---|---|---|
| Width | 127.0 | `datasheet` |
| Depth | 127.0 | `datasheet` |
| Height | 50.0 | `datasheet` |
| Weight | 0.67 kg (M4), 0.73 kg (M4 Pro) | `datasheet` |
| Max continuous power | 155 W | `datasheet` |
| Operating temperature | 10 to 35 C | `datasheet` |

Source: Apple, Mac mini (2024) Tech Specs, <https://support.apple.com/en-us/121555>.

The owner has not bought a Mac mini and the generation is unconfirmed. These are Mac mini (2024) M4/M4 Pro figures, used as a reference envelope only. A different generation changes the envelope and invalidates the Mac keepout. Apple publishes no port-position dimensions, no foot pattern, and no vent geometry, so port cutouts and intake clearance cannot be dimensioned from the spec page. The Rack Pro author recommends 1U of empty space under the Mac for intake and exhaust.

### Crucial P310 4TB NVMe SSD, CT4000P310SSD8 (2, owner-held)

| Property | Value | Provenance |
|---|---|---|
| Form factor | M.2 2280, no heatsink | `datasheet` |
| Length | 80.0 (3.15 in) | `datasheet` |
| Width | 22.0 (0.86 in) | `datasheet` |
| Thickness | 2.3 (0.09 in) for the capacities the datasheet covers | `datasheet` |
| Thickness and sidedness at 4TB | `unknown` | |
| Weight at 4TB | `unknown` | |

Source: Crucial P310 2280 PCIe 4.0 NVMe M.2 SSD datasheet (Micron, 2024), <https://www.simms.co.uk/PDFS/Products/SSD/Crucial-P310-M.2-2280-datasheet.pdf>. That revision tabulates 500GB, 1TB and 2TB only, and gives one "no heatsink" dimension column: length 3.15 in, height 0.09 in, width 0.86 in.

The part number resolves the heatsink question: `CT4000P310SSD8` is the bare 2280 drive and `CT4000P310SSD5` is the same capacity with a pre-installed heatsink. Crucial's own product pages carry that distinction in their titles (`.../ssd/p310/ct4000p310ssd8` versus `.../ssd/p310/ct4000p310ssd5`). Direct fetches of crucial.com and eu.crucial.com were refused by the site's bot protection during this research, so those two titles come from the search index rather than a page this repo loaded. The datasheet above was loaded in full.

The 4TB SKU is absent from the datasheet revision that carries dimensions, so its thickness and sidedness remain unconfirmed. It also needs a USB4/Thunderbolt bridge enclosure and heat sinking, which are not selected. No NVMe device envelope is modeled from an invented enclosure size.

### Samsung 870 8TB 2.5-inch SATA SSD (1, owner-held)

| Property | Value | Provenance |
|---|---|---|
| Length | 100.0 | `datasheet` |
| Width | 69.85 | `datasheet` |
| Height | 6.8 | `datasheet` |
| Worst-case with tolerance | 100.45 x 70.10 x 7.00 | `datasheet` |
| Weight | 57 g | retailer listing, not Samsung |
| Mounting holes | `unknown` from the datasheet; the 2.5-inch standard is SFF-8201 M3 | |

Sources: Samsung SSD 870 QVO Data Sheet Rev 1.1, June 2020, <https://download.semiconductor.samsung.com/resources/data-sheet/Samsung_SSD_870_QVO_Data_Sheet_Rev1.1_10129514052310.pdf> (technical specifications table: "Dimension 100 x 69.85 x 6.8 (mm)", form factor 2.5 inch, capacities 1/2/4/8TB, 8TB model `MZ-77Q8T0` with codes `MZ-77Q8T0BW`, `MZ-77Q8T0B/AM`, `MZ-77Q8T0B/CN`). Per-axis tolerances come from the 870 QVO product flyer, width 100.20 +/-0.25, depth 69.85 +/-0.25, height 6.80 +/-0.20, mirrored at <https://www.netram.fr/out/media/MZ-77Q1T0BW-Samsung-Q870-1To.pdf>.

The owner's drive is described only as "Samsung 870 8TB". Samsung shipped 8TB in the 870 QVO line and the 870 EVO topped out below that, which makes QVO the likely identification, but likely is not confirmed. The exact label on the owner's drive is still required: read the model code off the drive, do not infer it from capacity. All 870 QVO capacities share the same 2.5-inch 7 mm body, so the envelope is unlikely to move even if the submodel differs; the submodel still has to be recorded before anything is called confirmed.

Samsung does not publish the mounting-hole pattern in this datasheet. The repo must not guess hole positions. Retention is handled by straps and printed pads instead, which is why the SATA carrier carries no drilled drive-mounting features.

### 12TB 3.5-inch SATA HDD (1, not purchased, model unknown)

No 12TB drive has been chosen or bought. To let the stack be screened at all, the model uses a conservative 3.5-inch envelope taken from a drive that is explicitly NOT the selected part.

Reference part: Seagate IronWolf Pro `ST12000NT001`.

| Property | Value | Provenance |
|---|---|---|
| Length | 146.99 max (5.787 in max) | `datasheet` |
| Width | 101.854 max (4.000 +/-0.010 in, so 101.60 nominal) | `datasheet` |
| Height | 26.11 max (1.028 in max) | `datasheet` |
| Weight | 655 g max | `datasheet` |
| Mounting | 4x 6-32 UNC side, 4x 6-32 UNC bottom, 3 threads min engagement | `datasheet` |
| Max fastener penetration | 3.56 (0.14 in) | `datasheet` |
| Max mounting torque | 6 in-lb | `datasheet` |
| Perimeter cooling clearance | 0.76 min (0.030 in) around the whole drive | `datasheet` |
| Start current, 12V | 1.69 A DC peak, 1.96 A AC peak | `datasheet` |
| Operating temperature | 5 to 65 C drive-reported | `datasheet` |

Source: Seagate IronWolf Pro SATA Product Manual, publication 206815300 Rev B, July 2025, sections 2.1, 3.3 and figure 4, <https://www.seagate.com/content/dam/seagate/assets/products/nas-drives/ironwolf-pro-hard-drive/files/Seagate_IronWolf_Pro_SATA_Product_Manual_24-20-16-12TB_206815300B.pdf>. The manual states these dimensions conform to SFF-8301 and SFF-8323, <https://www.snia.org/technology-communities/sff/specifications>.

The three envelope numbers are maxima under manufacturing tolerance, not nominals, which is what a keepout wants. Seagate Exos 3.5-inch datasheets quote the same 26.11 x 101.85 x 146.99 because every compliant 3.5-inch drive shares the SFF-8301 body. Weight, screw positions, power draw and acoustics are drive-specific and change with the drive that is finally bought: 655 g is this Seagate's maximum, and a 12TB helium or SMR drive from another vendor will differ.

A 3.5-inch drive needs 5V and 12V. Connecting it over USB does not make it bus-powered. No supply, bridge or dock has been chosen, so there is no power budget in this repo.

### Connectivity and power (not selected)

No NVMe bridge, SATA-to-USB bridge, powered hub, or AC/DC supply has been chosen. Their dimensions, connector positions, cable bend radii, heat output and current draw are all unknown. No connector, cable-path or power-adapter keep-out is generated; these are explicit gaps in assembly collision coverage.

## OWC Express 1M2, evaluated and not adopted

| Property | Value | Provenance |
|---|---|---|
| Length | 132.0 (5.2 in) | `vendor-image` |
| Width | 71.1 (2.8 in) | `vendor-image` |
| Height | 22.8 (0.9 in) | `vendor-image` |
| Accepts | NVMe M.2 2230 / 2242 / 2280, single or double sided | vendor page |
| Interface and power | USB4 40Gb/s, bus powered, 0.3 m USB-C cable included | vendor page |
| Mounting holes, weight, thermal rating | `unknown` | |

Sources: OWC Express 1M2 product page, <https://eshop.macsales.com/shop/owc-express-1m2>, and OWC's dimensioned product image, <https://media.owcnow.com/image/upload/owc-express-1m2-side-measurements>. OWC's specification tab did not render in the fetched page, so the three dimensions come from that image, which is OWC's own artwork.

The Rack Pro author ships a 1U module that holds two Express 1M2 enclosures side by side, with ventilation slots added in the 02/02/2025 update, per the model description at <https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons>. That module is not in `assets/rack-pro/`; this repo only has the three empty templates, so the module cannot be inspected, measured, or reused here.

Two Express 1M2 enclosures side by side are 142.2 wide before any wall, rib or clearance. That exceeds this carrier's 140 mm interior, and 22.8 mm height exceeds 1U once the current floor and air allowances are included. If these enclosures are selected, obtain and inspect the author's dedicated module before reusing it. No purchase or physical fit is assumed.

## Fasteners and rack interface hardware

The Rack Pro author states that modules are secured with an M3 flat-head cap screw through the vertical rail into a heat-set insert in the side of the module's rail slide, and that he uses 4 mm long M3 inserts with M3x8 FHCS. Source: the model description linked above.

The local 2U and 3U templates carry a Ø3.8 mm blind pocket 4.2 mm deep in each slide. The 1U template has no such pocket. A particular insert's outside diameter and taper must be checked against the pocket; length alone cannot prove fit. The rails are absent, so screw clearance, head recess, rail wall thickness and insert-to-rail distance remain unknown. No final fastener length or insert specification is established here.

HDD fasteners, if a 3.5-inch drive is ever hard-mounted, are 6-32 UNC with the penetration and torque limits in the Seagate table above. The current carriers do not use them: retention is by strap and printed pad, because no chosen drive means no verified hole pattern.

## Storage, backup, and why 12TB is not proven adequate

The owner's three large SSDs form a single OpenZFS pool, `biggie`, built from three single-disk top-level vdevs (8TB SATA plus two 4TB NVMe) with no redundancy, roughly 8.73 TiB of logical data, no snapshots, and a compression ratio of 1.00x.

A 12 TB drive has about 10.91 TiB of raw capacity before filesystem overhead, leaving roughly 2.18 TiB above the recorded logical data. That arithmetic does not establish adequate backup capacity or safety: growth, migration format, filesystem overhead, verification and restore testing are unresolved. The future HDD is not already an external verified backup, and one copy is not sufficient protection for irreplaceable data.

This project is mechanical CAD. It does not read, mount, write, repartition, reformat, detach, or otherwise touch any of the owner's disks, and no step in this repo should ever require doing so. Migration is a separate job that starts with a verified external backup.

## Unresolved items

These block any claim of fit, thermal adequacy, or hardware specification:

1. Mac mini generation. Not purchased. If it is not the 2024 M4 body, the 127 x 127 x 50 keepout is wrong.
2. Crucial P310 4TB thickness and sidedness. Not in the datasheet revision that carries dimensions.
3. Crucial P310 4TB weight. Not published in the sources found.
4. Samsung submodel. "Samsung 870 8TB" is most likely an 870 QVO `MZ-77Q8T0`, but the exact model code has to be read off the owner's drive.
5. Samsung mounting-hole pattern. Not in the Samsung datasheet; the SFF-8201 pattern has not been verified against this drive.
6. NVMe bridge or enclosure. Not selected, so no dimensions, no connector positions, no cable envelope, no heat output.
7. SATA-to-USB bridge. Not selected, same consequences.
8. 12TB HDD make and model. Not purchased. Weight, screw positions, power, acoustics and vibration behaviour all change with the choice.
9. Power. No supply, hub, or dock chosen; total current and connector count are unknown, so there is no power budget here.
10. Thermal behaviour. No airflow measurement, no CFD, no temperature test. Printed material choice for loaded brackets is open; PETG and ASA are candidates pending a service-temperature check.
11. Rails and frame. Not in `assets/`, so rail length, usable U count, stack rigidity, and the screw interface into the rail are unverified.
12. Mass and load path. Combined module and drive mass on printed slides has not been calculated or tested.
13. Vibration isolation for a spinning drive. Not designed, not measured.
14. Fastener schedule. Insert type and screw length cannot be fixed without the rail geometry.

## Licensing and publication

The Rack Pro download is covered by MakerWorld's Standard Digital File License, which forbids sharing, sub-licensing, selling, renting, hosting, transferring, or distributing the digital or printed object or any derivative, including remixes and hosting elsewhere, and forbids any use for money. Source: the license block on <https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons>.

The three template STEP files under `assets/rack-pro/` are that licensed geometry. They stay local, as do any exports derived from them. Nothing from this project gets published, pushed, posted, or redistributed. Link to the author's model page instead.
