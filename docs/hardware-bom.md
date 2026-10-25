# Hardware BOM and sourcing evidence

Private project notes for the Mac mini Rack Pro build. Every row below is either a manufacturer-published figure with a link, a value measured from the local STEP templates, or an explicitly provisional screening value. Nothing here is a fit proof: no part of this project has been printed, test-fitted, or assembled, and several devices have not been bought.

All lengths are millimetres. Inch conversions use 25.4 mm/in.

## Provenance labels

| Label | Meaning |
| --- | --- |
| `datasheet` | Published by the manufacturer in a datasheet, product manual, or tech-spec page that is linked here. |
| `vendor-image` | Published by the vendor, but only as a dimensioned marketing image, not a drawing. |
| manual | Stated in the manufacturer's own support manual or assembly guide that is linked here. |
| vendor page | Stated in the manufacturer's own product or support page, but not as a dimensioned figure. |
| `measured-local` | Measured by this repo from `assets/rack-pro/*.step` with build123d and reproduced with caddy. See `docs/dimensions.md`. |
| `provisional` | A user-configurable screening number chosen so the model can be exercised. Not a product spec. |
| `unknown` | Not published, not measured, not decided. Stays unknown until someone supplies it. |

## Devices

### Apple Silicon Mac mini (1, not purchased)

| Property              | Value                                      | Provenance  |
| --------------------- | ------------------------------------------ | ----------- |
| Width                 | 127.0                                      | `datasheet` |
| Depth                 | 127.0                                      | `datasheet` |
| Height                | 50.0                                       | `datasheet` |
| Weight                | 0.67 kg (M6, M4), 0.73 kg (M5 Pro, M4 Pro) | `datasheet` |
| Max continuous power  | 155 W                                      | `datasheet` |
| Operating temperature | 10 to 35 C                                 | `datasheet` |

Sources: Apple, Mac mini (M6 or M5 Pro) Tech Specs, <https://support.apple.com/en-us/128108>, and Mac mini (2024) Tech Specs, <https://support.apple.com/en-us/121555>.

The owner has not bought a Mac mini. Apple's current model, introduced in 2026, offers an M6 with three rear Thunderbolt 4 ports or an M5 Pro with three rear Thunderbolt 5 ports. It keeps the 2024 M4/M4 Pro body, weights, power and temperature figures, and both generations have two front USB-C ports at USB 3 10Gb/s. The 2024 body remains the reference for the original Rack Pro cradle; a later body change would invalidate the Mac keepout. Apple publishes no port-position dimensions, no foot pattern, no vent geometry and no per-port power figure, so port cutouts, intake clearance and the bus-power budget cannot be derived from the spec pages. The Rack Pro author recommends 1U of empty space under the Mac for intake and exhaust.

The owner intends to buy a Mac mini with M5 Pro (18-core CPU, 20-core GPU), 64GB unified memory, 1TB storage and 10Gb Ethernet, shown at $3,299 on 2026-10-25, and to run it as the only server. It must therefore host all of the storage below.

### Crucial P310 4TB NVMe SSD, CT4000P310SSD8 (2, owner-held)

| Property | Value | Provenance |
| --- | --- | --- |
| Form factor | M.2 2280, no heatsink | `datasheet` |
| Length | 80.0 (3.15 in) | `datasheet` |
| Width | 22.0 (0.86 in) | `datasheet` |
| Thickness | 2.3 (0.09 in), one figure for the whole 2280 family | `datasheet` |
| Sequential read / write, 4TB | 7,100 / 6,000 MB/s, PCIe 4.0 x4 | `datasheet` |
| Thickness and sidedness at 4TB | `unknown` |  |
| Weight at 4TB | `unknown` |  |
| Power | not published by Crucial at any capacity | `unknown` |

Sources: Crucial P310 2280 PCIe 4.0 NVMe M.2 SSD datasheet (Micron, 2024), <https://www.simms.co.uk/PDFS/Products/SSD/Crucial-P310-M.2-2280-datasheet.pdf>, which tabulates 500GB, 1TB and 2TB only; a newer flyer revision with 4TB rows, mirrored at <https://www.battlebetter.in/assets/pdf/crucial-P310-2280-b2c-product-flyer-combination-en-compressed.pdf>; and the Crucial P310 4TB product page, <https://www.crucial.com/ssd/p310/ct4000p310ssd8>. The newer flyer misprints the 4TB part number as `CT2000P310SSD8`; the product page gives `CT4000P310SSD8`. Both flyer revisions give one no-heatsink dimension column for the family, so the 4TB thickness, sidedness and weight are still not broken out.

The owner describes these drives as bare boards. Both OWC Express 1M2 generations, linked below, require an SSD without an attached heatsink and accept single- or double-sided drives, so the unconfirmed sidedness does not block that route. Neither establishes the 4TB P310's power demand or thermal behavior.

TechPowerUp measures the 2TB 2280 at 0.80 W idle, 3.5 W average and 5.1 W maximum, and lists both QLC and TLC builds of that capacity (<https://www.techpowerup.com/ssd-specs/crucial-p310-2-tb.d2945>, third-party). It has no 4TB entry. Those figures must not be transferred to the 4TB drive, and the owner's two drives may not be identical builds. The packaging options are in "Packaging the three device classes" below. No NVMe device envelope is modeled from an invented enclosure size.

### Samsung 870 8TB 2.5-inch SATA SSD (1, owner-held)

| Property | Value | Provenance |
| --- | --- | --- |
| Length | 100.0 | `datasheet` |
| Width | 69.85 | `datasheet` |
| Height | 6.8 | `datasheet` |
| Worst-case with tolerance | 100.45 x 70.10 x 7.00 | `datasheet` |
| Weight | 57 g | retailer listing, not Samsung |
| Power, 8TB | 2.4 W read / 3.3 W write average, 45 mW idle; no peak or inrush figure | `datasheet` |
| Mounting holes | `unknown` from the datasheet; the 2.5-inch standard is SFF-8201 M3 |  |

Sources: Samsung SSD 870 QVO Data Sheet Rev 1.1, June 2020, <https://download.semiconductor.samsung.com/resources/data-sheet/Samsung_SSD_870_QVO_Data_Sheet_Rev1.1_10129514052310.pdf> (technical specifications table: "Dimension 100 x 69.85 x 6.8 (mm)", form factor 2.5 inch, capacities 1/2/4/8TB, 8TB model `MZ-77Q8T0` with codes `MZ-77Q8T0BW`, `MZ-77Q8T0B/AM`, `MZ-77Q8T0B/CN`). Per-axis tolerances come from the 870 QVO product flyer, width 100.20 +/-0.25, depth 69.85 +/-0.25, height 6.80 +/-0.20, mirrored at <https://www.netram.fr/out/media/MZ-77Q1T0BW-Samsung-Q870-1To.pdf>.

The owner's drive is described only as "Samsung 870 8TB". Samsung shipped 8TB in the 870 QVO line and the 870 EVO topped out below that, which makes QVO the likely identification, but likely is not confirmed. The exact label on the owner's drive is still required: read the model code off the drive, do not infer it from capacity. All 870 QVO capacities share the same 2.5-inch 7 mm body, so the envelope is unlikely to move even if the submodel differs; the submodel still has to be recorded before anything is called confirmed.

Samsung does not publish the mounting-hole pattern in this datasheet. The repo must not guess hole positions. Retention is handled by straps and printed pads instead, which is why the SATA carrier carries no drilled drive-mounting features.

The Samsung can retain its factory 2.5-inch case and mount directly in a rack tray. It still needs a suitable 5V USB-to-SATA bridge and validated retention. The existing carrier uses a provisional case envelope; physical fit has not been checked.

### 12TB 3.5-inch SATA HDD (1, not purchased, model unknown)

No 12TB drive has been chosen or bought. To let the stack be screened at all, the model uses a conservative 3.5-inch envelope taken from a drive that is explicitly NOT the selected part.

Reference part: Seagate IronWolf Pro `ST12000NT001`.

| Property | Value | Provenance |
| --- | --- | --- |
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

### Connectivity and power (nothing bought)

No NVMe enclosure, SATA-to-USB bridge, powered hub, dock, or AC/DC supply has been bought. The owner intends to use OWC Express 1M2 enclosures for the NVMe drives; their generation and every other connectivity part remain unselected. Bridge dimensions, connector positions, cable bend radii, heat output and current draw are not modeled, so no connector, cable-path or power-adapter keepout is generated; these are explicit gaps in assembly collision coverage. The sections below record what each device class needs and what the manufacturers of candidate parts publish.

## Packaging the three device classes

For the planned USB4/Thunderbolt connection, each bare P310 needs a suitable NVMe bridge, cooling and PCB protection. A commercial enclosure supplies these together; a custom housing must be designed around specific bridge electronics and a real heatsink.

The Samsung already has its factory case. A tray can hold that case directly, with a USB-to-SATA bridge and connector strain relief added. A second commercial case is optional and would change the carrier's device envelope.

A 3.5-inch HDD needs both 5V and 12V at its SATA power connector. A USB data connection does not establish that those rails or sufficient spin-up power are available. Use a commercially rated powered bridge or enclosure with its specified external supply; no improvised power distribution is proposed.

### NVMe option 1, two OWC Express 1M2 enclosures (owner's intended route, not purchased)

The owner intends to buy OWC Express 1M2 enclosures. Both generations hold one M.2 drive, so the two P310s need two enclosures. The generation is still open and follows from the Mac's Thunderbolt version.

| Property | Express 1M2, 40G original | Express 1M2 80G | Provenance |
| --- | --- | --- | --- |
| DIY enclosure SKU | `OWCUS4EXP1M2` | `OWCUS4V2EXP1M2` | vendor page |
| Price read 2026-10-25 | $88.99 | $169.99, launched at $219 | vendor page |
| Bridge controller | ASMedia ASM2464PD | Intel JHL9480 (Barlow Ridge) | vendor page |
| Accepts | M.2 2230 / 2242 / 2280, single or double sided | M.2 2242 / 2280, single or double sided | manual |
| Heatsinked M.2 | "NVMe SSDs with a heatsink will not fit and are not supported" | same wording | manual |
| Host link | USB4 40Gb/s | USB4 80Gb/s | vendor page |
| OWC speed, Thunderbolt 4 / USB4 40Gb/s Mac | 3189MB/s on Apple silicon | up to 3800MB/s | vendor page |
| OWC speed, Thunderbolt 5 Mac | capped by its 40Gb/s link | over 6000MB/s; up to 6800 MB/s with a PCIe 4.0 drive | vendor page, manual |
| Catalog length x width x height | 13.2 x 7.0 x 2.3 cm | 13.3 x 7.2 x 2.4 cm | vendor page |
| Dimensioned artwork | 132.0 x 71.1 x 22.8 | none published | `vendor-image` |
| Weight | 253.0 g | 280.8 g | vendor page |
| Power | bus powered, no adapter input | bus powered, no adapter input | vendor page |
| Cable | 0.3 m USB-C | 0.3 m USB-C | manual |
| Operating temperature | 5 to 35 C | 5 to 35 C | manual |
| Mounting holes, thermal rating | `unknown` | `unknown` |  |

Sources, 40G: [product page](https://eshop.macsales.com/shop/owc-express-1m2), [item page](https://eshop.macsales.com/item/OWC/US4EXP1M2/), [dimensioned image](https://media.owcnow.com/image/upload/owc-express-1m2-side-measurements), [support manual](https://eshop.macsales.com/manuals/owc-express-1m2-support-manual). Sources, 80G: [product page](https://eshop.macsales.com/shop/owc-express-1m2-80g), [item page](https://eshop.macsales.com/item/OWC/US4V2EXP1M2/), [solutions page](https://www.owc.com/solutions/express-1m2-80g), [support manual](https://eshop.macsales.com/manuals/owc-express-1m2-80gbs-support-manual), [launch announcement](https://www.owc.com/blog/owc-express-1m2-80g-launch-usb4-v2-thunderbolt-5-diy-ssd). Prices are discounted store prices on the date shown and will drift. The dimensions are catalog figures or vendor artwork, not mechanical drawings, and no tolerance is published.

On a Thunderbolt 4 Mac both enclosures are limited by the 40Gb/s link, so the 80G adds little for about twice the price. On a Thunderbolt 5 Mac only the 80G uses most of the P310's 7,100 / 6,000 MB/s rating. Apple's Thunderbolt 5 port lists USB4 at up to 40Gb/s; OWC's 6000MB/s figure was measured on a Thunderbolt 5 Mac Studio, but no measurement on a Mac mini was found.

On Apple silicon the Express 1M2 runs in USB4 mode, where macOS sees a native NVMe drive with both TRIM and SMART available. Howard Oakley tested this with the 40G (<https://eclecticlight.co/2024/04/09/which-external-drives-have-trim-and-smart-support/>, third-party). The macOS limits listed under SATA option 1 do not apply to this route.

Two 40G usage notes affect the host connection:

> Select high power-draw NVMe SSDs may require more power than provided by the OWC Express 1M2.

> Does not mount if being connected as the third bus powered device with select Mac systems, including the Apple (M4) MacMini16,11 and Apple (M4 Max) Mac Studio.

Source for both: Support Manual for OWC Express 1M2, section 3.3 Usage Notes, <https://eshop.macsales.com/manuals/owc-express-1m2-support-manual>.

The 80G manual's usage notes contain neither warning. That is an absence of a warning, not a statement that the limitation was removed. The 80G manual instead names Western Digital SN5xx 2280 drives as incompatible.

`MacMini16,11` is not an Apple identifier. Apple lists the 2024 Mac mini as `Mac16,10` and `Mac16,11` without splitting them by chip (<https://support.apple.com/en-us/102852>), and EveryMac maps `Mac16,11` to the M4 Pro (third-party, <https://everymac.com/ultimate-mac-lookup/?identify=Mac16%2C11>). OWC's "(M4) MacMini16,11" therefore fits either 2024 model, and the 2026 models are not mentioned. OWC gives no cause and no workaround. Two enclosures plus a bus-powered SATA bridge make three bus-powered devices, so the chosen Mac and topology need a real test. A suitably powered hub or dock may be needed, but is not assumed to fix every device-mounting failure.

The Rack Pro author supplies a 1U module for two Express 1M2 enclosures, with ventilation slots added in the 02/02/2025 update: <https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons#profileId-854246>. It predates the 80G. The holder is present on plate 6 of the supplied `assets/rack-pro/rack-pro.3mf`; see the [source inventory](dimensions.md#original-source-inventory).

Two Express 1M2 enclosures side by side are 142.2 wide, exceeding the generic carrier's 140 mm interior. Their height also exceeds that carrier's current 1U floor/air allowances. The full-rack comparison instead reuses the original holder unchanged. Its measured bay accepts the published whole-box envelopes without positive-volume overlap: nominal clearance is 0.4 mm at each outer side, 0.4 mm in total depth and 0.4 mm below the nominal 1U ceiling. The boxes touch at the centerline and front stop. This is a geometric comparison, not a purchase, retention, connector-access, thermal or physical-fit validation.

On OWC's catalog figures, two 80G boxes would exceed that measured bay by about 1.0 mm in width, 0.6 mm in depth and 0.8 mm in height. The catalog rounds to 0.1 cm and lists both generations as 5.2 x 2.8 x 0.9 in, so the true excess is uncertain, but no reading of the published numbers places the 80G inside the 40G envelope. Treat the original holder as 40G-only until a real 80G is measured.

OWC's four-bay Express 4M2 is not a substitute. Each bay runs at PCIe 4.0 x1 with single-drive performance up to 1600MB/s, and the unit needs an external 12V supply, uses fans, and measures 17.8 x 6.0 x 13.9 cm at 1.8 kg (<https://eshop.macsales.com/shop/owc-express-4m2>, vendor page). It would also put both NVMe vdevs behind one bridge, cable and supply.

### NVMe option 2, a printed housing around a selected commercial bridge (unselected)

The alternative is to buy a bridge board plus a heatsink and build the housing here. No PCB is designed in this repo and no bridge outline is invented, so this option cannot start until a specific purchasable bridge supplies its own published outline, connector positions, mounting-hole pattern and thermal requirement.

A custom housing makes PCB mounting, connector support, shielding and heat transfer part of this design's validation work. Preserve commercial shielding and heatsinks wherever possible; printed plastic does not replace them. The resulting width and U count depend on the selected electronics and cooling hardware. No size reduction or 1U fit can be claimed before those are known.

### SATA option 1, keep the factory case and add a cable bridge (preferred form, unselected)

The Samsung's factory case already encloses the drive. It needs a USB-to-SATA bridge, not a second case. A cable-style bridge keeps the tray's existing device envelope, and it is the only form surveyed with any external-power option.

Requirements, in order of consequence:

1. **512-byte logical sectors.** The drive already holds GPT partitions addressed in 512-byte blocks. The host learns the block size from the bridge, not the drive. A bridge that presents 4096-byte logical blocks moves every partition boundary, so the partitions cannot be read through it. Some bridges do this only for drives above 2TB, a workaround for 32-bit Windows XP (Macrium, <https://kbx.macrium.com/macrium-reflect-x/incompatible-disk-selected>; Gough Lui's bridge tests, <https://goughlui.com/2013/10/02/experiment-usb-to-sata-bridge-chips-and-2tb-drives/>; both third-party). Plugable documents the same chip shipping with either behavior depending on firmware (<https://kb.plugable.com/data-storage/understanding-large-sata-drive-compatibility>, vendor page). No surveyed vendor publishes this property, so it must be checked on the purchased unit with a blank scratch drive larger than 2TB that has 512-byte logical sectors (512n or 512e, not 4Kn). macOS should report a 512-byte device block size for it. Never run this check with the Samsung.
2. **Documented 8TB support**, not a tested-up-to statement for smaller drives.
3. **USB-C host plug, USB 3.2 Gen 2 10Gb/s, UASP.**
4. **Fit behind the drive.** The SATA carrier ends at assembly Y=33, the rear rails at Y=71.9 and the base at Y=87.5, which leaves about 40 mm behind the drive's connector inside the rails. A bridge body hanging from the SATA connector needs its own support.

Both remaining candidates use the ASMedia ASM235CM bridge and come from the same vendor:

| Property | StarTech `USB31CSAT3CB` | StarTech `USB31C2SAT3` | Provenance |
| --- | --- | --- | --- |
| Price and stock, 2026-10-25 | $30.74, in stock | $68.66, back-ordered | vendor page |
| Bridge IC | ASMedia ASM235CM | ASMedia ASM235CM | `datasheet` |
| Host link | USB 3.2 Gen 2 10Gb/s, USB-C plug, UASP | USB 3.2 Gen 2 10Gb/s, USB-C plug, UASP | `datasheet` |
| Capacity statement | "Currently tested with hard drives up to 2TB at 7200 RPM" | "Currently tested with hard drives up to 10TB" | `datasheet` |
| Drives | 2.5-inch only | 2.5-inch and 3.5-inch | `datasheet` |
| Power | bus powered; connector row "USB-C (5Gbps, 4.5W)" | bus powered for 2.5-inch drives; 12V 2A adapter included for 3.5-inch drives "or for any 2.5 in. drives that may require additional power" | `datasheet` |
| Size | flat cable 43.0 wide x 5.0 thick, 508 long overall, 29.2 g | adapter body 87 x 25 x 20 with 1 m cable, 60 g | `datasheet` |
| Operating temperature | 0 to 70 C | 0 to 60 C | `datasheet` |

Sources: <https://www.startech.com/en-us/hdd/usb31csat3cb>, <https://media.startech.com/cms/pdfs/usb31csat3cb_datasheet.pdf>, <https://www.startech.com/en-us/hdd/usb31c2sat3>, <https://media.startech.com/cms/pdfs/usb31c2sat3_datasheet.pdf>.

`USB31C2SAT3` is the only current cable whose vendor states testing beyond 8TB. Its 3.5-inch support also allows the sector-size check on a blank HDD larger than 2TB before the Samsung is connected. StarTech does not state that the bridge stops drawing bus power for a 2.5-inch drive when its adapter is connected, so the supply is not a proven fix for the third-bus-powered-device note. Its adapter body and power brick need a place in the rack, and the body's orientation relative to the SATA plug is not published. `USB31CSAT3CB` is cheaper, in stock and much thinner, but its capacity statement stops at 2TB and it has no external power option.

Rejected on 2026-10-25:

- Plugable `USBC-SATA24` and `USBC-SATA-V`: both marked discontinued (<https://plugable.com/products/usbc-sata24>, <https://plugable.com/products/usbc-sata-v>).
- Eaton Tripp Lite `U438-06N-G2-W`: vendor capacity statement 4TB, chipset unpublished (<https://www.eaton.com/us/en-us/skuPage.U438-06N-G2-W.html>).
- Cable Matters `202042`: its manual names an ASM105x bridge at 5Gb/s and drives up to 2TB, contradicting its web page (<https://www.cablematters.com/pc-695-125-usb-c-to-sata-adapter-10-inches.aspx>).
- Sabrent `USB-DS12`: SATA link limited to 3Gb/s, no capacity or UASP statement (<https://sabrent.com/products/usb-ds12>).
- StarTech `USB31CSAT3M2E`: open-frame dock with an exposed M.2 slot and no capacity statement (<https://www.startech.com/en-us/hdd/usb31csat3m2e>).
- NewerTech Universal Drive Adapter: USB-A host plug and a 4TB limit (<https://eshop.macsales.com/shop/newertech-universal-drive-adapter>).

macOS limits that apply to every USB-attached SATA bridge:

- **No TRIM.** `trimforce` covers AHCI-attached drives only (`man 8 trimforce`), Apple's USB mass-storage and SCSI stacks have no UNMAP path (<https://github.com/apple-oss-distributions/IOUSBMassStorageClass>, <https://github.com/apple-oss-distributions/IOSCSIArchitectureModelFamily>), and OpenZFS on macOS enables TRIM only when the device advertises `DK_FEATURE_UNMAP` (<https://raw.githubusercontent.com/openzfsonosx/openzfs-fork/development/module/os/macos/zfs/vdev_disk.c>). `zpool trim` therefore fails on such a vdev and `autotrim` skips it. A bridge that advertises TRIM does not change this. Samsung rates the 8TB 870 QVO at 160 MB/s sustained sequential write after its TurboWrite cache, and untrimmed copy-on-write use pushes the drive toward that state.
- **No native S.M.A.R.T. over USB 3.** macOS reads SMART over Thunderbolt and USB4 but not USB 3.x (<https://eclecticlight.co/2024/04/09/which-external-drives-have-trim-and-smart-support/>, third-party), and smartmontools states that macOS lacks the SCSI pass-through needed for USB drives (<https://www.smartmontools.org/wiki/USB>). The workaround is a third-party kernel extension, which requires lowering the Mac's security policy. A Thunderbolt SATA enclosure such as OWC's ThunderBay 4 gives limited SMART access but still no TRIM (<https://eclecticlight.co/2023/04/14/will-your-new-ssd-support-trim-and-smart/>, third-party).
- **Link speed and sleep.** Plugable found that its ASM1351 bridges link at 5Gb/s on Apple silicon (<https://kb.plugable.com/usb-drive-docks/usb-31-gen-2-to-sata-adapters-limited-to-5gbps-on-apple-m-series-macs->); ASM235CM behavior on Apple silicon is unknown. Unexpected disconnects after sleep are a recurring third-party report for USB storage on Apple silicon (<https://discussions.apple.com/thread/254322044>). For an unredundant pool member that is a data-integrity risk.

### SATA option 2, a commercial 2.5-inch enclosure (unselected)

An enclosure would replace the bare-drive envelope in the carrier design and adds no protection the factory case lacks. None of the surveyed enclosures has an auxiliary power input, and none documents 8TB support:

| Enclosure | Bridge | Host receptacle | Size, weight | Capacity statement | Status 2026-10-25 |
| --- | --- | --- | --- | --- | --- |
| StarTech `S251BU31315` | ASM235CM | Micro-B, 10Gb/s | 120 x 75 x 21.5, 105 g | tested to 2TB | $51.24, reseller only |
| StarTech `S251BMU313` | "Realtek RTS9201", not a part Realtek lists | Micro-B, 10Gb/s claimed | 123 x 75 x 12, 78 g | tested to 2TB | $46.11, reseller only |
| ICY BOX `IB-247-C31` | VIA Labs VL716 | USB-C, 10Gb/s | 132 x 75 x 14, 119 g | "capacity unlimited" | sold out, no US source |
| ORICO `DD25-C3` | unpublished | USB-C | 130 x 80 x 17 | 6TB | in stock; sleeps after 10 minutes |
| OWC Express `ES2.5CU3B` | unpublished | Micro-B, 5Gb/s | unpublished | unpublished | $18.88, in stock |

Sources, all vendor pages: <https://www.startech.com/en-us/hdd/s251bu31315>, <https://www.startech.com/en-us/hdd/s251bmu313>, <https://icybox.de/en/products/ib-247-c31>, <https://oricotechs.com/products/orico-2-5-inch-type-c-6gbps-aluminum-sata-hdd-ssd-enclosure>, <https://eshop.macsales.com/shop/owc-express/usb-3.1>.

VIA Labs is the bridge family in which 4096-byte presentation of a 512e drive was demonstrated, on an older generation (Gough Lui, above). A Micro-B receptacle is a weaker connector to leave under cable load in a rack.

### HDD option 1, a powered commercial enclosure (unselected)

| Property | OWC Mercury Elite Pro, USB 3.2 5Gb/s | Provenance |
| --- | --- | --- |
| Bay | one 3.5-inch SATA 6Gb/s drive, screwed to an inner chassis | manual |
| Supply | external adapter, AC in 100-240V 50/60Hz 0.9A, DC out 12V/3A | manual |
| Host port | USB 3.2 Gen 1 Type-B, 5Gb/s | manual |
| Operating temperature | 5 to 35 C | manual |
| Enclosure dimensions | `unknown` from OWC |  |

Source: Support Manual for OWC Mercury Elite Pro USB 3.2 (5Gb/s), <https://eshop.macsales.com/manuals/mercury-elite-pro-assembly-manual-user-guide>, and <https://eshop.macsales.com/tech_center/manuals/mercury-elite-pro-usb-5g-manual.pdf>. Manufacturer dimensions were not obtained, so no enclosure envelope is modeled. The manual says not to block ventilation openings or place objects on top; any rack mount must preserve those conditions. Drive-capacity compatibility also needs confirmation for the selected 12TB model.

The manual lists an included USB Type-B to Type-A cable. Neither the 2024 nor the 2026 Mac mini has USB-A ports, so this option also needs a compatible USB-C to USB 3 Type-B data cable, or a suitable USB-A-to-USB-C data adapter. Account for that connector and cable when measuring the rear clearance.

### HDD option 2, bare drive in the printed carrier plus a powered bridge (unselected)

The existing HDD tray is a provisional mechanical carrier. A selected commercial powered bridge must supply both SATA power rails, support the chosen 12TB drive and provide retained connectors. Its specified external supply must cover drive spin-up as well as bridge consumption. The bridge and supply envelopes are currently unknown, so 2U remains a candidate allocation rather than a complete packaged design.

## Shielding, heat, cables, bus power, and the Mac's ports

Keep factory cases, shielding and heatsinks intact unless a replacement has been validated. Leave enclosure fins and vents exposed; straps and printed walls must not obstruct the intended heat path. A commercial enclosure still needs thermal testing in the proposed rack under sustained transfers.

Connector overhang and cable bends are unmodeled. The Express 1M2 includes a 0.3 m USB-C cable, but its installed bend radius and rear clearance have not been measured. The rack still needs connector strain relief and a cable route based on the actual supplied cables.

Each USB-powered enclosure and bridge contributes to the host's power budget. Crucial publishes no P310 power figure, and Apple publishes no per-port power figure for either Mac mini generation. A powered USB4/Thunderbolt hub or dock would add its own supply, envelope and bandwidth constraints; a generic powered USB hub does not necessarily preserve a USB4 connection.

Apple lists three rear Thunderbolt ports (Thunderbolt 4 on M6 and M4, Thunderbolt 5 on M5 Pro and M4 Pro) and two front USB-C ports supporting USB 3 at 10Gb/s on both the 2026 and 2024 Mac mini: <https://support.apple.com/en-us/128108>, <https://support.apple.com/en-us/121555>. Two NVMe enclosures, the SATA bridge and the HDD bridge make four storage connections, so they cannot all connect directly to three rear ports. A front port may serve the SATA bridge or the HDD; the actual Mac generation, power compatibility and cable-access requirements must be settled before fixing the topology.

## Selections required before device-specific fit

1. Mac generation. The owner intends the M5 Pro, with three rear Thunderbolt 5 ports, as the only server; not purchased.
2. NVMe enclosure generation. The owner intends two Express 1M2s. On the intended Thunderbolt 5 Mac, `OWCUS4V2EXP1M2` (80G) roughly doubles throughput but needs a redrawn 1U holder; `OWCUS4EXP1M2` (40G) fits the original holder.
3. SATA bridge. The cable form is preferred: `USB31C2SAT3` documents testing beyond 8TB; `USB31CSAT3CB` is thinner and in stock. The purchased unit must pass the 512-byte sector check on a scratch drive before the Samsung is connected.
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

OpenZFS on macOS is a kernel extension. On Apple silicon, loading it requires booting into Recovery and setting the startup disk to Reduced Security with user-managed kernel extensions allowed (<https://support.apple.com/guide/security/securely-extending-the-kernel-sec8e454101b/web>; <https://openzfsonosx.org/forum/viewtopic.php?t=3911>). Keeping `biggie` on the Mac therefore lowers the security policy of the machine agents run on. The alternative is a migration to APFS, which cannot span the three drives without a concatenated set that keeps the current all-or-nothing failure mode; separate per-drive volumes would need the data to divide into groups that fit 7.27, 3.64 and 3.64 TiB.

This project is mechanical CAD. It does not read, mount, write, repartition, reformat, detach, or otherwise touch any of the owner's disks, and no step in this repo should ever require doing so. Migration is a separate job that starts with a verified external backup.

## Unresolved items

These block any claim of fit, thermal adequacy, or hardware specification:

1. Mac mini. Not purchased; the owner intends an M5 Pro. The 2026 M6/M5 Pro keeps the 2024 127 x 127 x 50 body; a later body change would invalidate the keepout.
2. Crucial P310 4TB thickness and sidedness. Not broken out in either flyer revision. This does not block either Express 1M2, which accept double-sided drives.
3. Crucial P310 4TB weight and power. Not published by Crucial; third-party power figures exist only for smaller capacities.
4. Samsung submodel. "Samsung 870 8TB" is most likely an 870 QVO `MZ-77Q8T0`, but the exact model code has to be read off the owner's drive.
5. Samsung mounting-hole pattern. Not in the Samsung datasheet; the SFF-8201 pattern has not been verified against this drive.
6. NVMe enclosure generation. The owner intends Express 1M2s; 40G versus 80G follows the Mac. The 80G has no dimensioned drawing and is not expected to fit the original holder. Connector geometry, cable routing and operating heat remain unresolved for both.
7. SATA-to-USB bridge. Not purchased. No vendor publishes logical-sector behavior, so the chosen unit must be checked on a scratch drive larger than 2TB first. The only cable documenting testing beyond 8TB is back-ordered, and its adapter body has no rack position yet.
8. Host compatibility and power check. OWC's 40G manual says the enclosure may not mount as the third bus-powered device on some Macs, names the Mac inconsistently, and gives no mechanism; the 80G manual omits the note. Apple publishes no per-port power figure. Nobody has tested the topology.
9. 12TB HDD make and model. Not purchased. Weight, screw positions, power, acoustics and vibration behaviour all change with the choice.
10. Power. No supply, hub, or dock chosen; total current and connector count are unknown. The HDD bridge must supply both SATA power rails, and its specified external supply must cover the chosen drive's spin-up current.
11. Mac port budget. Port classes follow from a Mac that has not been bought; four storage devices against three rear Thunderbolt ports is unresolved on both the 2024 and 2026 Mac mini.
12. Thermal behaviour. No airflow measurement, no CFD, no temperature test. Printed material choice for loaded brackets is open; PETG and ASA are candidates pending a service-temperature check.
13. Rails and frame. Original geometry is now measured and assembled from the local 3MF; physical fit, stack rigidity and fastening remain unvalidated.
14. Mass and load path. The HDD's base-supported skid path is modeled, but selected device/adapter masses, load sharing and safe payload have not been established or tested.
15. Vibration isolation for a spinning drive. Not designed, not measured.
16. Fastener schedule. Insert type and screw length require detailed alignment/head/penetration checks and printed coupon testing, not just the author's example hardware.
17. macOS storage limits. A USB-attached SATA drive gets no TRIM and no native S.M.A.R.T. on macOS, whichever bridge is chosen.
18. Filesystem on the Mac. Keeping ZFS requires Reduced Security for the OpenZFS kernel extension; moving to APFS requires a verified copy elsewhere first and a data split that fits the separate drives.

## Licensing and publication

The Rack Pro download is covered by MakerWorld's Standard Digital File License, which forbids sharing, sub-licensing, selling, renting, hosting, transferring, or distributing the digital or printed object or any derivative, including remixes and hosting elsewhere, and forbids any use for money. Source: the license block on <https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons>.

The STEP templates and original `assets/rack-pro/rack-pro.3mf` are that licensed geometry. They stay private, as do exports derived from them. The initial repository already tracked the templates; ignore rules do not remove them from its history. Nothing from this project is published, pushed, posted or redistributed. Link to the author's model page instead.
