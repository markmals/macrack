# Hardware BOM and sourcing evidence

Private project notes for the Mac mini Rack Pro build. Every row below is either a manufacturer-published figure with a link, a value measured from the local STEP templates, or an explicitly provisional screening value. Nothing here is a fit proof: no part of this project has been printed, test-fitted, or assembled, and several devices have not been bought.

All lengths are millimetres. Inch conversions use 25.4 mm/in.

## Provenance labels

| Label | Meaning |
|---|---|
| `datasheet` | Published by the manufacturer in a datasheet, product manual, or tech-spec page that is linked here. |
| `vendor-image` | Published by the vendor, but only as a dimensioned marketing image, not a drawing. |
| manual | Stated in the manufacturer's own support manual or assembly guide that is linked here. |
| vendor page | Stated in the manufacturer's own product or support page, but not as a dimensioned figure. |
| `measured-local` | Measured by this repo from `assets/rack-pro/*.step` with build123d and reproduced with caddy. See `docs/dimensions.md`. |
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

The owner describes these drives as bare boards. OWC's Express 1M2 manual, linked below, requires an SSD without an attached heatsink. That matches the intended packaging route, but does not establish compatibility with the specific 4TB P310's thickness, power demand or thermal behavior.

The 4TB SKU is absent from the datasheet revision that carries dimensions, so its thickness, sidedness and weight remain unconfirmed. It also needs a USB4 or Thunderbolt bridge and a heat path, neither of which is selected; the options and their evidence are in "Packaging the three device classes" below. No NVMe device envelope is modeled from an invented enclosure size.

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

The Samsung can retain its factory 2.5-inch case and mount directly in a rack tray. It still needs a suitable 5V USB-to-SATA bridge and validated retention. The existing carrier uses a provisional case envelope; physical fit has not been checked.

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

### Connectivity and power (nothing selected)

No NVMe bridge, SATA-to-USB bridge, powered hub, dock, or AC/DC supply has been chosen. Their dimensions, connector positions, cable bend radii, heat output and current draw are all unknown, so no connector, cable-path or power-adapter keepout is generated; these are explicit gaps in assembly collision coverage. The sections below record what each device class needs and what the manufacturers of candidate parts publish. Nothing in them is selected and nothing has been bought.

## Packaging the three device classes

For the planned USB4/Thunderbolt connection, each bare P310 needs a suitable NVMe bridge, cooling and PCB protection. A commercial enclosure supplies these together; a custom housing must be designed around specific bridge electronics and a real heatsink.

The Samsung already has its factory case. A tray can hold that case directly, with a USB-to-SATA bridge and connector strain relief added. A second commercial case is optional and would change the carrier's device envelope.

A 3.5-inch HDD needs both 5V and 12V at its SATA power connector. A USB data connection does not establish that those rails or sufficient spin-up power are available. Use a commercially rated powered bridge or enclosure with its specified external supply; no improvised power distribution is proposed.

### NVMe option 1, two commercial USB4 enclosures (unselected)

| Property | OWC Express 1M2, 40Gb/s original | Provenance |
|---|---|---|
| DIY enclosure SKU | `OWCUS4EXP1M2`, listed as "0TB DIY Enclosure" | vendor page |
| Length x Width x Height | 132.0 x 71.1 x 22.8 | `vendor-image` |
| Accepts | NVMe M.2 2230 / 2242 / 2280, single or double sided | manual |
| Heatsinked M.2 | "NVMe SSDs with a heatsink will not fit and are not supported" | manual |
| Interface and power | USB4 40Gb/s, bus powered, 0.3 m USB-C cable included | manual |
| Operating temperature | 5 to 35 C | manual |
| Mounting holes, weight, thermal rating | `unknown` | |

Sources: [OWC Express 1M2 product page](https://eshop.macsales.com/shop/owc-express-1m2), [OWC's dimensioned product image](https://media.owcnow.com/image/upload/owc-express-1m2-side-measurements), and [OWC's support manual](https://eshop.macsales.com/manuals/owc-express-1m2-support-manual). The dimensions are vendor artwork rather than a mechanical drawing, and no tolerance is published.

The manual's heatsink restriction is only one compatibility requirement. The 4TB P310's fit, power and thermal behavior still need confirmation. Two usage notes also affect the host connection:

> Select high power-draw NVMe SSDs may require more power than provided by the OWC Express 1M2.

> Does not mount if being connected as the third bus powered device with select Mac systems, including the Apple (M4) MacMini16,11 and Apple (M4 Max) Mac Studio.

Source for both: Support Manual for OWC Express 1M2, section 3.3 Usage Notes, <https://eshop.macsales.com/manuals/owc-express-1m2-support-manual>.

The second warning requires a compatibility and power check on the chosen Mac, bridges and connection topology. Those are all unresolved. A suitably powered hub or dock may be needed, but is not assumed to fix every device-mounting failure.

OWC also sells the Express 1M2 80G, DIY SKU `OWCUS4V2EXP1M2`, announced 19 August 2025 at <https://www.owc.com/blog/owc-express-1m2-80g-launch-usb4-v2-thunderbolt-5-diy-ssd>. It is a different USB4 80Gb/s product. Rounded catalog dimensions do not establish that it fits the original Rack Pro holder; that SKU would require its own dimensional and clearance checks.

The Rack Pro author supplies a 1U module for two Express 1M2 enclosures, with ventilation slots added in the 02/02/2025 update: <https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons#profileId-854246>. This predates the 80G announcement, making the original 40Gb/s enclosure the reuse candidate. The holder is present on plate 6 of the supplied `assets/rack-pro/rack-pro.3mf`; see the [source inventory](dimensions.md#original-source-inventory).

Two Express 1M2 enclosures side by side are 142.2 wide, exceeding the generic carrier's 140 mm interior. Their height also exceeds that carrier's current 1U floor/air allowances. The full-rack comparison instead reuses the original holder unchanged. Its measured bay accepts the published whole-box envelopes without positive-volume overlap: nominal clearance is 0.4 mm at each outer side, 0.4 mm in total depth and 0.4 mm below the nominal 1U ceiling. The boxes touch at the centerline and front stop. This is a geometric comparison, not a purchase, retention, connector-access, thermal or physical-fit validation.

### NVMe option 2, a printed housing around a selected commercial bridge (unselected)

The alternative is to buy a bridge board plus a heatsink and build the housing here. No PCB is designed in this repo and no bridge outline is invented, so this option cannot start until a specific purchasable bridge supplies its own published outline, connector positions, mounting-hole pattern and thermal requirement.

A custom housing makes PCB mounting, connector support, shielding and heat transfer part of this design's validation work. Preserve commercial shielding and heatsinks wherever possible; printed plastic does not replace them. The resulting width and U count depend on the selected electronics and cooling hardware. No size reduction or 1U fit can be claimed before those are known.

### SATA option 1, keep the factory case and add a bridge (unselected)

This option retains the Samsung case and adds a 5V USB-to-SATA bridge. The following discontinued product documents the type of specification needed from a currently purchasable replacement; it is not a purchase recommendation:

| Property | Plugable USBC-SATA24 | Provenance |
|---|---|---|
| Body size | 40 x 30 x 10 (1.6 x 1.2 x 0.4 in) | vendor page |
| Weight | 20 g | vendor page |
| Captive cable | 0.24 m USB-C to SATA | vendor page |
| Bridge IC | ASMedia ASM1351 | vendor page |
| Protocols | UASP and BOT, LBA48, 512e and 4K sectors | vendor page |
| Capacity statement | "Large capacity drives are supported, 8+TB with 512e and 4K bytes per sector" | vendor page |
| Power | 5V bus powered, no adapter; explicitly does not supply 12V | vendor page |
| Status | marked discontinued on the vendor page | vendor page |

Source: <https://plugable.com/products/usbc-sata24>.

Require documented support for the chosen 8TB drive and sector format, adequate power, and compatibility with the selected Mac. A vendor statement that only smaller drives were tested is insufficient evidence for this build. SMART passthrough and TRIM behavior also depend on the bridge and operating system.

### SATA option 2, a commercial 2.5-inch enclosure (unselected)

A commercial 2.5-inch USB enclosure combines the bridge and drive mounting. Its complete envelope, connector position and cooling requirements would replace the bare-drive reference in the carrier design. No specific enclosure is selected.

### HDD option 1, a powered commercial enclosure (unselected)

| Property | OWC Mercury Elite Pro, USB 3.2 5Gb/s | Provenance |
|---|---|---|
| Bay | one 3.5-inch SATA 6Gb/s drive, screwed to an inner chassis | manual |
| Supply | external adapter, AC in 100-240V 50/60Hz 0.9A, DC out 12V/3A | manual |
| Host port | USB 3.2 Gen 1 Type-B, 5Gb/s | manual |
| Operating temperature | 5 to 35 C | manual |
| Enclosure dimensions | `unknown` from OWC | |

Source: Support Manual for OWC Mercury Elite Pro USB 3.2 (5Gb/s), <https://eshop.macsales.com/manuals/mercury-elite-pro-assembly-manual-user-guide>, and <https://eshop.macsales.com/tech_center/manuals/mercury-elite-pro-usb-5g-manual.pdf>. Manufacturer dimensions were not obtained, so no enclosure envelope is modeled. The manual says not to block ventilation openings or place objects on top; any rack mount must preserve those conditions. Drive-capacity compatibility also needs confirmation for the selected 12TB model.

The manual lists an included USB Type-B to Type-A cable. The 2024 reference Mac mini has no USB-A ports, so this option also needs a compatible USB-C to USB 3 Type-B data cable, or a suitable USB-A-to-USB-C data adapter. Account for that connector and cable when measuring the rear clearance.

### HDD option 2, bare drive in the printed carrier plus a powered bridge (unselected)

The existing HDD tray is a provisional mechanical carrier. A selected commercial powered bridge must supply both SATA power rails, support the chosen 12TB drive and provide retained connectors. Its specified external supply must cover drive spin-up as well as bridge consumption. The bridge and supply envelopes are currently unknown, so 2U remains a candidate allocation rather than a complete packaged design.

## Shielding, heat, cables, bus power, and the Mac's ports

Keep factory cases, shielding and heatsinks intact unless a replacement has been validated. Leave enclosure fins and vents exposed; straps and printed walls must not obstruct the intended heat path. A commercial enclosure still needs thermal testing in the proposed rack under sustained transfers.

Connector overhang and cable bends are unmodeled. The Express 1M2 includes a 0.3 m USB-C cable, but its installed bend radius and rear clearance have not been measured. The rack still needs connector strain relief and a cable route based on the actual supplied cables.

Each USB-powered enclosure and bridge contributes to the host's power budget. The P310 4TB's power figures were not established from the available sources. A powered USB4/Thunderbolt hub or dock would add its own supply, envelope and bandwidth constraints; a generic powered USB hub does not necessarily preserve a USB4 connection.

For the 2024 reference Mac, Apple lists three rear Thunderbolt 4 ports on M4 or Thunderbolt 5 ports on M4 Pro, plus two front USB-C ports supporting USB 3 at 10Gb/s: <https://support.apple.com/en-us/121555>. Two NVMe bridges and two SATA bridges require four storage connections, so they cannot all connect directly to three rear ports. A front port may serve a SATA bridge; the actual Mac generation, power compatibility and cable-access requirements must be settled before fixing the topology.

## Selections required before device-specific fit

1. Mac generation and its actual port inventory.
2. NVMe path: two commercial USB4 enclosures, or a printed housing around a specific purchased bridge and heatsink. If enclosures, which SKU, since `OWCUS4EXP1M2` and `OWCUS4V2EXP1M2` are different products.
3. SATA bridge, with vendor documentation of support at 8TB, and a decision on whether the factory-cased drive stays in the printed carrier.
4. HDD model and packaging: a powered enclosure, or a tray with a commercial bridge supplying both 5V and 12V and its specified external supply rated for spin-up.
5. Topology: direct to the Mac, or through a powered hub or dock, followed by a compatibility and power check on the real hardware.
6. Cable lengths, exit directions and strain relief, before any rear clearance is claimed.

## Fasteners and rack interface hardware

The Rack Pro author states that modules are secured with an M3 flat-head cap screw through the vertical rail into a heat-set insert in the side of the module's rail slide, and that he uses 4 mm long M3 inserts with M3x8 FHCS. Source: the model description linked above.

The local 2U and 3U templates carry a Ø3.8 mm blind pocket 4.2 mm deep in each slide. The 1U template has no such pocket. A particular insert's outside diameter and taper must be checked against the pocket; length alone cannot prove fit. The original rails are now assembled from source meshes, but the detailed screw/head envelope, alignment, penetration and insert installation have not been validated. No final fastener length or insert specification is established here.

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
6. NVMe bridge or enclosure. Not selected. The OWC comparison uses a published whole-enclosure envelope, but the chosen packaging, connector/plug geometry, cable routing and operating heat remain unresolved.
7. SATA-to-USB bridge. Not selected. The candidate recorded there is marked discontinued by its own vendor, and any replacement has to document support at 8TB itself.
8. Host compatibility and power check. OWC publishes a bus-powered-device limit on select Macs; whether it applies here depends on the Mac bought, the bridges bought and the topology used, and nobody has tested it.
9. 12TB HDD make and model. Not purchased. Weight, screw positions, power, acoustics and vibration behaviour all change with the choice.
10. Power. No supply, hub, or dock chosen; total current and connector count are unknown. The HDD bridge must supply both SATA power rails, and its specified external supply must cover the chosen drive's spin-up current.
11. Mac port budget. Port count and port classes follow from a Mac that has not been bought, and four storage devices against three rear Thunderbolt ports is unresolved on the 2024 reference machine.
12. Thermal behaviour. No airflow measurement, no CFD, no temperature test. Printed material choice for loaded brackets is open; PETG and ASA are candidates pending a service-temperature check.
13. Rails and frame. Original geometry is now measured and assembled from the local 3MF; physical fit, stack rigidity and fastening remain unvalidated.
14. Mass and load path. The HDD's base-supported skid path is modeled, but selected device/adapter masses, load sharing and safe payload have not been established or tested.
15. Vibration isolation for a spinning drive. Not designed, not measured.
16. Fastener schedule. Insert type and screw length require detailed alignment/head/penetration checks and printed coupon testing, not just the author's example hardware.

## Licensing and publication

The Rack Pro download is covered by MakerWorld's Standard Digital File License, which forbids sharing, sub-licensing, selling, renting, hosting, transferring, or distributing the digital or printed object or any derivative, including remixes and hosting elsewhere, and forbids any use for money. Source: the license block on <https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons>.

The STEP templates and original `assets/rack-pro/rack-pro.3mf` are that licensed geometry. They stay private, as do exports derived from them. The initial repository already tracked the templates; ignore rules do not remove them from its history. Nothing from this project is published, pushed, posted or redistributed. Link to the author's model page instead.
