# Status — is each game a product yet?

Updated 2026-09-18. The bar for "product": own page · daily (seeded, reload-safe, locks when
done) + endless · difficulty escalates by level and the generator never throws (`npm test`
sweeps every generator at every level) · a miss teaches (reveal or *show answer*) · help panel
with controls, *why this game* and the player's learning curve · phone layout · logging with
`level` and `ok` · verified end to end in the browser at low, mid and high levels.

| Game | Product bar | Curve (daily → endless) | Miss teaches | Verified | Thin spots / next dial |
| --- | --- | --- | --- | --- | --- |
| 🚚 Tight Fit | saga + today's job (stars, share, day streak) | 10 jobs, boss chains 4 stages; daily job varies chain | retry within 3 tries; job restarts | map, daily job, load stage | no endless; corner stage never scales |
| 📦 Pack | ✓ (moved onto the run loop today) | 6 stages by score; daily climbs 2× | lift out & retry, replay, skip | full daily played, lock, resume | opaque molds only at score 16 |
| 🧱 Smuggle | ✓ (+ daily lock fixed today; a run now survives a mid-run reload, bonk included) | 5→6 cubes, 4th wall at L6 | *Show a fit* (BFS) | bonk → fit → through; pass → reload → resume; bonk → reload → fit | no 5th wall; par not shown per wall |
| 🪞 Mirror | ✓ | 5→8 cubes; three-way answer from L2 | uncovered cells shown red; fit over rotations + translations | rot/other rounds played | nothing beyond three kinds |
| 🧩 Assemble | ✓ | 2→4 parts, scramble 1→3 | *Show solution* fly-in | full round hit, pick cycling, grid anchor on a phone | anchors can be set by tapping a layer grid or the ghost |
| 🔪 Cut | ✓ (case picker pure since today) | solids/cuts to L6, six options at L8 | cuts the solid, marks the outline | L14 loads | plateau after L8 |
| 📐 Fold | ✓ | 1-4-1 nets → all 11; two faces at L6 | folds, tumbles, marks faces | two-face round played | nothing beyond two faces |
| 🔦 Shadows | ✓ | 5→13 cubes, 3³ → 4³ | diff grids; *Fix it (practice)* until it casts right; *Show the object* | miss → fix → fixed | — |
| 🔢 Count | ✓ | 3×3 → 6×6, heights 3→4 | 540° reveal, hidden in orange | L9 loads | plateau after L14 |
| ⚡ Flash | ✓ | 4→8 cubes, 3 → 1.2 s, turned view | ghost overlay; your extra cubes turn red | L0 played | — |
| 🎲 Tilt | ✓ | 4→5 rooms, 3→5 loose | cubes fall, socket pulses | L0 played | plateau after L12; only one asked cube |
| ⚙️ Gears | ✓ | 4→7 gears, speed at L3, compounds at L5/L8 | train runs, marks | L14 loads | plateau after L8 |
| 🏗️ Shove | ✓ | par 3→18, turn needed at L4, box at L6, L4/T4 crates at L8, two crates at L12 | *Show solution* | solved at par, blocked plan, box replay, two-crate replay | heavy levels take up to ~0.4 s to generate |
| 🧭 Wayfind | ✓ | 4×4 → 9×9, loops 0→5, random heading at L3 | trail on the map | walk, dead end, give up | no "rotated map" variant; hit = zero wrong turns may be harsh at 9×9 |
| ♟️ Mate | ✓ | any → turn → tilt → 3 pieces → mate in two at L8 → a guard at L10 | escape squares, *Show answer* (both plies) | mate-in-one hit, mate-in-two miss + replay, guard round | guard is static; mate in two only in endless |
| 🔁 Match | prototype 0, deliberately bare (control condition) | 5 levels, own progression | replay / reveal | — | not a product by design |

Cross-cutting, shipped today: run loop with reload-safe dailies, lock + result card (streaks,
histogram, countdown, next-daily handoff), hub scorecard, `#N` share text, Open Graph tags,
stage banner for the verdict, help panels with learning curves, log capped/debounced,
generator sweep test, `?level=N` dev override. Later the same day (product layer, second
session): learning curves fixed for Cut, Tilt and Smuggle (they log under their old sketch
names; `progress.ts` reads both, and a result marked `firstTry: false` never counts); a daily
is pinned to the date the page opened (no key/seed switch at midnight); Cut's option shuffle is
engine-independent (Safari and V8 no longer see different distractors for one seed); the
service worker prompts a reload when it has fetched a newer page than the one on screen; every
page has an error guard (persistent toast + `error` event in the log).

Cross-cutting, still open: **deploy is blocked by the GitHub Actions billing lock** (live site
is the Sept 13 build); no server, so streaks and stats are per device; no accounts; no
analytics beyond the local log (by design).
