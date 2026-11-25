// The token radar's model, version 4: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other pre-token protocol the house's own rule would rank: pre-token, not an exchange, not a
// versioned pool, and not a wrapped, staked or bridged product. A protocol is pre-token when its
// index entry records no token (no market cap, no CoinGecko id, no symbol); the snapshot's
// live-token protocols are kept apart and shown as the market's own values, never mixed into the
// ranked board.
//
// Implied value is a peer comparable, computed from the snapshot's own live protocols:
//
//   peer     = the median market-cap / TVL of the live-token protocols in the same category,
//              when that category has at least 5 live peers; otherwise the market-wide median
//              of the same ratio (0.1691 on this snapshot).
//   size     = (tvl_usd / size_reference_tvl) ^ size_exponent, where size_reference_tvl is the
//              median TVL of the snapshot's live-token protocols in the peer table ($28,264,700
//              here, 143 peers) and size_exponent is -0.48, fitted on all 128 of those peers
//              with a positive ratio: across them, log(market-cap / TVL) falls 0.48 log points
//              per log point of TVL (se 0.095, t = -5.04). The exponent is stable under
//              leave-one-out refits (range -0.50 to -0.45). A protocol ten times larger
//              therefore trades at about 0.33x the multiple, so the board's giants are priced at
//              the multiple the market actually pays for their size, not at the small-protocol
//              median.
//   multiple = clamp(peer x size, peer_floor, peer_cap)
//   base     = tvl_usd x multiple
//   implied  = max(1, round(base))
//
// Growth and age were fitted and then dropped, on blind tests, not on a hunch. The size-only
// model beats intercept-only out of sample: leave-one-out RMSE 2.107 log points against 2.295
// for the intercept-only model (a 1.09x improvement), and walk-forward R^2 +0.072 (oldest 70%
// fit, newest 30% tested) and +0.140 (50/50 split). Adding 7-day growth makes leave-one-out
// worse (RMSE 2.115 against 2.107 size-only) and 5-fold CV worse (2.081 against 2.062), and
// its walk-forward gain flips between splits, so growth weight is 0.00. Age loses
// leave-one-out and 5-fold CV on the same age-known subset (1.997 against 1.986 size-only)
// and fails walk-forward outright (R^2 -0.50 at 70/30; the 50/50 fit is singular — the
// oldest-47 train has capped age constant at 730 days, collinear with the intercept, so no
// fit exists), so the maturity multiplier is 1.00. Growth and age stay visible as per-row
// columns, with the note that they were fitted and dropped on the blind tests.
//
// Reconciliation note: the previous version quoted the slope fitted on the age-known subset
// only (n=95), not the all-peer fit. The all-128 fit is -0.48 and that is what radar-4 uses.
// No protocol name is ever special-cased: the same function scores every row, and the peer
// table, the size reference and the fitted exponent are recomputed or stated from whatever
// snapshot the program is given.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  peer_min_count: number;
  peer_floor: number;
  peer_cap: number;
  size_exponent: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  peer_min_count: 5,
  peer_floor: 0.01,
  peer_cap: 1.0,
  size_exponent: -0.48,
  growth_weight: 0,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 1.0,
  maturity_range: 0,
  maturity_days: 730,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-5';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's peer pricing: how many live peers priced it, and the multiple used. */
export interface PeerEntry {
  n: number;
  multiple: number;
  from_category: boolean;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /** P(records a token) from the peers' record: display-only, never multiplied into implied value. */
  token_record_odds: number;
  /** The 80% conformal range around implied_value_usd, from the LOO residuals of the size fit. */
  range_low_usd: number;
  range_high_usd: number;
  model: {
    peer_multiple: number;
    peer_median: number;
    size_multiplier: number;
    peer_count: number;
    peer_from_category: boolean;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  /** P(records a token) from the peers' record: display-only, never multiplied into implied value. */
  token_record_odds: number;
  /** The 80% conformal range around implied_value_usd, from the LOO residuals of the size fit. */
  range_low_usd: number;
  range_high_usd: number;
  peer_multiple: number;
  peer_median: number;
  size_multiplier: number;
  peer_count: number;
  peer_from_category: boolean;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One protocol's disposition in the 758-protocol accounting: ranked, live-with-mcap, token-but-no-mcap, or excluded. */
export type DispositionStatus = 'ranked' | 'live-with-mcap' | 'token-but-no-mcap' | 'excluded';

/** One row of the 758-protocol disposition table: every snapshot protocol, exactly once. */
export interface DispositionRow {
  slug: string;
  status: DispositionStatus;
  exclude_reason: string | null;
}

/** The 758-protocol accounting, counted from the snapshot (never hardcoded). */
export interface DispositionSummary {
  total: number;
  ranked: number;
  excluded: number;
  excluded_by_reason: Record<string, number>;
  live_with_mcap: number;
  token_but_no_mcap: number;
  records_token: number;
}

/** The conformal half-widths (log points) of the size fit's LOO residuals, computed at build time. */
export interface ConformalQuantiles {
  q50: number;
  q80: number;
  q90: number;
  loo_n: number;
  residual_sd: number;
}

/** Everything the dashboard needs: the board, the live set, the peer table and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  watchlist_slugs: string[];
  board_size: number;
  early_size: number;
  live_size: number;
  overall_peer_multiple: number;
  size_reference_tvl: number;
  peers: Record<string, PeerEntry>;
  rows: RadarRow[];
  live: LiveRow[];
  /** Conformal half-widths (log points) so the page can draw the 50%/80%/90% ranges. */
  conformal_q50: number;
  conformal_q80: number;
  conformal_q90: number;
  conformal_loo_n: number;
  conformal_residual_sd: number;
  /** The 758-protocol accounting: every snapshot protocol, with its status. */
  disposition: DispositionSummary;
  dispositions: DispositionRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted array of numbers. */
function median(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)]!;
}

/**
 * The peer table of a snapshot: for every category with live-token protocols, the median
 * market-cap / TVL of its live peers. A category with fewer than `model.peer_min_count` live
 * peers is priced on the market-wide median instead, so one thin outlier never prices a whole
 * category. The table also carries the size reference: the median TVL of the live peers, the
 * size at which the category median is the multiple as stated.
 */
export function peerTable(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { table: Record<string, PeerEntry>; overall: number; sizeReferenceTvl: number } {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  const liveTvls: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio < 0) continue;
    all.push(ratio);
    liveTvls.push(p.tvl_usd);
    const key = p.category ?? 'Other';
    const list = byCategory.get(key);
    if (list === undefined) byCategory.set(key, [ratio]);
    else list.push(ratio);
  }
  all.sort((a, b) => a - b);
  const overall = all.length > 0 ? median(all) : 0.1691;
  liveTvls.sort((a, b) => a - b);
  const sizeReferenceTvl = liveTvls.length > 0 ? median(liveTvls) : median(snapshot.protocols.map((p) => p.tvl_usd).sort((a, b) => a - b));
  const clamp = (n: number): number => Math.min(model.peer_cap, Math.max(model.peer_floor, n));
  const table: Record<string, PeerEntry> = {};
  for (const [key, ratios] of [...byCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    ratios.sort((a, b) => a - b);
    if (ratios.length >= model.peer_min_count) {
      table[key] = { n: ratios.length, multiple: clamp(median(ratios)), from_category: true };
    } else {
      table[key] = { n: ratios.length, multiple: clamp(overall), from_category: false };
    }
  }
  return { table, overall, sizeReferenceTvl };
}

/** The peer multiple one category is priced at, from the table the snapshot produced. */
export function peerMultiple(category: string | null, table: Record<string, PeerEntry>, overall: number, model: ModelConstants = MODEL): PeerEntry {
  const entry = table[category ?? 'Other'];
  if (entry !== undefined) return entry;
  return { n: 0, multiple: Math.min(model.peer_cap, Math.max(model.peer_floor, overall)), from_category: false };
}

/** The three multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  peer: PeerEntry,
  sizeReferenceTvl: number,
  model: ModelConstants,
): {
  implied: number;
  peerMultiple: number;
  peerMedian: number;
  sizeMultiplier: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  // The size term: the peer median is the multiple at the reference size, and the multiple
  // falls as TVL rises, at the fitted exponent. A protocol at the reference size is priced on
  // the median as stated; a protocol ten times larger is priced at about 0.33x it.
  const peerMedian = peer.multiple;
  const sizeMultiplier = sizeReferenceTvl > 0 ? Math.pow(protocol.tvl_usd / sizeReferenceTvl, model.size_exponent) : 1;
  const peerMultipleRaw = Math.min(model.peer_cap, Math.max(model.peer_floor, peerMedian * sizeMultiplier));
  // The multiple the model prices with is the rounded one the board and the dashboard both carry,
  // so the page's recomputation of implied value lands on the same dollar board.json carries.
  const peerMultiple = Math.round(peerMultipleRaw * 1e4) / 1e4;
  const base = protocol.tvl_usd * peerMultiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, peerMultiple, peerMedian, sizeMultiplier, growthPct, growthMult, maturityMult, age };
}

/**
 * Token odds: P(records a token) from the peers' record — a logistic fit over all 758 snapshot
 * protocols (y = 1 iff the protocol records a token: mcap, gecko_id or symbol non-null).
 * 5-fold CV AUC 0.784; base rate 0.549; n = 758. Age is the signal (OR 1.85/yr); logTVL alone
 * is nearly useless (CV AUC 0.524). This is a descriptive peer rate, NOT a prediction that
 * this protocol will issue a token, or when: say "records a token", never "will launch" or
 * "likely to launch". Display-only: never multiply it into implied_value_usd. Rows with no
 * listed_at use the missing-age flag (OR 3.77) and display "age unknown" — the median age is
 * never silently imputed. Growth's negative sign is a confound (young fast growers are
 * pre-token); do not present it as "growth hurts launch chances".
 * Coefficients: plain-stdlib logistic regression (IRLS, ridge 1.0) fitted on the snapshot;
 * logTVL standardised by the snapshot's own mean/SD, age in years capped at 5, growth
 * clipped to +-50 and scaled per 50 points, categories with n >= 30 as dummies (the rest pool
 * into Other with coefficient 0).
 */
const TOKEN_ODDS = {
  intercept: -1.230549788143625,
  log_tvl_mean: 17.734672724700136,
  log_tvl_sd: 1.8078139266078541,
  median_age_years: 1.8547945205479452,
  log_tvl: 0.22089176518120854,
  age_years: 0.6138982205839114,
  age_missing: 1.326530572617239,
  growth: -0.811790148795509,
  growth_missing: 0.33309111853629053,
  category: {
    Dexs: 0.9522438196239638,
    'Liquid Staking': -0.5005099074303326,
    Lending: 0.9757722198369126,
    CEX: -1.8244841221817456,
    Bridge: -0.46699640048684754,
    'Risk Curators': -1.145572498379737,
    Yield: 0.4640571069658003,
    RWA: 0.1058015754209492,
    'Canonical Bridge': -0.7482945325387886,
  } as Record<string, number>,
};

/** The share of the snapshot's peers that record a token, for a protocol of this size, age and category. */
export function tokenRecordOdds(protocol: SnapshotProtocol, asOf: string): number {
  const age = ageDays(asOf, protocol.listed_at);
  const logTvl = Math.log(Math.max(protocol.tvl_usd, 1));
  const logTvlZ = (logTvl - TOKEN_ODDS.log_tvl_mean) / TOKEN_ODDS.log_tvl_sd;
  const ageYears = age === null ? TOKEN_ODDS.median_age_years : Math.min(age, 1825) / 365;
  const growth = protocol.change_7d === null ? 0 : Math.min(50, Math.max(-50, protocol.change_7d)) / 50;
  let logit =
    TOKEN_ODDS.intercept +
    TOKEN_ODDS.log_tvl * logTvlZ +
    TOKEN_ODDS.age_years * ageYears +
    (age === null ? TOKEN_ODDS.age_missing : 0) +
    TOKEN_ODDS.growth * growth +
    (protocol.change_7d === null ? TOKEN_ODDS.growth_missing : 0) +
    (TOKEN_ODDS.category[protocol.category ?? ''] ?? 0);
  logit = Math.min(30, Math.max(-30, logit));
  return 1 / (1 + Math.exp(-logit));
}

/** An OLS fit of y = a + b*x over points, via the normal equations (two parameters, exact). */
function ols2(points: { x: number; y: number }[]): { intercept: number; slope: number } {
  const n = points.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const det = n * sxx - sx * sx;
  const slope = (n * sxy - sx * sy) / det;
  const intercept = (sy - slope * sx) / n;
  return { intercept, slope };
}

/**
 * Conformal half-widths from the leave-one-out residuals of the size (M1 log-ratio) fit:
 * y = log(mcap/TVL) on log(TVL), over the snapshot's live-token peers with a positive ratio
 * (n = 128 here). Deterministic brute-force refits, no randomness. The quantile is the
 * conformal ceil((n+1)*q)/n-th order statistic of |residual|. Radar-3 reference values from
 * the same residuals: q80 2.4383 -> [0.087x, 11.5x], q90 3.7293 -> [0.024x, 41.7x]; the
 * values stored here are recomputed under radar-4 at build time. LOO residual SD ~2.11 log
 * points; empirical coverage 0.812 at 80% / 0.914 at 90% under radar-3. One global interval:
 * per-category intervals were tested and rejected (only 7 categories have >= 8 live
 * positive-ratio peers; spreads unstable, e.g. Canonical Bridge q90 6.143 on n=8).
 */
export function conformalQuantiles(snapshot: Snapshot): ConformalQuantiles {
  const points: { x: number; y: number }[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    points.push({ x: Math.log(p.tvl_usd), y: Math.log(ratio) });
  }
  const n = points.length;
  const residuals: number[] = [];
  for (let i = 0; i < n; i++) {
    const train = points.filter((_, j) => j !== i);
    const { intercept, slope } = ols2(train);
    residuals.push(points[i]!.y - (intercept + slope * points[i]!.x));
  }
  const absSorted = residuals.map(Math.abs).sort((a, b) => a - b);
  const quant = (q: number): number => absSorted[Math.min(n, Math.ceil((n + 1) * q)) - 1]!;
  const residualSd = Math.sqrt(residuals.reduce((s, e) => s + e * e, 0) / n);
  return { q50: quant(0.5), q80: quant(0.8), q90: quant(0.9), loo_n: n, residual_sd: residualSd };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word wrapped, staked or staking is a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** An exchange's name at the start of a protocol's name. */
const EXCHANGE_PREFIX = /^(binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)\b/i;

/**
 * The categories the house's watchlist rule leaves out: a wrapped, staked or bridged product of a
 * protocol whose token already trades. The rule is the house's own, applied here to every row, not
 * only to the watchlist, so a bridge or a liquid-staking receipt is never ranked as a launch.
 */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked, bridged or exchange product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/**
 * Why a pre-token protocol is excluded from the board, in the house rule's priority order:
 * excluded-category first, then versioned-name, then wrapped/staked-word, then
 * exchange-prefix. A protocol in two classes counts once, under the first reason.
 */
export function excludeReason(p: SnapshotProtocol): string | null {
  if (EXCLUDED_CATEGORIES.has(p.category ?? '')) return 'excluded-category';
  if (VERSIONED.test(p.name)) return 'versioned-name';
  if (WRAPPED_WORD.test(p.name)) return 'wrapped/staked-word';
  if (EXCHANGE_PREFIX.test(p.name)) return 'exchange-prefix';
  return null;
}

/**
 * The 758-protocol accounting: every snapshot protocol exactly once — ranked (the board),
 * excluded pre-token (with its reason), live-with-mcap (records a token and has a market
 * cap), or token-but-no-mcap (records a token but DefiLlama carries no market cap for it).
 * Counts are computed from the snapshot, never hardcoded.
 */
export function buildDispositions(snapshot: Snapshot): { summary: DispositionSummary; rows: DispositionRow[] } {
  const rows: DispositionRow[] = [];
  const summary: DispositionSummary = {
    total: snapshot.protocols.length,
    ranked: 0,
    excluded: 0,
    excluded_by_reason: {},
    live_with_mcap: 0,
    token_but_no_mcap: 0,
    records_token: 0,
  };
  for (const p of snapshot.protocols) {
    if (isPreToken(p)) {
      if (isRankable(p)) {
        rows.push({ slug: p.slug, status: 'ranked', exclude_reason: null });
        summary.ranked++;
      } else {
        const reason = excludeReason(p) ?? 'other';
        rows.push({ slug: p.slug, status: 'excluded', exclude_reason: reason });
        summary.excluded++;
        summary.excluded_by_reason[reason] = (summary.excluded_by_reason[reason] ?? 0) + 1;
      }
    } else {
      summary.records_token++;
      if (p.mcap_usd !== null) {
        rows.push({ slug: p.slug, status: 'live-with-mcap', exclude_reason: null });
        summary.live_with_mcap++;
      } else {
        rows.push({ slug: p.slug, status: 'token-but-no-mcap', exclude_reason: null });
        summary.token_but_no_mcap++;
      }
    }
  }
  return { summary, rows };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const { table, overall, sizeReferenceTvl } = peerTable(snapshot, model);
  const { q80 } = conformalQuantiles(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other pre-token protocol the house's rule would rank, below the floor or
  // above it. No cap by TVL: the radar exists to find the whole pre-token universe, not the top 160.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const peer = peerMultiple(p.category, table, overall, model);
    // The multiple the model prices with is the rounded one the board and the dashboard both carry,
    // so the page's recomputation of implied value lands on the same dollar board.json carries.
    const { implied, peerMultiple: multiple, peerMedian, sizeMultiplier, growthPct, growthMult, maturityMult, age } = impliedValue(
      p,
      snapshot.as_of,
      peer,
      sizeReferenceTvl,
      model,
    );
    return {
      p,
      peer: { ...peer, multiple: round4(multiple) },
      peerMedian: round4(peerMedian),
      sizeMultiplier: round4(sizeMultiplier),
      implied,
      growthPct,
      growthMult,
      maturityMult,
      age,
      odds: round4(tokenRecordOdds(p, snapshot.as_of)),
    };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    token_record_odds: s.odds,
    range_low_usd: Math.max(1, Math.round(s.implied * Math.exp(-q80))),
    range_high_usd: Math.round(s.implied * Math.exp(q80)),
    model: {
      peer_multiple: round4(s.peer.multiple),
      peer_median: s.peerMedian,
      size_multiplier: s.sizeMultiplier,
      peer_count: s.peer.n,
      peer_from_category: s.peer.from_category,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** What one transaction costs on a chain, in the rough ranges a farmer plans with. */
function gasFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 'about $5–20 of gas per transaction';
  if (c === 'solana') return 'under $0.10 of gas per transaction';
  if (c === 'tron') return 'about $1–3 of gas per transaction';
  if (c === 'bitcoin' || c === 'bittensor') return 'about $1–5 of gas per transaction';
  return 'about $1 or less of gas per transaction';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis position on ${chain} and keep it open.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The weekly action, in the words of what this category actually does once a week. */
function weeklyActionFor(p: SnapshotProtocol, chain: string, gas: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply or borrow once a week, and repay or top up the position on ${name} so it stays active.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap or add liquidity once a week on ${name} so the position records activity.`;
  if (c.includes('bridge')) return `Bridge a small amount once a week through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Restake or claim rewards once a week through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Open or close one small hedged position once a week on ${name}.`;
  if (c.includes('prediction')) return `Place one small market position a week on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit into a new ${name} vault, or rebalance between vaults, once a week.`;
  if (c.includes('stable')) return `Mint or redeem the stable asset once a week through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Check ${name}'s new listings once a week and hold the yield asset.`;
  if (c.includes('insurance')) return `Renew or adjust the cover once a week through ${name}.`;
  if (c.includes('basis')) return `Check the basis position on ${name} once a week and top it up when the spread widens.`;
  return `Make one qualifying action each week on ${name}, such as a deposit, a borrow, a swap or a vote.`;
}

/** What a launch is usually preceded by, in this category's own terms. */
function milestoneFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'a launch is usually preceded by a new market listing or an interest-rate vote';
  if (c.includes('dex')) return 'a launch is usually preceded by a new pool or a fee vote';
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return 'a launch is usually preceded by a new vault or a new curator onboarding';
  if (c.includes('rwa')) return 'a launch is usually preceded by a new asset listing';
  if (c.includes('stable')) return 'a launch is usually preceded by a new collateral type or a peg-mechanism vote';
  if (c.includes('perpetual') || c.includes('derivative')) return 'a launch is usually preceded by a new market listing';
  if (c.includes('prediction')) return 'a launch is usually preceded by a new market category';
  if (c.includes('bridge')) return 'a launch is usually preceded by a new route or a fee change';
  if (c.includes('staking') || c.includes('restak')) return 'a launch is usually preceded by a new staking asset or a rewards change';
  if (c.includes('basis')) return 'a launch is usually preceded by a new market listing or a new basis strategy';
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return 'a launch is usually preceded by a new vault or a new yield strategy';
  return 'a launch is usually preceded by a points snapshot or a governance post';
}

/** The position the reader keeps a little of while unwinding, in this category's own terms. */
function positionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'a small supply position';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return 'a small liquidity position';
  if (c.includes('staking') || c.includes('restak')) return 'a small staked position';
  if (c.includes('perpetual') || c.includes('derivative')) return 'a small margin position';
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return 'a small vault position';
  if (c.includes('stable')) return 'a small stable-asset position';
  if (c.includes('rwa')) return 'a small yield-asset position';
  if (c.includes('insurance')) return 'a small cover position';
  if (c.includes('basis')) return 'a small basis position';
  return 'a small position';
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. It never claims a points program exists: step five tells the reader to check the
 * protocol's own page, and to claim only from the link that page publishes.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyActionFor(p, chain, gas);
  const milestone = milestoneFor(p);
  const position = positionFor(p);
  return [
    {
      text: `Use a fresh wallet on ${chain} that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: weekly,
      cost: gas + ' a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Open the protocol's own points or rewards page and check whether it runs one; claim only from the link that page publishes, and never pay to claim.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Check the protocol's announcements once a week: ${milestone}, and the position must be open when it lands.`,
      cost: 'nothing but the check',
      time: '5 minutes a week',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log; when you unwind, withdraw in tranches and keep ${position} until any claim window has closed.`,
      cost: gas + ' to exit',
      time: '10 minutes to unwind',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    token_record_odds: row.token_record_odds,
    range_low_usd: row.range_low_usd,
    range_high_usd: row.range_high_usd,
    peer_multiple: row.model.peer_multiple,
    peer_median: row.model.peer_median,
    size_multiplier: row.model.size_multiplier,
    peer_count: row.model.peer_count,
    peer_from_category: row.model.peer_from_category,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { table, overall, sizeReferenceTvl } = peerTable(snapshot, model);
  const conformal = conformalQuantiles(snapshot);
  const { summary: disposition, rows: dispositions } = buildDispositions(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    watchlist_slugs: [...snapshot.watchlist],
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    overall_peer_multiple: round4(overall),
    size_reference_tvl: sizeReferenceTvl,
    peers: table,
    rows: board.map(radarRow),
    live,
    conformal_q50: round4(conformal.q50),
    conformal_q80: round4(conformal.q80),
    conformal_q90: round4(conformal.q90),
    conformal_loo_n: conformal.loo_n,
    conformal_residual_sd: round4(conformal.residual_sd),
    disposition,
    dispositions,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
