# Validation — token-radar-01 entry

Run 2026-11-17 ~12:09 WIB (Asia/Jakarta) against the kit's sealed snapshot
(`input/snapshot.json`: as_of 2026-11-14, 758 protocols, watchlist 40, floor
$50,000,000). Node v24.22.1. Model `radar-3`. Build command:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/radar-out node main.ts --input <snapshot.json>
```

## The model (radar-3, what changed from radar-2)

- **Size term, fitted on the snapshot's own live peers.** Across the 128
  live-token protocols with a positive ratio, log(market-cap / TVL) falls
  0.54 per log point of TVL (t = −5.2); the slope is −0.49 to −0.57 in every
  subsample tried (dropping the giants, dropping the fast growers, capping
  growth at ±20). So `size = (TVL / $28,264,700)^(−0.54)`, where $28,264,700
  is the median TVL of the 143 live-token peers in the peer table, and the
  peer multiple is `clamp(category median × size, 0.01, 1.00)`.
- **Growth weight 0.5 → 0.10 and maturity 0.70/0.30 → 0.90/0.10.** The same
  fit finds no reliable premium for either (growth slope −0.05 per point on
  all 128 peers, −0.03 once the fast growers are dropped, −0.02 within ±20
  points; age slope −0.52 over 730 days with a standard error of 0.75), so
  both move the value only a little: the week's deposits are already inside
  TVL, and age shows no measurable effect.
- **Peer floor 0.05 → 0.01.** The fitted multiples for the largest protocols
  run to ~0.015, so a 0.05 floor would have made the top rows floor artifacts;
  with 0.01, 0 rows sit at the floor.
- **Per-category size reference rejected.** Pricing the size factor against
  each category's own median TVL was unstable for thin categories (17 rows at
  the 1.0 cap, 21 at the 0.05 floor, with small-category rows jumping to the
  cap); the single market-wide reference is used instead.
- **Farm plans** are now category-specific in three more places: step 1
  names the chain the wallet must use, step 3 is the weekly action in the
  category's own terms (supply/borrow for lending, swap/add liquidity for
  dexes and yield, deposit into a new vault for curators, check new listings
  for RWA, check the basis position for basis trading), step 6 is the
  category's own launch milestone, and step 7 keeps the matching position
  (supply / liquidity / vault / yield-asset / basis position).
- **Dashboard:** the peer column shows the size factor
  ("8 peers · ×0.33" / "market · ×0.08"), the detail view breaks the multiple
  into peer median × size, the model section states the fitted evidence, the
  sandbox gains a size-exponent slider, and the board shot is denser (rows
  1–9 visible at 1440×1000, was 1–7 at 1440×900).

## The gate (all 8 pass)

Independent checker: `~/workspace/makefun/token-launch-radar-scratch/gate-check.mjs`
(it re-implements the gate from RULES.txt; it does not reuse the entry's code
except the vendored `buildDossier`, which is the gate's own reference).

| Check | Result |
|---|---|
| dashboard_files | PASS — 3 files, 43,434 bytes, html+css+js present, no http(s):// in attributes, url(), @import or imports |
| dashboard_source_under_64k | PASS — 43,434 bytes (dossier text cap) |
| board_file | PASS — 198 rows, 370,686 bytes, 0 invalid rows |
| sorted_by_value | PASS — ranks 1..198, implied non-increasing, not all equal (198 distinct values) |
| coverage | PASS — 40/40 watchlist slugs present |
| farm_steps | PASS — 198 rows, 1,386 steps, all 7 steps, 20–600 chars each |
| screenshots | PASS — 3 PNGs, 1440×1000 each, 176–268 KB (cap 512 KiB), long side 1440, short side 1000 |
| dossier_matches | PASS — byte-identical rebuild of dossier.json, 895,892 bytes (cap 1.5 MiB) |

## Kit's own check (`makefun check --worktree`)

- pass competition_open — now is between opening 2026-11-14T10:00:00Z and
  deadline 2026-12-14T10:00:00Z.
- pass snapshot — 13 files, 749,601 bytes, within the intake caps.
- pass license_osi — LICENSE declares `SPDX-License-Identifier: MIT`.
- pass entrypoint — main.ts at the root selects node22.
- **FAIL transcripts_present — expected: no transcripts bundled yet. That is a
  submission-step item (bundle the build sessions at submit time).**
- 13 skipped, 5 checked at submission (repo_public, repo_owner,
  repo_created_after_open, commit_in_repo, duplicate_snapshot).

## Determinism

Two full runs into two directories, `diff -r`: byte-identical across
board.json, data.js, dossier.json, dashboard/ and screenshots/. Runtime
~0.3 s per run (limit 120 s).

## Code / data agreement

The dashboard recomputes every implied value in the page from the snapshot's
own figures (TVL × the row's peer multiple × growth × maturity) and compares
it with the value board.json carries. Checked live in a headless browser for
8 sampled rows (ranks 1, 2, 4, 6, 7, 10, 11, 14: bitfi-basis,
steakhouse-financial, gauntlet, bittensor-dtao, tori-finance, onre,
opentrade, upshift): all 8 land on the same dollar. Checker:
`~/workspace/makefun/token-launch-radar-scratch/agree-check.mjs`.

One regression was caught and fixed during this run: the new farm-plan
helpers in `dashboard/app.js` used a `hasAny` helper that did not exist,
which broke the whole page on load (dialog never opened, agree-check
8/8 fail). A `hasAny` helper was added; the agree-check then passed 8/8.

## Board facts

- 198 rows: 40 watchlist + 158 early (below the $50M floor).
- Board total $1,404.6M (was $3,464M under radar-2); top-1 share 3.3%
  (was 12.3%). Min implied $624,532; 0 rows at the 0.01 floor, 1 at the
  1.00 cap.
- Top 10: bitfi-basis $46.0M, steakhouse-financial $38.3M, sentora-curator
  $37.8M, gauntlet $29.8M, veda $29.7M, bittensor-dtao $28.7M,
  tori-finance $27.2M, axis $25.7M, usdd $24.8M, onre $22.5M.
- The old top 5 keep their order but at defensible values: steakhouse
  $425.2M → $38.3M (now near the only live Risk Curator's $35M market cap),
  sentora $409.2M → $37.8M, gauntlet $253.2M → $29.8M, veda $243.2M →
  $29.7M, usdd $167.4M → $24.8M. The new top 1, bitfi-basis, is priced on
  its own category (8 live Basis Trading peers, median 0.6544) at a size
  factor of 0.334, for $46.0M — well inside the category's live market-cap
  range (largest live Basis Trading market cap $1,209M).
- Watchlist slug saturn (Stablecoin Wrapper, $154.3M TVL) ranks 39 at $9.7M
  (was rank 34 at $20.5M) — it is covered because the exclusion rule is the
  house's own, not an extension of it.
- 24 live-token protocols set aside, by market cap.
- Peer table: 36 categories; market-wide median mcap/TVL 0.1691; size
  reference (median live TVL) $28,264,700.

## Screenshots

Taken with Playwright Chromium headless shell 159.0.8154.6 (installed via
`npx playwright install chromium`), viewport 1440×1000, from the built
dashboard in `/tmp/radar-out-v3`:

- `board.png` — 194,082 bytes. The ranked board, rows 1–9 visible; the peer
  column now shows differentiated multiples and size factors instead of one
  identical "0.17 market" down the top 5.
- `detail.png` — 268,157 bytes. The detail view for `#p=bitfi-basis` (the
  board's rank 1): 4-box model breakdown (TVL | peer median × size |
  growth × maturity | age), the fitted-size explanation, and farm-plan steps
  1–6 fully visible with step 7 starting; the dialog scrolls, and the
  honesty section is reachable below the fold.
- `filtered.png` — 175,784 bytes. The filtered view for `#category=Lending`
  (16 of 198 shown, ranks 43–107 — non-contiguous, proving a real filter).

Checker: `~/workspace/makefun/token-launch-radar-scratch/shots.mjs`.
Note: a navigation that changes only the hash does not reload the document,
so each view needs a fresh page (first attempt produced three identical
screenshots; fixed by one page per view).

Screenshot sizes sit below the 300–350 KB band aimed for in the design
(176–268 KB). The dashboard is a dark, mostly flat page, so it compresses
efficiently; nothing was padded to inflate the files.

## Known limits

- The screenshots are viewport shots (1440×1000), not full-page: the board's
  lower rows and the model panel sit below the fold, reachable by scrolling;
  the detail dialog's honesty section sits below the fold in its shot.
- The top of the board is concentrated in Basis Trading (7 of the top 20):
  its live median (0.6544 over 8 peers) is the highest of the well-populated
  categories, so its mid-size protocols rank high. That is what the snapshot's
  own figures say, and the peer table shows the 8 peers — but a judge who
  distrusts that one category median would rank the board lower.
- 113 of 198 rows are priced on the market-wide median (26 of 36 categories
  have fewer than 5 live peers). The size term differentiates them, but the
  category signal itself is still the global number for most of the board.
- The entry has not been submitted: no GitHub repo, no transcripts bundle,
  no make.fun submission. See README for the remaining steps.
