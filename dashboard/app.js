'use strict';
(function () {
  var DATA = window.RADAR;
  var mount = document.getElementById('board');
  if (!DATA) {
    mount.innerHTML = '<div class="shell"><div class="panel empty"><h2>Token Radar: no data</h2><p>The dashboard needs data.js next to it. Re-run main.ts, or open the built output, not this source folder.</p></div></div>';
    return;
  }
  var MODEL = DATA.model;

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

  /** The model, recomputed in the page from the snapshot's own figures, so the board and the code agree. */
  function growthOf(row, growthWeight) {
    var g = row.change_7d == null ? 0 : clamp(row.change_7d, MODEL.growth_floor, MODEL.growth_cap);
    return 1 + (g / 100) * growthWeight;
  }
  function maturityOf(row, maturityRange) {
    var age = row.age_days == null ? MODEL.unknown_age_days : row.age_days;
    return MODEL.maturity_floor + (clamp(age, 0, MODEL.maturity_days) / MODEL.maturity_days) * maturityRange;
  }
  function impliedOf(row, sb) {
    var peer = row.peer_multiple * (sb ? sb.peerScale : 1);
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
  function farmSteps(row) {
    var chain = chainOf(row);
    var capital = capitalFor(row);
    var hold = holdDaysFor(row.age_days);
    var gas = gasFor(chain);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(row, capital, chain), cost: '$' + capital + ' of capital and ' + gas, time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: gas + ' a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Open the protocol\'s own points or rewards page and check whether it runs one; claim only from the link that page publishes, and never pay to claim.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Check the protocol\'s announcements once a week: a launch is usually preceded by a points snapshot or a governance post, and the position must be open when it lands.', cost: 'nothing but the check', time: '5 minutes a week' },
      { text: 'Write the wallet, the dates and every transaction in a farm log; when you unwind, withdraw in tranches and keep a small position until any claim window has closed.', cost: gas + ' to exit', time: '10 minutes to unwind' },
    ];
  }

  /** The state the URL carries, so a view can be linked and screenshotted. */
  function readHash() {
    var h = (location.hash || '').replace(/^#/, '');
    var s = { q: '', category: '', chain: '', wl: false, tab: 'pre', p: '', sort: 'rank', dir: 1 };
    h.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv.length !== 2) return;
      var k = decodeURIComponent(kv[0]);
      var v = decodeURIComponent(kv[1]);
      if (k === 'q') s.q = v;
      if (k === 'category') s.category = v;
      if (k === 'chain') s.chain = v;
      if (k === 'wl') s.wl = v === '1';
      if (k === 'tab') s.tab = v === 'live' ? 'live' : 'pre';
      if (k === 'p') s.p = v;
      if (k === 'sort') s.sort = v;
      if (k === 'dir') s.dir = v === '-1' ? -1 : 1;
    });
    return s;
  }
  var state = readHash();
  var sandbox = { peerScale: 1, growthWeight: MODEL.growth_weight, maturityRange: MODEL.maturity_range };
  function sandboxActive() {
    return sandbox.peerScale !== 1 || sandbox.growthWeight !== MODEL.growth_weight || sandbox.maturityRange !== MODEL.maturity_range;
  }
  function writeHash() {
    var parts = [];
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category) parts.push('category=' + encodeURIComponent(state.category));
    if (state.chain) parts.push('chain=' + encodeURIComponent(state.chain));
    if (state.wl) parts.push('wl=1');
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
      '<div><span>Peer multiple × growth × maturity</span><b>' + row.peer_multiple.toFixed(4) + ' × ' + growthOf(row, MODEL.growth_weight).toFixed(3) + ' × ' + maturityOf(row, MODEL.maturity_range).toFixed(3) + '</b></div>' +
      '<div><span>Age with no token</span><b>' + ageLabel(row.age_days) + '</b></div></div>' +
      '<p class="sub">The peer multiple is ' + esc(peer) + ', clamped to 0.05–1.00. Growth is ' + fmtPct(row.change_7d) + ' over 7 days, clamped to −50…+100% and half-weighted. Maturity rises with age to 730 days; a protocol with no listing date is priced at 365 days.</p>' +
      (recomputed === row.implied_value_usd
        ? '<p class="sub">The dashboard recomputed this value from the snapshot\'s own figures and landed on the same dollar board.json carries.</p>'
        : '<p class="sub">The dashboard recomputed ' + fmtUsd(recomputed) + ' from the snapshot\'s own figures; board.json carries ' + fmtUsd(row.implied_value_usd) + '. The two should agree.</p>') +
      '</div>' +
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
        '<td class="num">' + r.peer_multiple.toFixed(2) + '<br><span class="sub">' + (r.peer_from_category ? r.peer_count + ' peers' : 'market') + '</span></td>' +
        '<td class="implied"><div class="bar"><i style="width:' + Math.max(2, Math.round(it.value / max * 100)) + '%"></i></div><b>' + fmtUsd(it.value) + '</b>' + (sb ? ' <span class="sub">sandbox</span>' : '') + '</td>' +
        '<td><span class="status hot">pre-token</span></td></tr>';
    }).join('');
    if (!rowsHtml) {
      return '<div class="panel empty"><h2>No protocol matches</h2><p>Try a shorter search, another category, or clear the watchlist filter.</p><button class="button" type="button" data-clear>Clear the filters</button></div>';
    }
    return '<div class="panel"><div class="table-wrap"><table><caption>' + items.length + ' pre-token protocol' + (items.length === 1 ? '' : 's') + ', ranked by implied launch value' + (sb ? ' under the sandbox model' : '') + '. Click a row for the model and the farm plan.</caption><thead><tr>' +
      th('Rank', 'rank', 'num') + th('Protocol', 'name') + th('TVL', 'tvl', 'num') + th('7d', 'growth', 'num') + th('Age', 'age', 'num') + th('Peer', 'peer', 'num') + th('Implied value', 'value', 'num') + '<th>Token</th></tr></thead><tbody>' +
      rowsHtml + '</tbody></table></div></div>';
  }

  function renderModel() {
    var peers = Object.keys(DATA.peers).sort().map(function (k) { return { category: k, entry: DATA.peers[k] }; });
    var rows = peers.map(function (p) {
      return '<tr><td>' + esc(p.category) + '</td><td class="num">' + p.entry.n + '</td><td class="num">' + p.entry.multiple.toFixed(4) + '</td><td>' + (p.entry.from_category ? 'category peers' : 'market-wide median') + '</td></tr>';
    }).join('');
    return '<section class="panel model" aria-label="The model"><h2>The model: worth what its peers trade for</h2>' +
      '<p>Each category is priced at the median market-cap / TVL of its live-token peers, when the category has at least five live peers; otherwise the market-wide median. The multiple is clamped to 0.05–1.00, so no launch is priced above its own TVL on a market-cap basis and no category is priced on one thin outlier. Growth and age then scale the base: a growing protocol is worth more, and a protocol that has held its TVL for years with no token is worth more than one listed last month.</p>' +
      '<p class="formula">implied = TVL × peer&nbsp;&nbsp;×&nbsp;&nbsp;(1 + clamp(7d, −50, 100) / 100 × ' + MODEL.growth_weight + ')&nbsp;&nbsp;×&nbsp;&nbsp;(0.7 + min(age, 730) / 730 × 0.3)</p>' +
      '<table class="peer-table"><thead><tr><th>Category</th><th class="num">Live peers</th><th class="num">Multiple</th><th>Priced on</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="sub">Market-wide median mcap / TVL: ' + DATA.overall_peer_multiple.toFixed(4) + '. ' + DATA.board_size + ' protocols ranked; ' + DATA.watchlist_size + ' on the watchlist, all covered; ' + DATA.early_size + ' more below the $' + (DATA.floor_usd / 1e6) + 'M floor. Live-token protocols are set aside and shown as the market\'s own values, never mixed into the ranking.</p>' +
      '<div class="sandbox"><h3>Model sandbox</h3><p>Change the constants and watch the board re-rank. This only changes the view in this page; the submitted board is the one main.ts wrote with the constants above.</p>' +
      '<div class="sliders">' +
      '<div><label for="sb-peer">Peer multiple scale: <output id="sb-peer-out">' + sandbox.peerScale.toFixed(2) + '×</output></label><input id="sb-peer" type="range" min="0.5" max="2" step="0.05" value="' + sandbox.peerScale + '"></div>' +
      '<div><label for="sb-growth">Growth weight: <output id="sb-growth-out">' + sandbox.growthWeight.toFixed(2) + '</output></label><input id="sb-growth" type="range" min="0" max="1" step="0.05" value="' + sandbox.growthWeight + '"></div>' +
      '<div><label for="sb-maturity">Maturity range: <output id="sb-maturity-out">' + sandbox.maturityRange.toFixed(2) + '</output></label><input id="sb-maturity" type="range" min="0" max="0.6" step="0.05" value="' + sandbox.maturityRange + '"></div>' +
      '</div></div></section>';
  }

  function render() {
    var sb = sandboxActive();
    var wlCount = 0;
    DATA.rows.forEach(function (r) { if (isWatchlist(r.slug)) wlCount++; });
    mount.innerHTML = '<div class="shell">' +
      '<header class="top"><div class="brand"><span class="mark" aria-hidden="true"></span>Token Radar</div>' +
      '<div class="top-meta"><span>Snapshot ' + esc(DATA.as_of) + '</span><span>Model ' + esc(DATA.model_version) + '</span><span>' + DATA.board_size + ' rows</span></div></header>' +
      '<section class="lede"><h1>The protocols with no token yet, ranked by what a launch would be worth</h1>' +
      '<p>One sealed DefiLlama snapshot, ' + DATA.board_size + ' pre-token protocols, each priced like its live-token peers. The watchlist is the floor, never the ceiling: every watchlist protocol is here, and so is every other pre-token protocol the rule would rank. Click a row for the model behind its number and a plan to farm it.</p>' +
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
      '<div class="tabs"><button type="button" data-tab="pre" aria-pressed="' + (state.tab === 'pre') + '">Pre-token</button><button type="button" data-tab="live" aria-pressed="' + (state.tab === 'live') + '">Live token</button></div>' +
      '<span class="count" id="count"></span></div>' +
      (sb ? '<div class="banner"><span>Sandbox view: the board is re-ranked under the model constants you changed. This is not the submitted board.</span><button type="button" data-reset-sandbox>Reset the model</button></div>' : '') +
      '<div id="table-slot"></div>' +
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
    if (clear) clear.addEventListener('click', function () { state.q = ''; state.category = ''; state.chain = ''; state.wl = false; writeHash(); render(); });
    var reset = mount.querySelector('[data-reset-sandbox]');
    if (reset) reset.addEventListener('click', function () {
      sandbox = { peerScale: 1, growthWeight: MODEL.growth_weight, maturityRange: MODEL.maturity_range };
      render();
    });
    mount.querySelectorAll('.sliders input[type="range"]').forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.id === 'sb-peer') sandbox.peerScale = parseFloat(input.value);
        if (input.id === 'sb-growth') sandbox.growthWeight = parseFloat(input.value);
        if (input.id === 'sb-maturity') sandbox.maturityRange = parseFloat(input.value);
        var out = document.getElementById(input.id + '-out');
        if (out) out.textContent = input.id === 'sb-peer' ? sandbox.peerScale.toFixed(2) + '×' : (input.id === 'sb-growth' ? sandbox.growthWeight : sandbox.maturityRange).toFixed(2);
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
    if (clear) clear.addEventListener('click', function () { state.q = ''; state.category = ''; state.chain = ''; state.wl = false; writeHash(); render(); });
  }

  dialog = document.createElement('dialog');
  dialog.className = 'detail';
  document.body.appendChild(dialog);
  dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDetail(); });
  dialog.addEventListener('close', function () { state.p = ''; writeHash(); });

  render();
  if (state.p) openDetail(state.p);
})();
