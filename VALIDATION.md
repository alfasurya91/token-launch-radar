# Validation — token-radar-01 entry

Run 2026-11-14 ~10:29 WIB (Asia/Jakarta) against the kit's sealed snapshot
(`input/snapshot.json`: as_of 2026-11-14, 758 protocols, watchlist 40, floor
$50,000,000). Node v24.22.1. Build command:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/radar-out node main.ts --input <snapshot.json>
```

## The gate (all 8 pass)

Independent checker: `~/workspace/makefun/token-launch-radar-scratch/gate-check.mjs`
(it re-implements the gate from RULES.txt; it does not reuse the entry's code
except the vendored `buildDossier`, which is the gate's own reference).

| Check | Result |
|---|---|
| dashboard_files | PASS — 3 files, 36,573 bytes, html+css+js present, no http(s):// in attributes, url(), @import or imports |
| dashboard_source_under_64k | PASS — 36,573 bytes (dossier text cap) |
| board_file | PASS — 198 rows, 358,938 bytes, 0 invalid rows |
| sorted_by_value | PASS — ranks 1..198, implied non-increasing, not all equal (198 distinct values) |
| coverage | PASS — 40/40 watchlist slugs present |
| farm_steps | PASS — 198 rows, 1,386 steps, all 7 steps, 20–600 chars each |
| screenshots | PASS — 3 PNGs, 1440×900 each, 153–233 KB (cap 512 KiB), long side 1440, short side 900 |
| dossier_matches | PASS — byte-identical rebuild of dossier.json, 771,148 bytes (cap 1.5 MiB) |

## Kit's own check (`makefun check --worktree`)

- pass competition_open — now is between opening 2026-11-14T10:00:00Z and
  deadline 2026-12-14T10:00:00Z.
- pass snapshot — 11 files, 640,922 bytes, within the intake caps.
- pass license_osi — LICENSE declares `SPDX-License-Identifier: MIT`.
- pass entrypoint — main.ts at the root selects node22.
- skip strategy_note — the contest does not ask for one.
- **FAIL transcripts_present — expected: no transcripts bundled yet. That is a
  submission-step item (bundle the build sessions at submit time).**
- The remaining items (repo_public, repo_owner, repo_created_after_open,
  commit_in_repo, duplicate_snapshot) are checked at submission, not locally.

## Determinism

Two full runs into two directories, `diff -r`: byte-identical across
board.json, data.js, dossier.json, dashboard/ and screenshots/. Runtime
~0.25 s per run (limit 120 s).

## Code / data agreement

The dashboard recomputes every implied value in the page from the snapshot's
own figures (TVL × the row's peer multiple × growth × maturity) and compares
it with the value board.json carries. Checked live in a headless browser for
7 sampled rows (ranks 1, 4, 5, 6, 29, 34, 74, incl. saturn): all 7 land on
the same dollar. Checker:
`~/workspace/makefun/token-launch-radar-scratch/agree-check.mjs`.

## Board facts

- 198 rows: 40 watchlist + 158 early (below the $50M floor).
- Top 5: steakhouse-financial $425.2M, sentora-curator $409.2M, gauntlet
  $253.2M, veda $243.2M, usdd $167.4M.
- Watchlist slug saturn (Stablecoin Wrapper, $154.3M TVL) ranks 34 at $20.5M —
  it is covered because the exclusion rule is the house's own, not an
  extension of it.
- 24 live-token protocols set aside, by market cap.
- Peer table: 36 categories; market-wide median mcap/TVL 0.1691.

## Screenshots

Taken with Playwright Chromium headless shell 159.0.8154.6 (installed via
`npx playwright install chromium`), viewport 1440×900, from the built
dashboard in `/tmp/radar-out`:

- `board.png` — the ranked board (198 rows).
- `detail.png` — the detail view for `#p=steakhouse-financial` (model
  breakdown + 7-step farm plan; dialog scrolls, honesty section reachable).
- `filtered.png` — the filtered view for `#category=Lending` (16 rows).

Checker: `~/workspace/makefun/token-launch-radar-scratch/shots.mjs`.
Note: a navigation that changes only the hash does not reload the document,
so each view needs a fresh page (first attempt produced three identical
screenshots; fixed by one page per view).

## Known limits

- The screenshots are viewport shots (1440×900), not full-page: the board's
  lower rows and the model panel sit below the fold, reachable by scrolling.
- The entry has not been submitted: no GitHub repo, no transcripts bundle,
  no make.fun submission. See README for the remaining steps.
