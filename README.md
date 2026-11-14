# Token Radar — a make.fun `token-radar-01` entry

The protocols with no token yet, ranked by what a launch would be worth.

## The model

Every protocol is priced like its live-token peers, from the snapshot's own
figures — no name is ever special-cased:

```
implied = TVL × peer × (1 + clamp(7d, −50, 100) / 100 × 0.5) × (0.7 + min(age, 730) / 730 × 0.3)
```

- **peer** — the median market-cap / TVL of the live-token protocols in the
  same category, when that category has at least 5 live peers; otherwise the
  market-wide median (0.1691 on this snapshot). Clamped to 0.05–1.00, so no
  launch is priced above its own TVL on a market-cap basis and no category is
  priced on one thin outlier.
- **growth** — the 7-day TVL change, clamped to −50…+100% and half-weighted.
- **maturity** — 0.7 at listing, rising to 1.0 after 730 days with no token;
  a protocol with no listing date is priced at 365 days.

A protocol is **pre-token** when the snapshot records no token for it: no
market cap, no CoinGecko id, no symbol. The board ranks every pre-token
protocol the house's rule allows — exchanges, bridges, liquid-staking and
restaking products, versioned pools and wrapped/staked names are left out —
including all 40 watchlist slugs and every other rankable protocol below the
$50M floor. Live-token protocols are set aside and shown as the market's own
values, never mixed into the ranking.

Each row carries a seven-step farm plan, derived from the protocol's category,
chain, TVL and age. The plan never claims a points program exists: it tells
the reader to check the protocol's own page and to claim only from the link
that page publishes.

## The dashboard

`dashboard/` is a static page — no framework, no fetch, no network. It reads
`data.js`, written by `main.ts` from the same board as `board.json`, and it
recomputes every implied value in the page from the snapshot's own figures, so
the board and the code agree. It has a searchable, sortable, filterable board,
a per-protocol detail view (model breakdown + farm plan), a live-token view,
the full peer table, and a model sandbox that re-ranks the board live under
different constants.

Deep links: `#q=` search, `#category=`, `#chain=`, `#wl=1`, `#tab=live`,
`#p=<slug>` for a detail view.

## Run it

Node 22, standard library only, no dependencies:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Inside the grader's container the program reads `/input/snapshot.json` and
writes `/output`. The run is deterministic: the same snapshot always produces
the same `board.json`, `data.js` and `dossier.json`, byte for byte.

## Validation

See `VALIDATION.md` for the validation run: the kit's gate checks, the
determinism check (two runs byte-identical), the code/data agreement check
(the dashboard's recomputation lands on the same dollar as `board.json`), and
the screenshot measurements.

## Files

- `main.ts` — the entrypoint: reads the snapshot, writes the board, the
  dashboard data, the dashboard files and the dossier.
- `lib/model.ts` — the model: peer table, implied value, the board, farm
  plans, snapshot parsing and the board's own gate checks.
- `vendor/makefun-board.ts` — the make.fun library, vendored from the kit
  (builds the dossier the judge reads).
- `dashboard/` — the static dashboard: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the three screenshots: the board, a detail view, a
  filtered view.
