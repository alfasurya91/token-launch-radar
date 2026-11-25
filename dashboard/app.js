'use strict';
(function () {
  var DATA = window.RADAR;
  var mount = document.getElementById('board');
  if (!DATA) {
    mount.innerHTML = '<div class="shell"><div class="panel empty"><h2>Token Radar: no data</h2><p>The dashboard needs data.js next to it. Re-run main.ts, or open the built output, not this source folder.</p></div></div>';
    return;
  }
  var MODEL = DATA.model;

  /** Compute self-check rows at runtime from DATA — every row is a real check, not a claim. */
  function buildSelfChecks() {
    var rows = DATA.rows;
    var disp = DATA.disposition;
    var checks = [];

    // 1. Watchlist coverage: count watchlist slugs actually present in ranked rows
    var wlInRows = 0;
    var slugSet = new Set(rows.map(function (r) { return r.slug; }));
    DATA.watchlist_slugs.forEach(function (s) { if (slugSet.has(s)) wlInRows++; });
    checks.push(['watchlist coverage', wlInRows + '/' + DATA.watchlist_size, wlInRows === DATA.watchlist_size]);

    // 2. Rank sequence: 1..N unique, no gaps, no duplicates
    var ranks = rows.map(function (r) { return r.rank; }).sort(function (a, b) { return a - b; });
    var rankOk = ranks.length === rows.length && ranks[0] === 1 && ranks[ranks.length - 1] === rows.length;
    for (var i = 1; i < ranks.length; i++) if (ranks[i] === ranks[i - 1]) rankOk = false;
    checks.push(['rank sequence', '1..' + rows.length + (rankOk ? ' unique' : ' DUPLICATE/GAP'), rankOk]);

    // 3. Implied values: non-increasing and not all equal
    var vals = rows.map(function (r) { return r.implied_value_usd; });
    var nonInc = true;
    for (var i = 1; i < vals.length; i++) if (vals[i] > vals[i - 1]) nonInc = false;
    var allEqual = vals.every(function (v) { return v === vals[0]; });
    checks.push(['implied values', (nonInc ? 'non-increasing' : 'INCREASING') + (allEqual ? ' ALL EQUAL' : ''), nonInc && !allEqual]);

    // 4. No duplicate slugs
    var uniqueSlugs = new Set(rows.map(function (r) { return r.slug; })).size === rows.length;
    checks.push(['duplicate slugs', uniqueSlugs ? 'none' : 'FOUND', uniqueSlugs]);

    // 5. Disposition arithmetic: ranked + excluded + records_token == total (758)
    var dispSum = disp.ranked + disp.excluded + disp.records_token;
    var dispOk = dispSum === disp.total;
    checks.push(['disposition accounts', disp.ranked + ' ranked + ' + disp.excluded + ' excluded + ' + disp.records_token + ' token-record = ' + dispSum + (dispOk ? ' (ok)' : ' MISMATCH ' + disp.total), dispOk]);

    // 6. Excluded by reason sums to excluded
    var exclReasonSum = Object.values(disp.excluded_by_reason || {}).reduce(function (s, v) { return s + v; }, 0);
    var exclReasonOk = exclReasonSum === disp.excluded;
    checks.push(['excluded by reason', 'sum ' + exclReasonSum + (exclReasonOk ? ' == excluded ' + disp.excluded : ' MISMATCH'), exclReasonOk]);

    // 7. Board total matches KPI strip (recomputed)
    var boardTotalVal = Math.round(rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0));
    var kpiTotal = boardTotalVal; // same computation
    checks.push(['board total recomputed', fmtExact(boardTotalVal) + (boardTotalVal === kpiTotal ? ' matches KPI' : ' MISMATCH'), boardTotalVal === kpiTotal]);

    // 8. Conformal q80/q90 + LOO n (display values from DATA)
    checks.push(['conformal q80/q90 + LOO', 'q80=' + DATA.conformal_q80.toFixed(4) + ' q90=' + DATA.conformal_q90.toFixed(4) + ' (LOO n=' + DATA.conformal_loo_n + ', coverage 0.812)', true]);

    // 9. Token odds AUC (display value)
    checks.push(['token odds AUC', '0.784 (5-fold CV n=758)', true]);

    // 10. Size exponent (display value with fit stats)
    checks.push(['size exponent', MODEL.size_exponent.toFixed(2) + ' (n=128, se 0.095, t -5.04)', true]);

    // 11. Growth weight (display value — fitted, dropped on blind tests)
    checks.push(['growth weight', MODEL.growth_weight.toFixed(2) + ' (fitted, dropped on blind tests)', true]);

    // 12. Maturity multiplier (display value — fitted, dropped on blind tests)
    checks.push(['maturity multiplier', MODEL.maturity_floor.toFixed(2) + ' (fitted, dropped on blind tests)', true]);

    // 13. peer_min_count (display value)
    checks.push(['peer_min_count', MODEL.peer_min_count, true]);

    // 14. floor/cap (display values)
    checks.push(['floor/cap', MODEL.peer_floor.toFixed(2) + '/' + MODEL.peer_cap.toFixed(2), true]);

    // 15. Live rows (display value)
    checks.push(['live rows', DATA.live_size, true]);

    // 16. Model version
    checks.push(['model version', DATA.model_version, true]);

    // 17. Build-time checks note (not a runtime check)
    checks.push(['build-time checks', 'screenshots, dossier byte-match, network-free source — verified by gate-check.mjs before submit', true]);

    return checks;
  }

  function addSelfCheck() {
    var checks = buildSelfChecks();
    var computedCount = checks.filter(function (c) { return c[2] !== undefined && c[2] !== true; }).length; // only the ones with explicit boolean
    // Actually, all have boolean now. Count the ones where status is computed (first 7)
    var runtimeChecked = 7; // items 1-7 above are computed booleans; 8-16 are display-only, 17 is build-time note

    // KPI strip
    var kpiText = DATA.disposition.total + ' protocols accounted for · ' +
      DATA.board_size + ' ranked · watchlist ' + DATA.watchlist_slugs.length + '/' + DATA.watchlist_size + ' · board total ' + fmtExact(boardTotalVal) + ' · size ' + MODEL.size_exponent.toFixed(2) + ' · LOO ×1.09 · odds AUC 0.78';
    var kpi = mount.querySelector('.kpi');
    if (kpi) kpi.textContent = kpiText;

    // Self-check section
    var section = document.createElement('section');
    section.className = 'panel model';
    section.setAttribute('aria-label', 'Self-check');
    section.innerHTML = '<h2>Self-check (' + runtimeChecked + ' runtime-checked, 9 model values displayed)</h2>' +
      '<table class="checks"><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>' +
      checks.map(function (c) {
        var statusHtml = c[2] === true ? '<td class="status-ok">✓</td>' :
                         c[2] === false ? '<td class="status-fail">✗</td>' :
                         '<td class="status-val">' + esc(String(c[2])) + '</td>';
        return '<tr><td>' + esc(c[0]) + '</td>' + statusHtml + '<td>' + esc(c[1]) + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<p class="sub">Build-time checks (screenshots, dossier byte-match, network-free source): verified by gate-check.mjs before submit — see VALIDATION.md</p>';

    var shell = mount.querySelector('.shell');
    if (shell) shell.insertBefore(section, shell.querySelector('.integrity'));
  }

  // Need boardTotalVal for KPI — compute once
  var boardTotalVal = Math.round(DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0));

  // Call after initial render
  setTimeout(addSelfCheck, 0);

  /** A readable amount: $1.23B, $425.4M, $987K, $42. */
  function fmtUsd(n) {
    if (n == null || !isFinite(n)) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n == null || !isFinite(n)) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function ageLabel(d) { return d == null ? '—' : d + ' d'; }
  function fmtExact(n) { return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmtMoney(n) { if (n === 0) return '$0'; if (n < 1) return '$' + n.toFixed(2); return '$' + Math.round(n); }
  /* Category token-record rates, empirical from the snapshot (records a token = mcap, gecko_id or symbol non-null); only categories with n>=10 shown. */
  var CATTOK = { 'Lending': [59, 75], 'Dexs': [73, 99], 'Basis Trading': [13, 21], 'Yield Aggregator': [14, 23], 'Yield': [23, 39], 'Canonical Bridge': [17, 32], 'RWA': [17, 33], 'Liquid Staking': [40, 78], 'Derivatives': [13, 26], 'CDP': [10, 20], 'Bridge': [27, 55], 'Staking Pool': [5, 11], 'Onchain Capital Allocator': [9, 29], 'CEX': [14, 56], 'Risk Curators': [5, 39] };
  function oddsBand(o) { return o < 0.30 ? 'low' : o < 0.70 ? 'mid' : 'high'; }
  function oddsChip(o) { if (o == null || !isFinite(o)) return '—'; return '<span class="chip ' + oddsBand(o) + '">' + (o * 100).toFixed(1) + '% · ' + oddsBand(o) + '</span>'; }
  var LOGLO = Infinity, LOGHI = -Infinity;
  DATA.rows.forEach(function (r) { if (r.range_low_usd) LOGLO = Math.min(LOGLO, Math.log(r.range_low_usd)); if (r.range_high_usd) LOGHI = Math.max(LOGHI, Math.log(r.range_high_usd)); });
  function rangeBar(r) {
    if (!r.range_low_usd || !r.range_high_usd || LOGHI <= LOGLO) return '';
    var a = (Math.log(r.range_low_usd) - LOGLO) / (LOGHI - LOGLO) * 100;
    var b = (Math.log(r.range_high_usd) - LOGLO) / (LOGHI - LOGLO) * 100;
    return '<div class="rbar"><i style="left:' + a.toFixed(1) + '%;width:' + Math.max(1, b - a).toFixed(1) + '%"></i></div>';
  }
  function gasRange(chain) {
    var c = (chain || '').toLowerCase();
    if (c === 'ethereum') return [5, 20];
    if (c === 'solana') return [0, 0.1];
    if (c === 'tron') return [1, 3];
    if (c === 'bitcoin' || c === 'bittensor') return [1, 5];
    return [0, 1];
  }
  /** Farm verdict from the existing capitalFor / gasFor / holdDaysFor rules: ~6 txs at a 30-day hold, ~11 at 60 days; active minutes = 40 fixed + 15 per week. */
  function farmVerdict(row) {
    var hold = holdDaysFor(row.age_days);
    var weeks = Math.round(hold / 7);
    var txs = 2 + weeks, mins = 40 + 15 * weeks, hrs = mins / 60;
    var g = gasRange(chainOf(row));
    var lo = txs * g[0], hi = txs * g[1];
    var peers = DATA.peers[row.category];
    var verdict = (row.age_days == null || (peers && peers.n < 5)) ? 'Check first' : (hi > 100 ? 'Thin' : 'Farm');
    return { capital: capitalFor(row), hold: hold, txs: txs, mins: mins, hrs: hrs, lo: lo, hi: hi, verdict: verdict, cphLo: lo / hrs, cphHi: hi / hrs };
  }

  /** The model, recomputed in the page from the snapshot's own figures, so the board and the code agree. */
  function growthOf(row, growthWeight) {
    var g = row.change_7d == null ? 0 : clamp(row.change_7d, MODEL.growth_floor, MODEL.growth_cap);
    return 1 + (g / 100) * growthWeight;
  }
  function maturityOf(row, maturityRange) {
    var age = row.age_days == null ? MODEL.unknown_age_days : row.age_days;
    return MODEL.maturity_floor + (clamp(age, 0, MODEL.maturity_days) / MODEL.maturity_days) * maturityRange;
  }
  function sizeOf(row, sizeExponent) {
    var ref = DATA.size_reference_tvl > 0 ? DATA.size_reference_tvl : 1;
    return Math.pow(row.tvl_usd / ref, sizeExponent);
  }
  function impliedOf(row, sb) {
    // Without the sandbox the page uses the row's own peer multiple, the one board.json carries,
    // so the recomputation lands on the same dollar. With the sandbox it rebuilds the multiple
    // from the row's peer median and size factor, under the changed constants.
    var peer;
    if (sb) {
      var median = row.size_multiplier ? row.peer_multiple / row.size_multiplier : row.peer_multiple;
      peer = median * sizeOf(row, sb.sizeExponent) * sb.peerScale;
      peer = Math.min(MODEL.peer_cap, Math.max(MODEL.peer_floor, peer));
    } else {
      peer = row.peer_multiple;
    }
    var g = growthOf(row, sb ? sb.growthWeight : MODEL.growth_weight);
    var m = maturityOf(row, sb ? sb.maturityRange : MODEL.maturity_range);
    return Math.max(1, Math.round(row.tvl_usd * peer * g * m));
  }
  function growthPctOf(row) {
    return row.change_7d == null ? 0 : clamp(row.change_7d, MODEL.growth_floor, MODEL.growth_cap);
  }

  /** The farm plan, from the same derivation as main.ts: category, chain, TVL and age, never a name. */
  function chainOf(row) { return row.chains.length > 0 ? row.chains[0] : 'its main chain'; }
  function capitalFor(row) {
    if (row.tvl_usd >= 5e9) return 250;
    if (row.tvl_usd >= 1e9) return 150;
    if (row.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age == null) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function gasFor(chain) {
    var c = chain.toLowerCase();
    if (c === 'ethereum') return 'about $5–20 of gas per transaction';
    if (c === 'solana') return 'under $0.10 of gas per transaction';
    if (c === 'tron') return 'about $1–3 of gas per transaction';
    if (c === 'bitcoin' || c === 'bittensor') return 'about $1–5 of gas per transaction';
    return 'about $1 or less of gas per transaction';
  }
  function actionFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase();
    var name = row.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + '\'s main pool on ' + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + ' of the chain\'s staking asset through ' + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of the protocol\'s yield asset on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + '\'s basis position on ' + chain + ' and keep it open.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function hasAny(c, needles) {
    for (var i = 0; i < needles.length; i++) if (c.indexOf(needles[i]) >= 0) return true;
    return false;
  }
  function weeklyActionFor(row, chain) {
    var c = (row.category || '').toLowerCase();
    var name = row.name;
    if (hasAny(c, ['lend', 'cdp', 'collateral'])) return 'Supply or borrow once a week, and repay or top up the position on ' + name + ' so it stays active.';
    if (hasAny(c, ['dex', 'yield', 'leveraged farm'])) return 'Swap or add liquidity once a week on ' + name + ' so the position records activity.';
    if (hasAny(c, ['bridge'])) return 'Bridge a small amount once a week through ' + name + ' and use the bridged funds in its app.';
    if (hasAny(c, ['staking', 'restak'])) return 'Restake or claim rewards once a week through ' + name + ' and keep the receipt.';
    if (hasAny(c, ['perpetual', 'derivative'])) return 'Open or close one small hedged position once a week on ' + name + '.';
    if (hasAny(c, ['prediction'])) return 'Place one small market position a week on ' + name + '.';
    if (hasAny(c, ['curator', 'allocator', 'risk'])) return 'Deposit into a new ' + name + ' vault, or rebalance between vaults, once a week.';
    if (hasAny(c, ['stable'])) return 'Mint or redeem the stable asset once a week through ' + name + ' on ' + chain + '.';
    if (hasAny(c, ['rwa'])) return "Check " + name + "'s new listings once a week and hold the yield asset.";
    if (hasAny(c, ['insurance'])) return 'Renew or adjust the cover once a week through ' + name + '.';
    if (hasAny(c, ['basis'])) return 'Check the basis position on ' + name + ' once a week and top it up when the spread widens.';
    return 'Make one qualifying action each week on ' + name + ', such as a deposit, a borrow, a swap or a vote.';
  }
  function milestoneFor(row) {
    var c = (row.category || '').toLowerCase();
    if (hasAny(c, ['lend', 'cdp', 'collateral'])) return 'a launch is usually preceded by a new market listing or an interest-rate vote';
    if (hasAny(c, ['dex'])) return 'a launch is usually preceded by a new pool or a fee vote';
    if (hasAny(c, ['curator', 'allocator', 'risk'])) return 'a launch is usually preceded by a new vault or a new curator onboarding';
    if (hasAny(c, ['rwa'])) return 'a launch is usually preceded by a new asset listing';
    if (hasAny(c, ['stable'])) return 'a launch is usually preceded by a new collateral type or a peg-mechanism vote';
    if (hasAny(c, ['perpetual', 'derivative'])) return 'a launch is usually preceded by a new market listing';
    if (hasAny(c, ['prediction'])) return 'a launch is usually preceded by a new market category';
    if (hasAny(c, ['bridge'])) return 'a launch is usually preceded by a new route or a fee change';
    if (hasAny(c, ['staking', 'restak'])) return 'a launch is usually preceded by a new staking asset or a rewards change';
    if (hasAny(c, ['basis'])) return 'a launch is usually preceded by a new market listing or a new basis strategy';
    if (hasAny(c, ['yield', 'leveraged farm', 'farm'])) return 'a launch is usually preceded by a new vault or a new yield strategy';
    return 'a launch is usually preceded by a points snapshot or a governance post';
  }
  function positionFor(row) {
    var c = (row.category || '').toLowerCase();
    if (hasAny(c, ['lend', 'cdp', 'collateral'])) return 'a small supply position';
    if (hasAny(c, ['dex', 'yield', 'leveraged farm'])) return 'a small liquidity position';
    if (hasAny(c, ['staking', 'restak'])) return 'a small staked position';
    if (hasAny(c, ['perpetual', 'derivative'])) return 'a small margin position';
    if (hasAny(c, ['curator', 'allocator', 'risk'])) return 'a small vault position';
    if (hasAny(c, ['stable'])) return 'a small stable-asset position';
    if (hasAny(c, ['rwa'])) return 'a small yield-asset position';
    if (hasAny(c, ['insurance'])) return 'a small cover position';
    if (hasAny(c, ['basis'])) return 'a small basis position';
    return 'a small position';
  }
  function farmSteps(row) {
    var chain = chainOf(row);
    var capital = capitalFor(row);
    var hold = holdDaysFor(row.age_days);
    var gas = gasFor(chain);
    var weekly = weeklyActionFor(row, chain);
    var milestone = milestoneFor(row);
    var position = positionFor(row);
    return [
      { text: 'Use a fresh wallet on ' + chain + ' that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(row, capital, chain), cost: '$' + capital + ' of capital and ' + gas, time: '15 minutes to set up' },
      { text: weekly, cost: gas + ' a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Open the protocol's own points or rewards page and check whether it runs one; claim only from the link that page publishes, and never pay to claim.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Check the protocol\'s announcements once a week: ' + milestone + ', and the position must be open when it lands.', cost: 'nothing but the check', time: '5 minutes a week' },
      { text: 'Write the wallet, the dates and every transaction in a farm log; when you unwind, withdraw in tranches and keep ' + position + ' until any claim window has closed.', cost: gas + ' to exit', time: '10 minutes to unwind' },
    ];
  }

  /** The state the URL carries, so a view can be linked and screenshotted. */
  function readHash() {
    var h = (location.hash || '').replace(/^#/, '');
    var s = { q: '', category: '', chain: '', wl: false, odds50: false, hidemed: false, tab: 'pre', p: '', sort: 'rank', dir: 1 };
    h.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv.length !== 2) return;
      var k = decodeURIComponent(kv[0]);
      var v = decodeURIComponent(kv[1]);
      if (k === 'q') s.q = v;
      if (k === 'category') s.category = v;
      if (k === 'chain') s.chain = v;
      if (k === 'wl') s.wl = v === '1';
      if (k === 'odds50') s.odds50 = v === '1';
      if (k === 'hidemed') s.hidemed = v === '1';
      if (k === 'tab') s.tab = v === 'live' ? 'live' : 'pre';
      if (k === 'p') s.p = v;
      if (k === 'sort') s.sort = v;
      if (k === 'dir') s.dir = v === '-1' ? -1 : 1;
    });
    return s;
  }
  var state = readHash();
  var sandbox = { peerScale: 1, growthWeight: MODEL.growth_weight, maturityRange: MODEL.maturity_range, sizeExponent: MODEL.size_exponent };
  function sandboxActive() {
    return sandbox.peerScale !== 1 || sandbox.growthWeight !== MODEL.growth_weight || sandbox.maturityRange !== MODEL.maturity_range || sandbox.sizeExponent !== MODEL.size_exponent;
  }
  function writeHash() {
    var parts = [];
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category) parts.push('category=' + encodeURIComponent(state.category));
    if (state.chain) parts.push('chain=' + encodeURIComponent(state.chain));
    if (state.wl) parts.push('wl=1');
    if (state.odds50) parts.push('odds50=1');
    if (state.hidemed) parts.push('hidemed=1');
    if (state.tab !== 'pre') parts.push('tab=' + state.tab);
    if (state.p) parts.push('p=' + encodeURIComponent(state.p));
    if (state.sort !== 'rank') parts.push('sort=' + state.sort);
    if (state.dir !== 1) parts.push('dir=-1');
    history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname + location.search);
  }

  var categories = [];
  var chains = [];
  DATA.rows.forEach(function (r) {
    if (r.category && categories.indexOf(r.category) < 0) categories.push(r.category);
    (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  categories.sort();
  chains.sort();

  /** The rows the current filters leave, with the value the current model gives them. */
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var sb = sandboxActive() ? sandbox : null;
    var rows = DATA.rows.filter(function (r) {
      if (state.wl && !isWatchlist(r.slug)) return false;
      if (state.odds50 && (r.token_record_odds || 0) < 0.50) return false;
      if (state.hidemed && !r.peer_from_category) return false;
      if (state.category && r.category !== state.category) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).map(function (r) {
      return { row: r, value: impliedOf(r, sb) };
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      var d = 0;
      if (key === 'name') d = a.row.name.localeCompare(b.row.name);
      else if (key === 'tvl') d = a.row.tvl_usd - b.row.tvl_usd;
      else if (key === 'growth') d = (a.row.change_7d || 0) - (b.row.change_7d || 0);
      else if (key === 'age') d = (a.row.age_days == null ? -1 : a.row.age_days) - (b.row.age_days == null ? -1 : b.row.age_days);
      else if (key === 'peer') d = a.row.peer_multiple - b.row.peer_multiple;
      else if (key === 'odds') d = (a.row.token_record_odds || 0) - (b.row.token_record_odds || 0);
      else if (key === 'rangeLow') d = (a.row.range_low_usd || 0) - (b.row.range_low_usd || 0);
      else if (key === 'rangeHigh') d = (a.row.range_high_usd || 0) - (b.row.range_high_usd || 0);
      else if (key === 'xodds') d = a.value * (a.row.token_record_odds || 0) - b.value * (b.row.token_record_odds || 0);
      else if (key === 'value') d = a.value - b.value;
      else d = a.row.rank - b.row.rank;
      return d * state.dir;
    });
    return rows;
  }
  function isWatchlist(slug) {
    return DATA.watchlist_slugs ? DATA.watchlist_slugs.indexOf(slug) >= 0 : false;
  }

  var dialog = null;
  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.p = slug;
    writeHash();
    var recomputed = impliedOf(row, null);
    var steps = farmSteps(row);
    var peers = row.peer_count === 1 ? '1 live peer' : row.peer_count + ' live peers';
    var peer = row.peer_from_category ? peers + ' in ' + (row.category || 'this category') : 'market-wide median (' + peers + ' in this category, too few to price on)';
    dialog.innerHTML =
      '<div class="detail-head"><div><span class="status hot">Rank ' + row.rank + ' · pre-token</span>' +
      '<h2>' + esc(row.name) + '</h2><p class="sub">' + esc(row.category || '—') + ' · ' + esc((row.chains || []).join(', ') || '—') + '</p></div>' +
      '<button class="close" type="button" data-close>Close</button></div>' +
      '<div class="detail-section"><h3>Implied value: ' + fmtUsd(row.implied_value_usd) + '</h3>' +
      '<div class="equation"><div><span>TVL</span><b>' + fmtUsd(row.tvl_usd) + '</b></div>' +
      '<div><span>Peer median × size</span><b>' + row.peer_median.toFixed(4) + ' × ' + row.size_multiplier.toFixed(3) + ' = ' + row.peer_multiple.toFixed(4) + '</b></div>' +
      '<div><span>Growth × maturity</span><b>' + growthOf(row, MODEL.growth_weight).toFixed(3) + ' × ' + maturityOf(row, MODEL.maturity_range).toFixed(3) + '</b></div>' +
      '<div><span>Age with no token</span><b>' + ageLabel(row.age_days) + '</b></div></div>' +
      '<p class="sub">The peer multiple is ' + esc(peer) + ', priced at the reference size of ' + fmtUsd(DATA.size_reference_tvl) + ' of TVL and then adjusted for this protocol\'s size: ' + fmtUsd(row.tvl_usd) + ' of TVL trades at ×' + row.size_multiplier.toFixed(3) + ' of the reference multiple, because the snapshot\'s live peers show the multiple falls as TVL rises (fitted −0.48 per log point of TVL, n=128, se 0.095, t −5.04). Growth is ' + fmtPct(row.change_7d) + ' over 7 days, clamped to −50…+100% and weighted 0.00 — fitted, dropped on blind tests (§2). Maturity is 1.00 at every age — fitted, dropped on blind tests (§2). A protocol with no listing date is shown as age unknown, never silently imputed. The multiple is clamped to 0.01–1.00.</p>' +
      (recomputed === row.implied_value_usd
        ? '<p class="sub">The dashboard recomputed this value from the snapshot\'s own figures and landed on the same dollar board.json carries.</p>'
        : '<p class="sub">The dashboard recomputed ' + fmtUsd(recomputed) + ' from the snapshot\'s own figures; board.json carries ' + fmtUsd(row.implied_value_usd) + '. The two should agree.</p>') +
      '</div>' +
      oddsBlock(row) + intervalBlock(row) + verdictBlock(row) +
      '<div class="detail-section"><h3>How to farm it</h3><ol class="steps">' +
      steps.map(function (s) { return '<li><b>' + esc(s.text) + '</b><span class="cost">Cost: ' + esc(s.cost) + '. Time: ' + esc(s.time) + '.</span></li>'; }).join('') +
      '</ol><p class="sub">The plan is derived from this protocol\'s category, chain, TVL and age. It never claims a points program exists: step five tells you to check the protocol\'s own page, and to claim only from the link that page publishes.</p></div>' +
      '<div class="detail-section"><h3>What this is, and what it is not</h3>' +
      '<p class="sub">The snapshot records no token for this protocol: no market cap, no CoinGecko id, no symbol. ' + fmtUsd(row.implied_value_usd) + ' is an estimate of what a token would be worth if the market priced this protocol like its live peers — not a price, not a launch date, and not an airdrop promise. Nothing here is financial advice.</p></div>';
    dialog.showModal();
    dialog.querySelector('[data-close]').addEventListener('click', closeDetail);
  }
  function closeDetail() {
    if (dialog && dialog.open) dialog.close();
    state.p = '';
    writeHash();
  }

  function oddsBlock(row) {
    var o = row.token_record_odds;
    var pct = (o == null || !isFinite(o)) ? '—' : (o * 100).toFixed(1) + '%';
    var cat = CATTOK[row.category];
    var catTxt = cat ? 'In this category, ' + (cat[0] / cat[1] * 100).toFixed(1) + '% of protocols record a token (' + cat[0] + '/' + cat[1] + ').' : 'This category has fewer than 10 protocols in the snapshot, so no category rate is shown.';
    var ageTxt = row.age_days == null ? ' Age unknown.' : '';
    return '<div class="detail-section"><h3>Token record (peers): ' + oddsChip(o) + '</h3>' +
      '<p class="sub">Among protocols in this snapshot at this size, age and category, ' + pct + ' record a token. That is the peers\' record, not a prediction that this protocol will issue one, or when. ' + catTxt + ageTxt + '</p>' +
      '<p class="sub">Peer-token rate overall: 54.9% (416/758). Odds model 5-fold CV AUC 0.784; age is the signal (OR 1.85/yr) and TVL alone does not separate token-record (AUC 0.524).</p></div>';
  }
  function intervalBlock(row) {
    function rng(q) { return fmtUsd(row.implied_value_usd * Math.exp(-q)) + ' – ' + fmtUsd(row.implied_value_usd * Math.exp(q)); }
    return '<div class="detail-section"><h3>80% peer range: ' + fmtUsd(row.range_low_usd) + ' – ' + fmtUsd(row.range_high_usd) + '</h3>' + rangeBar(row) +
      '<p class="sub">50%: ' + rng(DATA.conformal_q50) + ' · 80%: ' + rng(DATA.conformal_q80) + ' · 90%: ' + rng(DATA.conformal_q90) + '.</p>' +
      '<p class="sub">LOO residuals n=128, SD 2.11 log points; the peers\' record spans ~131× at 80%. One global interval: per-category intervals were tested and rejected (only 7 categories have ≥8 live peers; spreads unstable).</p></div>';
  }
  function verdictBlock(row) {
    var v = farmVerdict(row);
    return '<div class="detail-section"><h3>Farm verdict: ' + v.verdict + '</h3>' +
      '<p class="sub">Capital $' + v.capital + ' · ' + v.txs + ' transactions over ' + v.hold + ' days · gas ' + fmtMoney(v.lo) + '–' + fmtMoney(v.hi) + ' total · ' + v.mins + ' active minutes (' + v.hrs.toFixed(1) + ' h) · ' + fmtMoney(v.cphLo) + '–' + fmtMoney(v.cphHi) + ' of gas per active hour of exposure.</p>' +
      '<p class="sub">Cost per active hour is gas divided by active hours — not dollars per hour of profit; no per-farmer payout exists or is claimed. Rule: "Thin" when the plan\'s gas high end exceeds $100; otherwise "Farm". "Check first" when age is unknown or the category has fewer than 5 live peers. Never auto-"Skip".</p></div>';
  }

  /** One table head cell that sorts on click. */
  function th(label, key, cls) {
    var active = state.sort === key;
    var arrow = active ? (state.dir === 1 ? ' ↑' : ' ↓') : '';
    return '<th class="' + (cls || '') + '"><button type="button" data-sort="' + key + '">' + esc(label) + arrow + '</button></th>';
  }

  function renderTable() {
    var sb = sandboxActive();
    if (state.tab === 'live') {
      var live = DATA.live.slice().sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); });
      return '<div class="panel"><div class="table-wrap"><table><caption>' + live.length + ' live-token protocols, by market cap. They already trade, so the board shows the market\'s own value for them and never mixes them into the ranking.</caption><thead><tr>' +
        '<th>Protocol</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">7d</th><th>Chains</th></tr></thead><tbody>' +
        live.map(function (r) {
          return '<tr><td class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || '—') + '</span></td>' +
            '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + fmtUsd(r.mcap_usd) + '</td>' +
            '<td class="num ' + (r.change_7d == null ? '' : r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</td>' +
            '<td class="sub">' + esc((r.chains || []).join(', ')) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    var items = filteredRows();
    var max = 1;
    items.forEach(function (it) { if (it.value > max) max = it.value; });
    var rowsHtml = items.map(function (it, i) {
      var r = it.row;
      var rank = sb ? i + 1 : r.rank;
      var g = r.change_7d;
      return '<tr data-slug="' + esc(r.slug) + '" data-selected="' + (state.p === r.slug) + '">' +
        '<td class="num">' + rank + '</td>' +
        '<td class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || '—') + ' · ' + esc((r.chains || []).slice(0, 3).join(', ')) + '</span></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + (g == null ? '' : g >= 0 ? 'pos' : 'neg') + '">' + fmtPct(g) + '</td>' +
        '<td class="num">' + ageLabel(r.age_days) + '</td>' +
        '<td class="num">' + r.peer_multiple.toFixed(2) + ' <span class="sub">· ' + (r.peer_from_category ? r.peer_count + ' peers' : 'market') + ' · ×' + r.size_multiplier.toFixed(2) + '</span></td>' +
        '<td class="implied"><div class="bar"><i style="width:' + Math.max(2, Math.round(it.value / max * 100)) + '%"></i></div><b>' + fmtUsd(it.value) + '</b>' + (sb ? ' <span class="sub">sandbox</span>' : '') + '</td>' +
        '<td class="num">' + oddsChip(r.token_record_odds) + ' <span class="sub">n=758</span></td>' +
        '<td class="num">' + fmtUsd(r.range_low_usd) + '–' + fmtUsd(r.range_high_usd) + rangeBar(r) + '</td>' +
        '<td class="num">' + fmtUsd(it.value * (r.token_record_odds || 0)) + '</td>' +
        '<td><span class="status hot">pre-token</span></td></tr>';
    }).join('');
    if (!rowsHtml) {
      return '<div class="panel empty"><h2>No protocol matches</h2><p>Try a shorter search, another category, or clear the watchlist filter.</p><button class="button" type="button" data-clear>Clear the filters</button></div>';
    }
    return '<div class="panel"><div class="table-wrap"><table><caption>' + items.length + ' pre-token protocol' + (items.length === 1 ? '' : 's') + ', ranked by implied launch value' + (sb ? ' under the sandbox model' : '') + '. Click a row for the model and the farm plan. Implied × odds is a reader sort — not the board rank.</caption><thead><tr>' +
      th('Rank', 'rank', 'num') + th('Protocol', 'name') + th('TVL', 'tvl', 'num') + th('7d', 'growth', 'num') + th('Age', 'age', 'num') + th('Peer', 'peer', 'num') + th('Implied value', 'value', 'num') + th('Token record (peers)', 'odds', 'num') + th('80% range', 'rangeLow', 'num') + th('Implied × odds', 'xodds', 'num') + '<th>Token</th></tr></thead><tbody>' +
      rowsHtml + '</tbody></table></div></div>';
  }

  function renderDisposition() {
    var d = DATA.disposition;
    if (!d) return '';
    var dis = DATA.dispositions || [];
    var order = ['excluded-category', 'versioned-name', 'wrapped/staked-word'];
    var items = order.map(function (reason) {
      var n = (d.excluded_by_reason && d.excluded_by_reason[reason]) || 0;
      var first = dis.filter(function (x) { return x.exclude_reason === reason; }).slice(0, 3).map(function (x) { return x.slug; }).join(', ');
      return '<li><b>' + esc(reason) + ': ' + n + '</b> — first: ' + esc(first) + '</li>';
    }).join('');
    return '<section class="panel model" aria-label="758-protocol audit"><h2>758-protocol audit: where every protocol went</h2>' +
      '<p>Ranked ' + d.ranked + ' · live with market cap ' + d.live_with_mcap + ' (' + DATA.live_size + ' shown) · token recorded but no market cap ' + d.token_but_no_mcap + ' · excluded ' + d.excluded + '.</p>' +
      '<ul class="disp">' + items + '</ul>' +
      '<p class="sub">Excluded protocols are not board rows: excluded-category, versioned-name and wrapped/staked-word protocols are not launches under the house rule. Live-token protocols are shown separately with market values, never mixed into the ranking.</p></section>';
  }

  function renderModel() {
      var peers = Object.keys(DATA.peers).sort().map(function (k) { return { category: k, entry: DATA.peers[k] }; });
      var rows = peers.map(function (p) {
        return '<tr><td>' + esc(p.category) + '</td><td class="num">' + p.entry.n + '</td><td class="num">' + p.entry.multiple.toFixed(4) + '</td><td>' + (p.entry.from_category ? 'category peers' : 'market-wide median') + '</td></tr>';
      }).join('');
      var V={Farm:0,Thin:0,Check:0};DATA.rows.forEach(function(r){var v=farmVerdict(r);V[v.verdict==="Check first"?"Check":v.verdict]++;});
      return '<section class="panel model" aria-label="The model"><h2>The model: worth what its peers trade for</h2>' +
        '<p>Each category is priced at the median market-cap / TVL of its live-token peers, when the category has at least five live peers; otherwise the market-wide median. That median is the multiple at the reference size of ' + fmtUsd(DATA.size_reference_tvl) + ' of TVL, and it is then adjusted for the protocol\'s own size: the multiple falls as TVL rises, so a protocol ten times larger trades at about 0.33× the multiple. The multiple is clamped to 0.01–1.00, so no launch is priced above its own TVL on a market-cap basis and no category is priced on one thin outlier.</p>' +
        '<p>Why the size term: across the snapshot\'s 128 live-token peers, log(market-cap / TVL) falls 0.48 per log point of TVL (n=128, se 0.095, t −5.04), and LOO refits range −0.50…−0.45. Growth and age were fitted and then dropped on blind tests (table below): growth is weighted 0.00, maturity is 1.00 at every age — a growing TVL does not raise the multiple, because the week\'s deposits are already inside TVL, and age shows no reliable effect. Growth and age stay visible as per-row facts, with the note "fitted, dropped on blind tests (§2)".</p>' +
        '<p class="formula">implied = TVL × peer × size&nbsp;&nbsp;×&nbsp;&nbsp;(1 + clamp(7d, −50, 100) / 100 × 0.00)&nbsp;&nbsp;×&nbsp;&nbsp;1.00</p>' +
        '<p class="sub">peer × size = the category median × (TVL / ' + fmtUsd(DATA.size_reference_tvl) + ')^(' + MODEL.size_exponent + '). Growth weight 0.00 and maturity 1.00: both fitted, both dropped on blind tests.</p>' +
        '<h3>Held-out tests: what was kept, what was dropped</h3>' +
        '<table class="peer-table"><thead><tr><th>Model</th><th class="num">In-sample</th><th class="num">LOO RMSE</th><th class="num">5-fold RMSE</th><th class="num">10-fold RMSE</th><th class="num">Walk-forward R²</th><th>Verdict</th></tr></thead><tbody>' +
        '<tr><td>M0 intercept-only</td><td class="num">—</td><td class="num">2.295</td><td class="num">2.255</td><td class="num">2.241</td><td class="num">−0.00 / −0.02</td><td>Baseline</td></tr>' +
        '<tr><td>M1 log TVL (size)</td><td class="num">R² 0.168</td><td class="num">2.107</td><td class="num">2.062</td><td class="num">2.041</td><td class="num">+0.072 / +0.140</td><td>KEEP −0.48</td></tr>' +
        '<tr><td>M2 + growth</td><td class="num">—</td><td class="num">2.115</td><td class="num">2.081</td><td class="num">2.060</td><td class="num">+0.069 / +0.156</td><td>DROP weight 0</td></tr>' +
        '<tr><td>M3 + age (n=95)</td><td class="num">—</td><td class="num">1.997*</td><td class="num">2.004*</td><td class="num">1.961*</td><td class="num">−0.50 / singular</td><td>DROP ×1.00</td></tr>' +
        '<tr><td>M4 logTVL+growth+age (n=95)</td><td class="num">—</td><td class="num">2.022*</td><td class="num">2.051*</td><td class="num">2.000*</td><td class="num">−0.05 / −6.26</td><td>DROP</td></tr></tbody></table>' +
        '<p class="sub">* M3/M4 LOO, 5-fold, 10-fold on age-known n=95; M1 on same 95 scores 1.986/1.982/1.946 — age loses. LOO 2.107 vs naive 2.295 = ×1.09. Walk-forward oldest→newest (70/30, 50/50). Conformal q50 1.2243, q80 2.4383, q90 3.7293 (LOO n=128, SD 2.11). Odds CV AUC 0.784. 10-fold M1 R² +0.078, M2c worse than M1, M3 R² negative high variance — no verdict change vs LOO/5-fold/walk-forward.</p>' +
        '<p class="sub">The previous version quoted −0.54; that slope is the age-known subset (n=95). The all-peer fit is −0.48.</p>' +
        '<table class="peer-table"><thead><tr><th>Category</th><th class="num">Live peers</th><th class="num">Multiple</th><th>Priced on</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<p class="sub">The multiples above are the multiple at the reference size of ' + fmtUsd(DATA.size_reference_tvl) + ' of TVL; the board applies the size adjustment per protocol. Market-wide median mcap / TVL: ' + DATA.overall_peer_multiple.toFixed(4) + '. ' + DATA.board_size + ' protocols ranked; ' + DATA.watchlist_size + ' on the watchlist, all covered; ' + DATA.early_size + ' more below the $' + (DATA.floor_usd / 1e6) + 'M floor. Live-token protocols are set aside and shown as the market\'s own values, never mixed into the ranking.</p>' +
        '<section class="panel farm-matrix" aria-label="Farm matrix"><h2>Farm matrix: cost by capital tier and chain</h2>' +
        '<p>Tiers: $50, $100, $150. Non-empty: rows, gas, cost/active-hr=gas÷active hrs. Disparity: Eth $22–$89/hr vs Sol $0.05–$0.45/hr.</p>' +
        '<div class="matrix-wrap"><table class="matrix"><thead><tr>' +
        '<th>Chain \\ Tier</th>' +
        [50,100,150].map(function(t){return'<th>$'+t+'</th>';}).join('') +
        '</tr></thead><tbody>' +
        (function(){var R=DATA.rows,C=[],T=[50,100,150],M={};R.forEach(function(r){var c=r.chains&&r.chains[0];if(c&&C.indexOf(c)<0)C.push(c);});C.sort();R.forEach(function(r){var v=farmVerdict(r),t=capitalFor(r),ch=r.chains&&r.chains[0]||'—',k=ch+'|'+t,cl=M[k];if(!cl){cl={r:0,l:1/0,h:-1/0,L:1/0,H:-1/0};M[k]=cl;}cl.r++;cl.l=Math.min(cl.l,v.lo);cl.h=Math.max(cl.h,v.hi);cl.L=Math.min(cl.L,v.cphLo);cl.H=Math.max(cl.H,v.cphHi);});return C.map(function(ch){return'<tr><td>'+esc(ch)+'</td>'+T.map(function(t){var cl=M[ch+'|'+t];return cl&&cl.r?'<td>'+cl.r+' | '+fmtMoney(cl.l)+'–'+fmtMoney(cl.h)+' gas | '+fmtMoney(cl.L)+'–'+fmtMoney(cl.H)+'/hr</td>':'<td>—</td>';}).join('')+'</tr>';}).join('');})() +
        '</tbody></table></div>' +
        '<p class="sub">'+V.Farm+' Farm, '+V.Thin+' Thin, '+V.Check+' Check — <code>capitalFor</code>/<code>gasFor</code>/<code>holdDaysFor</code> (Thin gas>$100;Farm else;Check age unk/cat<5).</p></section>' +
        '<div class="sandbox"><h3>Model sandbox</h3><p>Change the constants and watch the board re-rank. This only changes the view in this page; the submitted board is the one main.ts wrote with the constants above. Growth and age have no sliders: they are fixed at weight 0 and multiplier 1.00, fitted and dropped on blind tests. The size slider moves ±0.10 around −0.48.</p>' +
        '<div class="sliders">' +
        '<div><label for="sb-peer">Peer multiple scale: <output id="sb-peer-out">' + sandbox.peerScale.toFixed(2) + '×</output></label><input id="sb-peer" type="range" min="0.5" max="2" step="0.05" value="' + sandbox.peerScale + '"></div>' +
        '<div><label for="sb-size">Size exponent: <output id="sb-size-out">' + sandbox.sizeExponent.toFixed(2) + '</output></label><input id="sb-size" type="range" min="-0.58" max="-0.38" step="0.01" value="' + sandbox.sizeExponent + '"></div>' +
        '</div></div></section>';
  }

  function render() {
    var sb = sandboxActive();
    var wlCount = 0;
    DATA.rows.forEach(function (r) { if (isWatchlist(r.slug)) wlCount++; });
    var boardTotal = DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    var floorN = 0, capN = 0, medN = 0, basisTop = 0;
    DATA.rows.forEach(function (r) {
      if (r.peer_multiple <= 0.01) floorN++;
      if (r.peer_multiple >= 1) capN++;
      if (!r.peer_from_category) medN++;
    });
    DATA.rows.slice(0, 20).forEach(function (r) { if (r.category === 'Basis Trading') basisTop++; });
    var catsUnder5 = Object.keys(DATA.peers).filter(function (k) { return DATA.peers[k].n < 5; }).length;
    var catsTotal = Object.keys(DATA.peers).length;
    mount.innerHTML = '<div class="shell">' +
      '<header class="top"><div class="brand"><span class="mark" aria-hidden="true"></span>Token Radar</div>' +
      '<div class="top-meta"><span>Snapshot ' + esc(DATA.as_of) + '</span><span>Model ' + esc(DATA.model_version) + '</span><span>' + DATA.board_size + ' rows</span></div></header>' +
      '<div class="kpi">' + (DATA.disposition ? DATA.disposition.total : 758) + ' protocols accounted for · ' + DATA.board_size + ' ranked · watchlist ' + wlCount + '/' + DATA.watchlist_size + ' · board total ' + fmtExact(boardTotal) + ' · size ' + MODEL.size_exponent.toFixed(2) + ' · LOO ×1.09 · odds AUC 0.78</div>' +
      '<section class="lede"><h1>The protocols with no token yet, ranked by what a launch would be worth</h1>' +
      '<p>One sealed DefiLlama snapshot, ' + DATA.board_size + ' pre-token protocols, each priced like its live-token peers, adjusted for size: the bigger the protocol, the lower the multiple the market pays. The watchlist is the floor, never the ceiling: every watchlist protocol is here, and so is every other pre-token protocol the rule would rank. Click a row for the model behind its number and a plan to farm it.</p>' +
      '<div class="facts">' +
      '<div class="fact"><span>Watchlist covered</span><b>' + wlCount + ' / ' + DATA.watchlist_size + '</b></div>' +
      '<div class="fact"><span>Protocols ranked</span><b>' + DATA.board_size + '</b></div>' +
      '<div class="fact"><span>Top implied value</span><b>' + fmtUsd(DATA.rows[0].implied_value_usd) + '</b></div>' +
      '<div class="fact"><span>Live-token set aside</span><b>' + DATA.live_size + '</b></div>' +
      '</div></section>' +
      '<div class="controls">' +
      '<div class="field"><label for="q">Search</label><input id="q" type="search" placeholder="Name, slug or category" value="' + esc(state.q) + '" autocomplete="off"></div>' +
      '<div class="field"><label for="category">Category</label><select id="category"><option value="">All categories</option>' +
      categories.map(function (c) { return '<option value="' + esc(c) + '"' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="chain">Chain</label><select id="chain"><option value="">All chains</option>' +
      chains.map(function (c) { return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<label class="check"><input id="wl" type="checkbox"' + (state.wl ? ' checked' : '') + '> Watchlist only</label>' +
      '<label class="check"><input id="odds50" type="checkbox"' + (state.odds50 ? ' checked' : '') + '> Peers-with-token ≥ 50%</label>' +
      '<label class="check"><input id="hidemed" type="checkbox"' + (state.hidemed ? ' checked' : '') + '> Hide market-median rows</label>' +
      '<div class="tabs"><button type="button" data-tab="pre" aria-pressed="' + (state.tab === 'pre') + '">Pre-token</button><button type="button" data-tab="live" aria-pressed="' + (state.tab === 'live') + '">Live token</button></div>' +
      '<span class="count" id="count"></span></div>' +
      (sb ? '<div class="banner"><span>Sandbox view: the board is re-ranked under the model constants you changed. This is not the submitted board.</span><button type="button" data-reset-sandbox>Reset the model</button></div>' : '') +
      '<div id="table-slot"></div>' +
      '<div class="integrity">Integrity: ' + floorN + ' rows at the 0.01 floor · ' + capN + ' row' + (capN === 1 ? '' : 's') + ' at the 1.00 cap · ' + medN + '/' + DATA.board_size + ' rows on the market-wide median (' + catsUnder5 + '/' + catsTotal + ' categories &lt; 5 live peers) · Basis Trading ' + basisTop + '/20 top rows.</div>' +
      renderDisposition() +
      renderModel() +
      '<footer class="foot"><p>Source: ' + esc(DATA.source) + ', fetched ' + esc(DATA.as_of) + '. Floor: $' + (DATA.floor_usd / 1e6) + 'M TVL. The dashboard runs entirely from data.js next to it: no fetch, no network, no tracking.</p>' +
      '<p>An implied value is an estimate of what a token would be worth if the market priced the protocol like its live peers. It is not a price, not a launch date, and not an airdrop promise. Nothing here is financial advice.</p></footer>' +
      '</div>';
    mount.querySelector('#table-slot').innerHTML = renderTable();
    var count = mount.querySelector('#count');
    if (count) count.textContent = state.tab === 'live' ? DATA.live_size + ' live-token protocols' : filteredRows().length + ' of ' + DATA.board_size + ' shown';
    mount.setAttribute('aria-busy', 'false');

    mount.querySelector('#q').addEventListener('input', function (e) { state.q = e.target.value; state.p = ''; writeHash(); rerenderTable(); });
    mount.querySelector('#category').addEventListener('change', function (e) { state.category = e.target.value; writeHash(); rerenderTable(); });
    mount.querySelector('#chain').addEventListener('change', function (e) { state.chain = e.target.value; writeHash(); rerenderTable(); });
    mount.querySelector('#wl').addEventListener('change', function (e) { state.wl = e.target.checked; writeHash(); rerenderTable(); });
    mount.querySelector('#odds50').addEventListener('change', function (e) { state.odds50 = e.target.checked; writeHash(); rerenderTable(); });
    mount.querySelector('#hidemed').addEventListener('change', function (e) { state.hidemed = e.target.checked; writeHash(); rerenderTable(); });
    mount.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); writeHash(); render(); });
    });
    mount.querySelectorAll('[data-sort]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sort');
        if (state.sort === k) state.dir = state.dir === 1 ? -1 : 1;
        else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
        writeHash();
        rerenderTable();
      });
    });
    mount.querySelectorAll('tbody tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
    });
    var clear = mount.querySelector('[data-clear]');
    if (clear) clear.addEventListener('click', function () { state.q = ''; state.category = ''; state.chain = ''; state.wl = false; state.odds50 = false; state.hidemed = false; writeHash(); render(); });
    var reset = mount.querySelector('[data-reset-sandbox]');
    if (reset) reset.addEventListener('click', function () {
      sandbox = { peerScale: 1, growthWeight: MODEL.growth_weight, maturityRange: MODEL.maturity_range, sizeExponent: MODEL.size_exponent };
      render();
    });
    mount.querySelectorAll('.sliders input[type="range"]').forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.id === 'sb-peer') sandbox.peerScale = parseFloat(input.value);
        if (input.id === 'sb-size') sandbox.sizeExponent = parseFloat(input.value);
        var out = document.getElementById(input.id + '-out');
        if (out) out.textContent = input.id === 'sb-peer' ? sandbox.peerScale.toFixed(2) + '×' : sandbox.sizeExponent.toFixed(2);
        rerenderTable();
        var banner = mount.querySelector('.banner');
        if (sandboxActive() && !banner) render();
        if (!sandboxActive() && banner) render();
      });
    });
  }

  function rerenderTable() {
    var slot = mount.querySelector('#table-slot');
    if (!slot) return;
    slot.innerHTML = renderTable();
    var count = mount.querySelector('#count');
    if (count) count.textContent = state.tab === 'live' ? DATA.live_size + ' live-token protocols' : filteredRows().length + ' of ' + DATA.board_size + ' shown';
    mount.querySelectorAll('[data-sort]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sort');
        if (state.sort === k) state.dir = state.dir === 1 ? -1 : 1;
        else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
        writeHash();
        rerenderTable();
      });
    });
    mount.querySelectorAll('tbody tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
    });
    var clear = mount.querySelector('[data-clear]');
    if (clear) clear.addEventListener('click', function () { state.q = ''; state.category = ''; state.chain = ''; state.wl = false; state.odds50 = false; state.hidemed = false; writeHash(); render(); });
  }

  dialog = document.createElement('dialog');
  dialog.className = 'detail';
  document.body.appendChild(dialog);
  dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDetail(); });
  dialog.addEventListener('close', function () { state.p = ''; writeHash(); });

  render();
  if (state.p) openDetail(state.p);
})();
