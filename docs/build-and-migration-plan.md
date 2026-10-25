# Build and migration plan

The whole path from printing the rack to selling Tangerine, as of 2026-10-25. Nothing here has been bought, printed or test-fitted. Prices are the ones read on that date; sources and specifications are in the [hardware BOM](hardware-bom.md), geometry in [dimensions](dimensions.md), open fit questions in the [fit check](fit-check.md), and slicer guidance in the [print notes](print-notes.md).

This repository never touches the drives. Every disk step below is something the owner runs by hand.

## End state

One Mac mini (M5 Pro, 64GB, 1TB, 10Gb Ethernet) is the only server. It sits in a printed Rack Pro frame with the storage beneath it, bottom to top:

| Bay | Height | Holds | Connects to |
| --- | --- | --- | --- |
| HDD tray | 2U | Seagate IronWolf 12TB on a StarTech `USB31C2SAT3`, powered by a Mean Well 12V 3.34 A supply | Front USB-C port |
| SATA tray | 1U | Samsung 870 8TB on a StarTech `USB31CSAT3CB` | Rear Thunderbolt 5 port 3 |
| OWC holder | 1U | Two OWC Express 1M2 40G, each with a Crucial P310 4TB | Rear Thunderbolt 5 ports 1 and 2 |
| Cooling gap | 1U | Nothing: the Mac's intake and exhaust need it |  |
| Mac cradle | 3U | Mac mini |  |

The assembled frame is about 172.6 × 178.8 × 262 mm including the handles. Bridges, plugs, cables and power bricks are not modeled yet.

All four drives form one APFS volume on an AppleRAID concatenated set. The P310s are members 0 and 1, the Samsung member 2 and the IronWolf member 3, so new data lands on the SSDs first and spills onto the hard drive. That volume is about 25 TiB.

### What this design accepts

- **One drive failing loses everything.** A concatenated set has no redundancy; losing any member loses the whole volume, as the ZFS stripe did.
- **One drive dropping out takes the whole volume offline.** In tests with disk images, a member that disconnected while the set was mounted unmounted the volume and stayed marked `Failed` until every member was detached and re-attached. macOS sends no alert when this happens.
- **There is no backup.** The IronWolf becomes storage, so nothing copies the data anywhere until more hard drives are added.
- **No SMART over USB.** macOS cannot read SMART from the Samsung or the IronWolf over USB, including the hard drive's temperature. The NVMe drives in the Express 1M2s report SMART normally.
- **No TRIM for the Samsung** on a USB adapter.

Four separate APFS volumes behind one multi-location media library would keep a failure to that drive's files and survive a dropout. Choosing that instead changes only the "Create the pool" step below.

## 1. Before buying or printing

1. **Confirm the printer.** The rails are 254 mm long, so the printer needs a 256 × 256 mm bed, like the X1 Carbon the original author used. An A1 mini cannot print them. The gray Apple logo in the black top panel needs an AMS or a manual filament change.
2. **Revise the HDD tray.** Its strap path runs under its own support skids, so a strap can't hold the drive. The IronWolf's manual publishes its 6-32 UNC hole pattern, so the tray needs screw mounting before it is printed. This CAD change has not been made yet. It sets the length of the 6-32 screws on the shopping list.
3. **Check the IronWolf's price.** $449.99 is a third-party Amazon price for a discontinued model; it sold for $188.29 in February 2024.

## 2. Shopping list

You already own the two P310s, the Samsung, Tangerine and the network. Everything else:

| Item | Qty | Why | Price, 2026-10-25 |
| --- | --: | --- | --: |
| Mac mini, M5 Pro 18-core CPU / 20-core GPU, 64GB, 1TB, 10Gb Ethernet | 1 | The server | $3,299.00 |
| Seagate IronWolf 12TB, `ST12000VN0008` (Amazon lists retail SKU `ST12000VNZ008`) | 1 | Staging drive, then storage | $449.99 |
| OWC Express 1M2 40G, `OWCUS4EXP1M2` | 2 | One per P310; fits the original OWC holder | $88.99 each |
| StarTech `USB31CSAT3CB` | 1 | USB-C adapter for the Samsung | $30.74 |
| StarTech `USB31C2SAT3` | 1 | Powered USB-C adapter for the IronWolf | $53.53 on Amazon |
| Mean Well `GST40A12-P1J`, 12V 3.34 A, 5.5 × 2.1 mm centre-positive | 1 | Replaces the adapter's 12V 2 A brick, which is below the drive's spin-up draw | $17.30 at Jameco |
| Noctua NF-A9x14 PWM | 1 | Tangerine's CPU fan is failing and it has to run through the copy | $18.95 on Amazon |
| Bambu PLA Basic, Black, 1 kg | 1 | Rails, base, top | $18.99 at Target |
| Bambu PLA Basic, Gray, 1 kg | 1 | Mac cradle, handles, lid, logo | $18.99 at Target |
| Bambu PETG Basic, Gray, 1 kg | 1 | OWC holder, SATA tray, HDD tray, fit coupons | $13.99 list for a refill |
| M3 heat-set inserts, 4 mm long | 1 pack | Module retention, as the original author uses | not priced |
| M3 × 8 flat-head screws | 1 pack | Through the rails into the inserts | not priced |
| 10 × 3 mm disc magnets | 4 | Mac cradle lid | not priced |
| Hook-and-loop straps, at most 12 mm wide and 5 mm thick, about 250 mm long | 2 | Hold the Samsung in its tray | not priced |
| 6-32 UNC screws | 4 | Hold the IronWolf; length depends on the tray revision | not priced |

The priced items come to about $4,100, or about $800 without the Mac. Commodity hardware, tax and shipping are extra.

Buy only if needed:

- **A powered USB hub for the Samsung's adapter**, if the Mac won't mount three bus-powered devices at once. OWC warns about this for some Macs; it is untested on the M5 Pro.
- **A soldering iron with a heat-set insert tip**, if you don't have one.

Noctua's fans carry a 6-year warranty. If you still have the invoice for Tangerine's fan, an RMA is free but slower than buying one.

## 3. Filament

| Material and color | Parts | Estimate |
| --- | --- | --: |
| PLA Basic Black | 6 rails, top panel, base, a small accent on the Mac lid | about 300 g |
| PLA Basic Gray | Mac cradle, 2 handles, Mac lid, Apple logo | about 217 g |
| PETG Basic Gray | OWC holder, SATA tray, HDD tray, 2 fit coupons | at most about 330 g |

The PLA figures are the original author's own slicer estimates. The PETG figure is an upper bound: each part's solid volume at 1.27 g/cm³, as if printed 100% solid, using the current HDD tray before its revision. One 1 kg spool of each covers its parts with room for a reprint.

The frame and Mac parts stay in PLA, as the author printed them. Everything that holds a drive is PETG, because PLA Basic softens at about 57°C and those parts carry warm drives continuously. That includes the OWC holder, which the author printed in PLA. Watch the PLA Mac cradle for sag once the Mac runs long jobs. Target's Gray may not match Bambu's PETG Gray exactly.

## 4. Print

Print from the original author's Bambu Studio project for his parts, and from this repo's exports for the custom ones. Regenerate the exports first:

```sh
mise install
mise run install
node src/cli.ts rack --config config/owc-reference.toml --nvme-mount owc-reference
node src/cli.ts build --config config/reference.toml
```

| Part | Qty | Source | Material |
| --- | --: | --- | --- |
| Rack rails | 6 | Author's project, plate 1 | PLA Black |
| Rack top with Apple logo | 1 | Author's project, plate 2 | PLA Black, logo PLA Gray |
| Rack base | 1 | Author's project, plate 3 | PLA Black |
| Mac cradle and 2 handles | 1 + 2 | Author's project, plate 4 | PLA Gray |
| Mac cradle lid | 1 | Author's project, plate 5 | PLA Gray |
| OWC holder ("1M2 Vented") | 1 | Author's project, plate 6 | PETG Gray |
| Rail fit coupons, 1U and 2U | 1 each | `exports/coupons/rail_coupon_1U.stl`, `rail_coupon_2U.stl` | PETG Gray |
| SATA tray | 1 | `exports/full-rack/candidates/sata_ssd_carrier.stl` | PETG Gray |
| HDD tray | 1 | `exports/full-rack/candidates/hdd_carrier.stl`, after the screw-mount revision | PETG Gray |

The author's project is `assets/rack-pro/rack-pro.3mf`, or the "Rack Essentials, Mac mini M4, and Equipment Modules" profile on [MakerWorld](https://makerworld.com/en/models/896157-mac-mini-rack-pro-set-for-m4-mac-mini-add-ons#profileId-854246). Skip plates 7 to 14. The author's plates are set to PLA; switch plate 6 to PETG before slicing.

Order:

1. **One rail and the two coupons.** Slide the coupons through the rail's grooves and check the fit and the coupon's insert pocket. This tests the PETG slides against a PLA rail before you spend material on full trays.
2. **The rest of the frame:** the other five rails, the base and the top.
3. **The Mac cradle, handles and lid.**
4. **The OWC holder, then the SATA tray.**
5. **The HDD tray**, once it is revised.

Follow the [print notes](print-notes.md) for orientation, supports and slicer checks. Never slice `rack.step`: it contains device stand-ins and reserved air.

## 5. Assemble the rack

1. Press the heat-set inserts into the module slides that have pockets and anywhere else the author's parts call for them. Press the four magnets into the Mac lid, checking polarity.
2. Assemble the rails, base and top.
3. Slide in the modules bottom to top: HDD tray, SATA tray, OWC holder, then the Mac cradle with one empty unit beneath it. Fasten the 2U and 3U modules through the rails with M3 × 8 screws.
4. Keep the gap under the Mac empty. Nothing goes there: no trays, cables or power bricks.

The drives go in during the migration, in step 7.

## 6. Prepare Tangerine and the Mac

**Tangerine:**

1. Replace the CPU fan with the NF-A9x14 PWM: four screws, then plug it into `CPU_FAN`. Watch temperatures under load before trusting it with a day of copying.
2. Run `zfs list -o name,used,mountpoint` and note the pool's mount point and size.
3. List anything on Tangerine that lives outside the pool and needs to move: the supercut install, Whisper models, configuration, SSH keys.

**The Mac:**

1. Set it up, update macOS, and connect wired Ethernet. Put Tangerine on wired Ethernet too.
2. Keep it awake and stop the drives sleeping, the most common cause of USB drive dropouts:

    ```sh
    sudo pmset -a sleep 0 disksleep 0 autorestart 1
    ```

3. Set up SSH from the Mac to Tangerine, since the copy pulls over SSH, and install Homebrew's `rsync` for its `--info=progress2` option.

**Test the IronWolf before it holds anything.** StarTech only states testing to 10TB:

1. Swap the Mean Well supply onto the `USB31C2SAT3` and connect the IronWolf.
2. Erase it as APFS (named `Staging` below) and confirm it shows the full 12TB.
3. Write and read back a large test set, then delete it.

## 7. Migrate

Each full pass over the data takes at least 13 hours at the IronWolf's 210 MB/s maximum, and longer on its inner tracks. Plan for about four passes over two to three days.

1. **Copy everything to the IronWolf.** From the Mac, with the pool's mount point from step 6:

    ```sh
    rsync -aH --info=progress2 tangerine:<pool mountpoint>/ /Volumes/Staging/
    ```

2. **Verify the copy.** This reads both sides and compares checksums; no output means everything matches:

    ```sh
    rsync -aHc --dry-run --itemize-changes tangerine:<pool mountpoint>/ /Volumes/Staging/
    ```

3. **Copy irreplaceable files somewhere else too.** From step 4 until step 6, the IronWolf holds the only copy.
4. **Move the SSDs.** On Tangerine, run `sudo zpool export biggie` and shut it down. Remove the P310s and the Samsung. Install each P310 in an Express 1M2, following OWC's manual and pressing the lid down onto the thermal pad. Put the Samsung on its `USB31CSAT3CB`. Load the trays, then connect everything following the table under "End state".
5. **Check that everything mounts.** All three bus-powered devices (two Express 1M2s and the Samsung) must appear in `diskutil list`. If one doesn't, move the Samsung's adapter to a powered USB hub.
6. **Create the pool.** This erases the three SSDs, so check every identifier against `diskutil list external physical` first:

    ```sh
    diskutil appleRAID create concat Media APFS <P310 A> <P310 B> <Samsung>
    diskutil appleRAID list
    ```

    Record the set's UUID from the second command. Order matters: the first disk listed fills first.

7. **Copy from the IronWolf into the pool** with `rsync -aH --info=progress2 /Volumes/Staging/ /Volumes/Media/`, then verify with the same `-c --dry-run --itemize-changes` form.
8. **Add the IronWolf to the pool.** This erases it, and the pool becomes the only copy:

    ```sh
    diskutil appleRAID add member <IronWolf> <set UUID>
    ```

    Use the set's UUID, not the volume name. APFS grows to take the new space without unmounting.

9. **Set up an alert for a missing member.** macOS gives none. A scheduled job that checks `diskutil appleRAID list` and warns when any member isn't `Online` is not written yet.

## 8. Settle in, then sell Tangerine

1. Run from the Mac for a couple of weeks. Check drive temperatures under long transfers: SMART works for the NVMe drives; for the Samsung and IronWolf over USB, a thermometer on the case is the practical check. Watch for dropouts and any sag in the PLA Mac cradle.
2. Move off anything left on Tangerine from step 6, and remove it from your Tailscale network.
3. Securely erase Tangerine's own boot drive. Its data SSDs are already in the rack.
4. Sell it whole or as parts: the i9-12900K, ASUS ROG Strix B660-I, RAM, low-profile cooler with the new fan, power supply and Computer-1 case.

## Later

- **Add backup drives.** When you add more hard drives, use them as backups of the pool, not more pool members: any member's failure takes the whole pool with it.
- **Each new pool member** joins live with `diskutil appleRAID add member`.
