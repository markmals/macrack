# Frankenmac Rack — Agent Instructions

## Project purpose

Build a compact, modular, 3D-printable rack enclosure for a future Apple Silicon Mac mini and the owner's existing storage. Extend Jerrod H's **Mac mini “Rack Pro”** MakerWorld design rather than creating a competing rail/mounting system from scratch.

**Source model:** https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons#profileId-854246

The primary output is **maintainable parametric CAD source plus printable, inspectable models**, not just screenshots or a concept render. The final result should be physically plausible, small, serviceable, and expandable. Aim for an overall enclosure smaller than the owner's current Teenage Engineering Computer-1 chassis, if the mechanical and thermal requirements permit; **do not assume a particular rack height is already sufficient**.

The owner has **mise (Node and pnpm), FreeCAD, and Bambu Studio installed on macOS**. Set up other project-local tools as needed. Prefer [caddy](https://github.com/markmals/caddy) (`@roonieone/caddy`: build123d's algebraic API in TypeScript on native OpenCascade) as the source of truth, FreeCAD for STEP inspection, and Bambu Studio for print validation.

## Hardware to accommodate

| Device | Quantity | Role | Known information |
| --- | --: | --- | --- |
| Apple Silicon Mac mini | 1 | Main computer | **Not yet purchased / exact generation unconfirmed.** Existing Rack Pro supports the M4-style 127 × 127 × 50mm form factor; verify selected Mac before final fit. Keep Mac in its factory enclosure. |
| Crucial P310 4TB NVMe SSD | 2 | Fast primary storage | Model `CT4000P310SSD8`; M.2 2280. Each requires a suitable USB4/Thunderbolt NVMe bridge/enclosure and heat sinking. |
| Samsung 870 8TB 2.5-inch SATA SSD | 1 | Existing data SSD | Exact 870 submodel/physical height and chosen SATA-to-USB bridge must be verified. |
| 12TB 3.5-inch SATA HDD | 1 | Migration backup, retained in rack afterward | **Not yet purchased; model unknown.** Model only a provisional keep-out envelope until exact manufacturer's dimensions, screw positions, weight, and power requirements are available. |
| Mac/drive connectivity hardware | TBD | Ports and power | Specific NVMe bridges, SATA bridges, powered hubs, and AC/DC supplies **not yet selected**. Do not invent dimensions or power budgets. |

The new 12TB HDD is intended to remain connected to the Mac as a backup device after migrating the existing storage. The rack should support it independently of the SSD modules. A 3.5-inch HDD generally needs both 5V and 12V power; do not treat it as bus-powered merely because it connects by USB.

**Current storage and data safety:** The three existing large SSDs constitute one OpenZFS pool (`biggie`) with three _single-disk top-level vdevs_ (8TB SATA + 4TB NVMe + 4TB NVMe), **no redundancy**, approximately 8.73 TiB logical data and no ZFS snapshots. Pool compression ratio is 1.00×. **Design work must never reformat, detach, repartition, mount read/write, or otherwise modify any of these disks.** Storage migration is a separate project and requires a verified external backup before disassembly. Do not assume the 12TB disk already exists or is an adequate sole backup of irreplaceable data.

## Rack Pro design constraints

Source description reports:

- Rail opening: **146mm** between the vertical rails.
- **1U = 25mm**, **2U = 50mm**, **3U = 75mm** in this _miniature_ rack system.
- The author supplies editable **1U, 2U, and 3U STEP templates** that include the rail mating/slide geometry; larger module heights can be adapted.
- Modules slide into the rails and can be secured with **M3 flat-head screws into heat-set inserts**; the author's example hardware is 4mm-long M3 inserts and M3×8 flat-head screws. Verify actual mounting geometry in STEP files before specifying hardware.
- The author already supplies a **1U two-OWC-Express-1M2 module**. Consider reusing it only if those particular USB4 enclosures are selected; do not design around accessories the owner has not purchased.
- The author recommends **an unoccupied 1U beneath the Mac mini** for its air intake/exhaust. Preserve at least the original model's intended cooling space and don't put a solid tray directly underneath it.
- The download has a **private-use license**. Keep downloaded source geometry and derivatives for the owner's private project; do not publish or redistribute original or modified Rack Pro geometry without obtaining permission.

The facts above quote the maker's public description. This checkout now contains the original 1U/2U/3U STEP templates and the private `assets/rack-pro/rack-pro.3mf` project. Use `docs/dimensions.md` and the generated manifests for measured constraints: the template heights are 25/50/75mm, while the actual rail pitch is 25.4mm. The 3MF is gitignored and may need to be supplied in another checkout. No physical rail fit, hardware fit, structural capacity or print success is validated by the CAD checks alone.

## Design priorities

1. **Smallest practical exterior envelope**, without sacrificing cooling, rigidity, service access, or safety. Prefer modifying rail length over creating a large conventional rack enclosure. Treat the Teenage Engineering Computer-1 (~170 × 190 × 322mm outer envelope) as a comparison, not a mandatory exact bounding box.
2. **Modularity:** independent rack inserts for the two NVMe SSDs, the SATA SSD, and the 3.5-inch HDD; rails can be extended or shortened to suit the stack. Preserve swap/upgrade access without dismantling the entire rack.
3. **Reuse:** use the original Rack Pro rail interface, Mac cradle, and existing modules where practical, particularly the dual-NVMe module if the hardware choice supports it.
4. **Serviceability:** front or side access to mounting screws, connector access and cable strain relief, ventilation, labeled bays, unobstructed Mac power button and ports.
5. **Thermals and acoustics:** retain the Mac's intended airflow, cool NVMe bridge/heatsinks, provide HDD ventilation and mechanical vibration isolation; favor mechanically secure mounting to adhesive solutions.
6. **Safety:** use commercially certified, adequately rated power supplies and bridges. Never fabricate exposed mains wiring, a custom AC splitter, or bare high-voltage power distribution. Do not remove factory electrical shielding/heatsinks without a validated replacement.
7. **Printability:** FDM-friendly parts, practical orientation, sensible wall thickness, fillets, captive/heat-set inserts where justified, and minimal supports. Prefer PETG or ASA for thermally loaded brackets once service temperatures are checked; don't assume PLA is adequate for continuous thermal/mechanical loading.

## CAD implementation

- Use **millimeters** for all geometry and technical drawings.
- Keep the Node/TypeScript project managed by mise and pnpm, with dependencies pinned through `pnpm-lock.yaml`. Follow caddy's TypeScript conventions (`.ts` imports run directly by Node, `let` bindings, trailing options objects, strict types).
- Prefer **caddy** scripts for deterministic geometry. Use FreeCAD to verify STEP imports, placement, dimensions, and exported parts. Avoid relying exclusively on opaque edits in a binary CAD file. FreeCAD's API is Python-only: keep the scripts under `scripts/freecad/` thin adapters that drive FreeCAD and report raw facts, with every check and file decision in TypeScript.
- Import downloaded original STEP files with caddy's `importCAD()`; use the exact rail-slide/mating geometry from those files. Do not approximate the dovetail/slide profile from the 146mm description.
- Use named parameters for geometry, module height, wall thickness, clearance, fastener placement, drive dimensions, bridge dimensions, and cable bend/connector envelopes. Record whether every parameter is **manufacturer-confirmed**, **measured from CAD**, **physical measurement**, or **provisional**.
- Use separate source modules/classes for shared rack interfaces, device envelopes, individual inserts, and full assembly. The assembly should include non-printable keep-out solids for the Mac, drives, plugs, power adapters and cable paths.
- Export **one STEP and one STL per printable part**. STEP is the editable interchange representation; STL is for slicing. Add a full assembly STEP where feasible. If a 3MF is created, make it a Bambu Studio project with an explicit printer/material profile rather than presenting it as a universal print file.
- If an exact vendor CAD model is unavailable, construct a simple labeled envelope from verified datasheet dimensions. Never present a stand-in solid as the real vendor component.
- Use assertions or automated checks for maximum dimensions, nominal rail-fit interference/clearance, screw-hole placement, wall thickness, and basic collision checks. Boolean success does not prove a print will fit; record tolerances and any unvalidated assumptions.
- Prefer parameterized test coupons for the rail interface, heat-set insert pockets and drive mounting interfaces before committing to a full-sized print.

## Proposed printable components

**A. NVMe module:** first evaluate the Rack Pro's existing 1U mount for two OWC Express 1M2 enclosures. If a different pair of USB4/Thunderbolt NVMe bridges/enclosures is selected, produce a revised custom rack insert using manufacturer dimensions and cable-clearance keep-outs. Maintain adequate cooling for continuous transfers.

**B. 2.5-inch SATA SSD insert:** make a low-profile, removable module with correct Samsung drive mounting-hole spacing, clearance for its USB-to-SATA bridge, suitable heat dissipation, and rear/side cable routing. Start with a 1U template, but increase height if needed to meet realistic mechanical/thermal tolerances.

**C. 3.5-inch HDD insert:** use the precise chosen 12TB drive's manufacturer mechanical drawing. Investigate a 2U horizontal tray, but **do not force 2U** if real screw/grommet, ventilation, connector, or bend-radius clearances require 3U or more. Account for the drive's mass, center of gravity, start-up vibration, mounting standard (commonly 6-32 UNC), and manufacturer-specified screw penetration limits. Position low in the rack where practical. Include a supported, rated SATA power/USB bridge and its power-connector keep-outs. Do not make the 3D-printed rail slides alone carry an unverified cantilevered load.

**D. Rail/frame adjustments:** determine the actual usable U count from downloaded STEP/3MF and an assembly model. Allow for the Mac's 3U module, its recommended ventilation gap, storage inserts, frame top/bottom, cables, and fasteners. If taller rails are required, model mechanically robust extensions or longer replacement rails that fit the intended printer bed and remain rigid with the HDD installed. Do not assume all parts fit an A1 mini or other small print bed.

**E. Optional cable-management / power-adapter mount:** add only after selecting exact devices. Avoid proprietary power wiring and avoid coupling the user to one bridge/adapter unnecessarily.

## Validate before considering a design printable

- Confirm that the **source 1U/2U/3U STEP templates** actually import and that the rail mating surfaces, bolt holes, and module axes are documented.
- Confirm the selected **Mac mini generation** fits the rack's original cradle and retains intake/exhaust and port accessibility. Don't assume subsequent Mac generations are mechanically identical.
- Confirm each selected drive, enclosure/adapter, plug, and power brick fits using exact product dimensions. Explicitly account for cable connector overhang and bend radius.
- For every exported part, check positive volume, valid/watertight mesh, correct millimeter scale, known fit allowances, and printable orientation.
- Import STL/STEP into **Bambu Studio**; inspect overhangs, supports, first layers, wall counts, bed fit, material assumptions, and slicer warnings. Do not claim a successful physical print from a slicer preview.
- Perform full assembly interference and clearance checks. Include a separate thermal/airflow and service-access review; CAD alone cannot validate operating temperatures or drive vibration behavior.
- Model rack stability with the HDD installed, including tipping and weight distribution. Flag anything needing real-world testing.

## Expected repository structure

```text
macrack/
├── AGENTS.md                   # This file
├── README.md                   # Overview, build and inspect commands
├── package.json / pnpm-lock.yaml / mise.toml
├── assets/rack-pro/            # Original authorized STEP/3MF downloads (3MF gitignored)
├── config/                     # Parameter sets (TOML)
├── src/
│   ├── cli.ts                  # inspect, build, rack and FreeCAD commands
│   ├── parameters.ts           # Confirmed/provisional dimensions
│   ├── carriers/               # Original slide interface and custom inserts
│   ├── mesh/                   # Triangle meshes, transforms, STL
│   ├── source/                 # 3MF reader, measured frame and original modules
│   ├── rack/                   # Full-rack assembly, collision checks, outputs
│   ├── study/                  # Carrier-only study, keep-outs, exports
│   └── freecad/                # FreeCAD orchestration
├── scripts/freecad/            # Thin FreeCAD-hosted Python adapters
├── tests/                      # Parametric CAD assertions (Vitest)
├── exports/                    # Generated STEP/STL/FCStd/PNG (gitignored)
└── docs/
    ├── dimensions.md           # Measurement source and confidence log
    ├── hardware-bom.md         # Components/fasteners/adapters; TBD items explicit
    ├── fit-check.md            # Collision, clearance and unresolved questions
    └── print-notes.md          # Orientation, material and slicer settings
```

Adapt the layout if a simpler repository structure is more maintainable. All generated output should be reproducible with documented commands.

## Agent operating rules

- **Act autonomously on software setup, repository scaffolding, investigation, geometry generation, test scripts, and export/validation.** Don't stop for a question when a useful provisional design can be produced with explicitly labeled assumptions.
- First inspect what CAD source files and device datasheets actually exist locally. If MakerWorld source templates are not available, create the caddy project, device parameter model, and provisional parts, but leave the rack mating geometry blocked. Do **not** improvise the critical rail fit or falsely claim final manufacturability.
- Treat purchasing decisions as unresolved: don't assume a specific 12TB HDD, NVMe bridge, SATA bridge, or print service has been chosen. Describe any required selections and their relevant size/power tradeoffs in `docs/hardware-bom.md`.
- Don't access, modify, erase, or experiment with Tangerine's storage devices. This project is **mechanical CAD only**, with supporting electronics packaging.
- Respect the Rack Pro model's private-use licensing. Link to the author's model rather than committing downloaded proprietary-source geometry to a public repository.
- Produce meaningful artifacts in the current work session: source code, tests, exported candidate models, renders/screenshots if useful, and a concise status of what is measured, assumed, validated, and blocked. Avoid claiming real-world fit or print success until demonstrated.

## Reference links

- Original Rack Pro design/download: https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons#profileId-854246
- caddy (TypeScript CAD on OpenCascade): https://github.com/markmals/caddy
- build123d documentation, the API caddy ports: https://build123d.readthedocs.io/
- FreeCAD: https://www.freecad.org/
- Bambu Studio: https://github.com/bambulab/BambuStudio
- Bambu Studio command-line guide: https://github.com/bambulab/BambuStudio/wiki/Command-Line-Usage
- Apple Mac mini 2024 dimensions for original cradle reference only: https://support.apple.com/en-us/121555
