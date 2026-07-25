# Alto Trek revival

Resurrecting **Alto Trek** — the networked multiplayer starship game written by Gene Ball
(with Rick Rashid) at the University of Rochester in the late 1970s for the Xerox Alto —
with the eventual goal of a multiplayer browser version.

## Files

- `Trek.boot!1` — the original Alto Trek binary (79,406 bytes, Jan 1981).
  SHA-256 verified identical to the copy preserved in the Computer History Museum's
  Xerox Alto archive (`[Io]<Murray>Trek.boot`).
- `docs/trek21.pdf` — the Alto Trek 2.1 manual (Aug 1979), from Bitsavers.
- `emulator/` (not in git) — ContrAlto 2.0 emulator release + two-instance network setup.

## Running Trek locally (ContrAlto)

Requires the .NET 8 runtime. The `emulator/` directory contains ContrAlto v2.0-Beta
from https://github.com/jdersch/Contralto2/releases.

**Two networked instances on this PC:** run `emulator\start-trek-pair.cmd`.
It launches two ContrAlto instances that auto-boot straight into Trek
(via `boot-trek.script`), with configs `trekA.cfg` / `trekB.cfg`:

- Alto network addresses **42** and **43** (octal; each Alto on the net needs a unique one)
- Ethernet: **UDP encapsulation** on the `Wi-Fi` adapter — ContrAlto wraps the Alto's
  3-Mbit Ethernet packets in UDP broadcasts, so all instances on the same subnet
  (same PC or other machines on the LAN) share one virtual Ethernet
- Separate disk images (`Disks\gamesA.dsk` / `gamesB.dsk`, copies of the curated
  `games.dsk`) because ContrAlto writes disk changes back on exit

In each emulator window:

1. **System → Start** (Ctrl+Alt+S) — wait for the Alto Executive `>` prompt
2. Type `trek` and press Enter (`Trek.RUN` is on the games disk)
3. Pick a race (Terran / Klingon / Romulan); ships on the same virtual Ethernet
   see each other — no server, each Alto multicasts its state (the original design)

To add a third player on another PC on the LAN: copy `emulator/`, set a unique
`HostAddress` (e.g. `44`) and that machine's adapter name in the cfg.

**Important — patched build:** the `emulator/` binaries are built from a patched
checkout of Contralto2 (master + local changes in `ContraltoLib/IO/UDPEncapsulation.cs`,
source at `..\..\Contralto2`). Stock ContrAlto cannot network two instances on the
*same* machine: it binds UDP port 42424 exclusively (second instance silently loses
networking) and drops all packets arriving from its own IP address. The patch binds
with `SO_REUSEADDR` and filters broadcast echoes by the Alto source address in the
packet (byte 3) instead of by host IP. Verified working: with both instances in Trek,
a sniffer on port 42424 sees both Alto 42 and Alto 43 broadcasting ~5 packets/sec to
octal address 347 (Trek's multicast group). Across two physical machines the stock
build works without the patch.

## Controls (from the 2.1 manual — "bugging" = clicking)

Everything is mouse-driven, but only inside specific console areas:

- **Direction circle**: click in the *outer* ring to point the ship (outer dot = ship
  heading, inner dot = phaser aim; click near center to aim phasers only)
- **Accel bar** (right of the circle): click to set thrust — it *stays on* until you
  click it off at the bottom (right-click = decaying acceleration). Inertia applies;
  to slow down, turn around and thrust the other way
- **Short-range scan** (big bottom area): move the cursor *next to your ship* (cursor
  becomes a bar) — left-click raises shields a level per click (hold = max), right-click
  lowers; four quadrants of shields, and shields burn energy
- **Fire Phasers / Fire Torpedoes boxes**: click to fire in the ship's facing direction
- **Long-range scan** (top left): any click swaps it to the Galaxy scan; right-click
  in Galaxy scan returns. With the cursor over a system containing your base:
  left-click = jump to it, middle-click = remote scan
- **ESC B** = deploy a base, **ESC Q** = quit; Romulans: **ESC C** = cloak/uncloak
- **Typing anything = chat broadcast to all players** (reveals your race and location!)
- Race/options are command-line switches, not a menu: `trek/k` Klingon, `trek/r` Romulan,
  `trek/g` gravity off, `trek/b` start in Sol, `trek/n` n-system universe (`trek/g5r`
  suggested for beginners). Default: Terran, gravity on, 15 systems
- Don't idle: gravity drags a drifting ship into stars — damaged subsystems show as
  gray-hatched console areas and a DAMAGED banner (they repair slowly, or instantly at a base)

Notes:
- If Trek needs quick reflexes, leave `ThrottleSpeed = True` (authentic 60 fields/sec).
- The archived `Trek.boot!1` can be run instead of the disk's `Trek.RUN` via the
  Executive's `bootfrom trek.boot` once we copy it onto a disk image (TODO — needs
  Alto FTP/IFS or a host-side Alto filesystem tool such as https://github.com/hsnaves/alto_files).

## Browser version (live)

**https://alto-trek.web.app** — Trek running client-side in every visitor's browser
(ContrAltoJS emulation), with all visitors sharing one virtual Ethernet.

Architecture:

- `web/` — static site, deployed to Firebase Hosting (site `alto-trek`, project
  `claude-fastmail-tools`). A fork of [ContrAltoJS](https://git.loomcom.com/seth/ContrAltoJS)
  (AGPL-3.0 — keep source public) with:
  - `js/io/ws_network.js` — WebSocket virtual-Ethernet transport (replaces the
    2016 PeerJS/retroweb-networking WebRTC stack, whose public signaling
    infrastructure is long dead)
  - `js/io/ethernet_controller_abridged.js` — patched to use it (`joinWebSocketNetwork`),
    with echo/collision filtering by Alto source address
  - `index.html` — Trek-branded page: random Alto address, one-click join,
    auto-boots games.dsk and auto-types `trek` after 30 s
  - `images/games.dsk` — the curated games disk containing `Trek.RUN`
- `relay/` — ~100-line Node/`ws` broadcast relay ("the cable"): every binary frame
  is forwarded to every other client in the room. No game logic. Deployed on
  Cloud Run: `alto-trek-relay` (us-central1, `--max-instances 1` so all players
  share one room instance).

Deploy commands:

    firebase deploy --only hosting                  # from repo root
    gcloud run deploy alto-trek-relay --source relay --project claude-fastmail-tools \
        --region us-central1 --allow-unauthenticated --max-instances 1 \
        --memory 256Mi --timeout 3600

Local dev: `node relay/server.js` (port 8081) + any static server in `web/`
(port 8080); the page auto-targets localhost when served from localhost.

Verified end-to-end: two headless browsers on the live site each multicast
~4 frames/sec to octal 347 through the Cloud Run relay, same protocol traffic
as two native ContrAlto instances.

## Roadmap

1. ~~Run original binary in ContrAlto, two instances over emulated Ethernet~~ ✓
2. ~~Browser multiplayer via ContrAltoJS + WebSocket relay on Firebase/Cloud Run~~ ✓
3. Polish: rooms (relay already supports them via WS path — add `?room=` UI),
   address collision avoidance (relay could assign addresses), mobile controls,
   faster boot (snapshot RAM after OS boot?)
4. Modern reimplementation (TypeScript/canvas + WebSocket or WebRTC peer-to-peer),
   using `docs/trek21.pdf` and the emulator as the behavioral reference
