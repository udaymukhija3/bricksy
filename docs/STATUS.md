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
| 🧱 Smuggle | ✓ (+ daily lock fixed today) | 5→6 cubes, 4th wall at L6 | *Show a fit* (BFS) | bonk → fit → through | no 5th wall; par not shown per wall |
| 🪞 Mirror | ✓ | 5→8 cubes | uncovered cells shown red | L14 loads | binary answer: 50% guess floor; needs a "where does it fail" second question |
| 🧩 Assemble | ✓ | 2→4 parts, scramble 1→3 | *Show solution* fly-in | full round hit, pick cycling | anchor picking on small phones is fiddly; a layer-grid picker would help |
| 🔪 Cut | ✓ (case picker pure since today) | solids/cuts to L6, six options at L8 | cuts the solid, marks the outline | L14 loads | plateau after L8 |
| 📐 Fold | ✓ | 1-4-1 nets → all 11; two faces at L6 | folds, tumbles, marks faces | two-face round played | nothing beyond two faces |
| 🔦 Shadows | ✓ | 5→13 cubes, 3³ → 4³ | diff grids + orange ghost | L13 loads | one commit per round; a "fix it" practice mode would teach more |
| 🔢 Count | ✓ | 3×3 → 6×6, heights 3→4 | 540° reveal, hidden in orange | L9 loads | plateau after L14 |
| ⚡ Flash | ✓ | 4→8 cubes, 3 → 1.2 s, turned view | ghost overlay | L0 played | no "what did I get wrong" beyond counts |
| 🎲 Tilt | ✓ | 4→5 rooms, 3→5 loose | cubes fall, socket pulses | L0 played | plateau after L12; only one asked cube |
| ⚙️ Gears | ✓ | 4→7 gears, speed at L3, compounds at L5/L8 | train runs, marks | L14 loads | plateau after L8 |
| 🏗️ Shove | ✓ | par 3→18, turn needed at L4, box at L6, L4/T4 crates at L8 | *Show solution* | solved at par, blocked plan, box replay | second turnable crate; box levels take up to ~0.4 s to generate |
| 🧭 Wayfind | ✓ | 4×4 → 9×9, loops 0→5, random heading at L3 | trail on the map | walk, dead end, give up | no "rotated map" variant; hit = zero wrong turns may be harsh at 9×9 |
| ♟️ Mate | ✓ | any → turn → tilt → 3 pieces → mate in two at L8 | escape squares, *Show answer* (both plies) | mate-in-one hit, mate-in-two miss + replay | no opponent beyond the king; mate in two only in endless |
| 🔁 Match | prototype 0, deliberately bare (control condition) | 5 levels, own progression | replay / reveal | — | not a product by design |

Cross-cutting, shipped today: run loop with reload-safe dailies, lock + result card (streaks,
histogram, countdown, next-daily handoff), hub scorecard, `#N` share text, Open Graph tags,
stage banner for the verdict, help panels with learning curves, log capped/debounced,
generator sweep test, `?level=N` dev override.

Cross-cutting, still open: **deploy is blocked by the GitHub Actions billing lock** (live site
is the Sept 13 build); no server, so streaks and stats are per device; no accounts; no
analytics beyond the local log (by design).
