/* KulkasKita - web app (vanilla JS, data stored in localStorage)
 *
 * Map of this file:
 *   1. Asset config     : mascot moods, poses, close-up mascot, navbar icons
 *   2. State & storage  : S is saved to localStorage
 *   3. UI components    : mascot, topbar, navbar, item row, hero card, gauge card, freshness popup
 *   4. Screens (V.*)    : each V.xxx function returns the HTML of one screen (incl. V.tutorial)
 *   5. OCR pipeline     : photo -> CROP -> preprocess -> Tesseract -> line parser -> highlight -> review
 *   6. Events & router  : clicks, inputs, hash router (#/home, #/scan, #/tutorial/0 ...)
 */
(function () {
  const $app = document.getElementById('app');
  const KEY = 'kulkaskita.v2';
  const MEALS = ['Breakfast', 'Lunch', 'Snack', 'Drink', 'Dinner'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ================= 1. ASSET CONFIG ================= */
  // Status mascot: assets/mascot-<level>.png  (aman, baik, cukup, hampir, basi)
  const LEVEL_ORDER = ['aman', 'baik', 'cukup', 'hampir', 'basi'];
  const LEVEL_NOTE = {
    aman: 'Cheerful. Everything is fresh.',
    baik: 'Calm. Looking good, keep an eye on it.',
    cukup: 'Sweating. Starting to need attention.',
    hampir: 'Panicking! Cook it before it expires.',
    basi: 'Queasy. Past its date, check before eating.',
  };
  // Full-body poses: assets/pose-<n>.png. To swap a pose on a screen, just change its number here.
  const POSE = { login: 5, add: 3, empty: 3, happy: 6, recipes: 5 };
  // CLOSE-UP mascot (head only, sharper than the full-body pose) for the splash and onboarding screens.
  // The value is a mood file: assets/mascot-<mood>.png (aman, baik, cukup, hampir, basi). Change the mood per screen here.
  const CLOSE = { splash: 'aman', onb1: 'aman', onb2: 'cukup', onb3: 'baik' };
  // Navbar icons: assets/<file>; the emoji is used if the file is missing.
  const NAV = {
    home: ['nav-home.png', '🏠', 'Home'],
    fridge: ['nav-fridge.png', '🧊', 'Fridge'],
    add: ['nav-add.png', '+', 'Add item'],
    shopping: ['nav-shop.png', '🛒', 'Shopping list'],
    mealplan: ['nav-meal.png', '🍽️', 'Meal plan'],
  };

  /* ================= 2. STATE ================= */
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return d; } catch (e) { /* ignore */ }
    return { user: null, items: [], history: [], shopping: [], plan: {}, notif: false, lastNotif: '' };
  }
  let S = load();
  // Tutorial mode swaps S for an empty copy (tutBackup holds the real data) and save() is paused, so nothing is lost.
  let tutBackup = null, tutI = 0, tutFrom = '', tutDid = {};
  let crop = null; // photo crop editor state: { cv: canvas, box: {x,y,w,h} (0..1), url }
  function save() { if (tutBackup) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  const uid = () => Math.random().toString(36).slice(2, 9);
  // Demo-level password hash (this app has no server, so accounts live only on this device).
  // SHA-256 when the browser allows it (https/localhost), a simple fallback hash otherwise.
  async function hashPw(txt) {
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); }
    catch (e) { let h = 5381; for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0; return 'f' + h; }
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => new Date();
  const fmt = iso => { const d = new Date(iso + 'T00:00:00'); return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  const dl = it => KK.daysLeft(it.expiry);
  const lv = it => KK.level(dl(it));                 // level object: {key:'hampir', color, label, ...}
  const sorted = () => S.items.slice().sort((a, b) => dl(a) - dl(b));
  let timer = null, draft = [], rest = [], selDay = KK.toISODate(today());

  function seed() {
    const t = today();
    const mk = (name, qty, days) => {
      const f = KK.guessItem(name, qty);
      return { id: uid(), name: f.name, qty, cat: f.cat, emoji: f.emoji, bought: KK.toISODate(KK.addDays(t, days - f.days)), expiry: KK.toISODate(KK.addDays(t, days)) };
    };
    S.items = [mk('Bok choy', 2, 2), mk('Spinach', 1, 4), mk('Tomato', 2, 6), mk('Cabbage', 2, 9), mk('Eggs', 10, 14), mk('Garlic', 1, 20)];
    S.history = [];
    for (let i = 0; i < 34; i++) S.history.push({ type: 'used' });
    for (let i = 0; i < 6; i++) S.history.push({ type: 'wasted' });
  }

  /* ================= 3. UI COMPONENTS ================= */
  // Fallback SVG mascot if the PNG is missing
  function svgBear(key, style) {
    const tint = key === 'hampir' ? '#e6d3ff' : key === 'basi' ? '#bfe8ae' : '#ffffff';
    const mouth = key === 'aman' ? '<path d="M92 112q8 9 16 0" stroke="#2b3a4a" stroke-width="3" fill="none" stroke-linecap="round"/>'
      : key === 'basi' || key === 'hampir' ? '<path d="M92 118q8-8 16 0" stroke="#2b3a4a" stroke-width="3" fill="none" stroke-linecap="round"/>'
      : '<circle cx="100" cy="114" r="3" fill="#2b3a4a"/>';
    const sweat = key === 'cukup' ? '<path d="M138 70q6 10 0 14q-6-4 0-14z" fill="#7cc4ff"/>' : '';
    return '<svg class="mascot" viewBox="0 0 200 200" style="' + esc(style || '') + '" role="img" aria-label="KulkasKita mascot">' +
      '<circle cx="48" cy="52" r="22" fill="' + tint + '" stroke="#dbe8ee" stroke-width="3"/><circle cx="152" cy="52" r="22" fill="' + tint + '" stroke="#dbe8ee" stroke-width="3"/>' +
      '<circle cx="100" cy="95" r="62" fill="' + tint + '" stroke="#dbe8ee" stroke-width="3"/>' +
      '<circle cx="78" cy="92" r="5" fill="#2b3a4a"/><circle cx="122" cy="92" r="5" fill="#2b3a4a"/>' + mouth + sweat +
      '<rect x="40" y="148" width="120" height="22" rx="11" fill="#99D6DF"/><rect x="118" y="150" width="22" height="42" rx="8" fill="#7797C0" opacity=".6"/></svg>';
  }
  window.KKfb = function (img, key) { img.onerror = null; img.outerHTML = svgBear(key, img.getAttribute('style')); };
  window.KKnav = function (img) { img.onerror = null; const s = document.createElement('span'); s.className = 'emo'; s.textContent = img.dataset.e; img.replaceWith(s); };

  // Mascot head for a level (aman/baik/cukup/hampir/basi)
  const head = (key, style, cls) => '<img class="mascot head ' + (cls || '') + '" src="assets/mascot-' + key + '.png" alt="Mascot mood: ' + esc(KK.LEVELS[key].label) + '" style="' + esc(style || '') + '" onerror="KKfb(this,\'' + key + '\')">';
  // Full-body mascot (pose-1..6)
  const pose = (name, style, cls) => '<img class="mascot pose ' + (cls || '') + '" src="assets/pose-' + POSE[name] + '.png" alt="KulkasKita mascot" style="' + esc(style || '') + '" onerror="KKfb(this,\'aman\')">';

  const name = () => (S.user && S.user.name) || 'Kay';
  const alerts = () => S.items.filter(i => dl(i) <= 3);
  // Fridge state = state of the WORST item (closest to expiry)
  function fridgeState() {
    if (!S.items.length) return { key: 'baik', empty: true, item: null, counts: {} };
    const w = sorted()[0], counts = {};
    S.items.forEach(i => { const k = lv(i).key; counts[k] = (counts[k] || 0) + 1; });
    return { key: lv(w).key, empty: false, item: w, counts };
  }
  function topbar() {
    const n = alerts().length, fs = fridgeState();
    return '<div class="topbar"><button class="avatar" data-go="profile" aria-label="Profile">' + head(fs.key) + '</button>' +
      '<div class="hello">Hello ' + esc(name()) + '!</div>' +
      '<button class="icon-btn" data-go="profile" aria-label="Settings">⚙️</button>' +
      '<button class="icon-btn" data-go="notifications" aria-label="Notifications">🔔' + (n ? '<span class="badge">' + n + '</span>' : '') + '</button></div>';
  }
  function nav(active) {
    const b = k => '<button class="' + (active === k ? 'active ' : '') + (k === 'add' ? 'plus' : '') + '" data-go="' + k + '" aria-label="' + NAV[k][2] + '"' + (active === k ? ' aria-current="page"' : '') + '>' +
      '<img src="assets/' + NAV[k][0] + '" alt="" data-e="' + NAV[k][1] + '" onerror="KKnav(this)"></button>';
    return '<nav class="nav">' + ['home', 'fridge', 'add', 'shopping', 'mealplan'].map(b).join('') + '</nav>';
  }
  function screen(inner, active, opts) {
    opts = opts || {};
    return '<div class="screen">' + (opts.bar === false ? '' : topbar()) + '<div class="content' + (active ? '' : ' no-nav') + '">' + inner + '</div>' + (active ? nav(active) : '') + '</div>';
  }
  const titleBar = (t, back) => '<div class="page-title">' + (back ? '<button class="back" data-go="' + back + '" aria-label="Back">‹</button>' : '') + esc(t) + '</div>';
  const pillFor = l => '<span class="pill" style="background:' + l.color + '">' + esc(l.short) + '</span>';

  // One item row: mascot head for its level + freshness progress bar
  function itemRow(it) {
    const l = lv(it), fr = KK.freshness(it);
    return '<button class="row" data-go="item/' + it.id + '"><div class="thumb hd">' + head(l.key) + '</div>' +
      '<div class="info"><b>' + esc(it.name) + ' - ' + KK.dayText(dl(it)) + ' ' + it.emoji + '</b><small>Qty: ' + esc(it.qty) + ' · ' + esc(it.cat) + '</small>' +
      '<div class="life" role="img" aria-label="' + Math.round(fr * 100) + ' percent freshness left"><i style="width:' + Math.max(6, fr * 100) + '%;background:' + l.color + '"></i></div></div>' +
      (['cukup', 'hampir', 'basi'].includes(l.key) ? pillFor(l) : '') + '<span class="chev">›</span></button>';
  }

  // Main home card: mascot expression = fridge state. Tapping the bear (or the "i") opens the freshness guide popup.
  function hero(fs) {
    let title, sub, btn;
    if (fs.empty) { title = 'Your fridge is empty'; sub = "Log your groceries and I'll keep watch so nothing goes to waste!"; btn = '<button class="btn small primary" data-go="add">Add to fridge</button>'; }
    else if (fs.key === 'aman') { title = 'Your fridge is safe! 😊'; sub = 'Everything is fresh. Keep it up!'; btn = '<button class="btn small primary" data-go="fridge">View fridge</button>'; }
    else if (fs.key === 'baik') { title = 'Your fridge looks good'; sub = 'Closest to expiry: ' + fs.item.name + ', ' + KK.dayText(dl(fs.item)) + '. Plan a meal!'; btn = '<button class="btn small primary" data-go="mealplan">Plan meals</button>'; }
    else {
      const m = KK.itemMsg(fs.item); title = m.title; sub = m.sub;
      btn = fs.key === 'basi' ? '<button class="btn small primary" data-go="item/' + fs.item.id + '">Check item</button>'
        : '<button class="btn small primary" data-act="recipe-for" data-id="' + fs.item.id + '">Find recipes</button>';
    }
    return '<div class="hero" style="--c:' + KK.LEVELS[fs.key].color + '"><div class="txt"><h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p>' + btn + '</div>' +
      '<button class="hero-bear" data-act="legend" aria-label="What do the bear\'s moods mean?">' + head(fs.key, '', 'mood-' + fs.key) + '</button>' +
      '<button class="info-btn" data-act="legend" aria-label="Freshness guide">i</button></div>';
  }

  // Segmented half-circle gauge (SVG). pct: 0..100 or null (no history yet)
  function gaugeSvg(pct) {
    const cx = 150, cy = 150, r = 118, sw = 40, gap = 4, seg = 45;
    const pt = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
    const arc = (a0, a1) => { const p0 = pt(a0), p1 = pt(a1); return 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 0 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1); };
    let track = '', fill = '';
    for (let i = 0; i < 4; i++) {
      const a0 = 180 + i * seg + gap / 2, a1 = 180 + (i + 1) * seg - gap / 2;
      track += '<path d="' + arc(a0, a1) + '" stroke="#e6edef" stroke-width="' + sw + '" fill="none"/>';
      const f = Math.max(0, Math.min(1, (pct || 0) / 100 * 4 - i));
      if (f > 0) { const d = arc(a0, a0 + (a1 - a0) * f); fill += '<path d="' + d + '" stroke="url(#gg)" stroke-width="' + sw + '" fill="none"/><path d="' + d + '" stroke="url(#gs)" stroke-width="' + sw + '" fill="none"/>'; }
    }
    return '<svg viewBox="8 8 284 148" role="img" aria-label="' + (pct == null ? 'No rescue data yet' : pct + ' percent of food used before expiring') + '">' +
      '<defs><linearGradient id="gg" gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="270" y2="0"><stop offset="0" stop-color="#f3d84a"/><stop offset=".5" stop-color="#8fcf4a"/><stop offset="1" stop-color="#2fb344"/></linearGradient>' +
      '<pattern id="gs" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="7" fill="#fff" opacity=".2"/></pattern></defs>' + track + fill + '</svg>';
  }
  function gaugeCard() {
    const st = KK.stats(S.items, S.history);
    return '<div class="card gauge-card"><div class="g-title">Food rescue</div><div class="g-sub">Current status</div>' +
      '<div class="g-big">' + st.saved + '<span> items used in time</span></div>' +
      '<div class="g-trend">' + (st.wasted ? st.wasted + ' wasted so far' : 'Nothing wasted so far 🎉') + '</div>' +
      '<div class="gauge">' + gaugeSvg(st.pct) + '<div class="g-center"><b>' + (st.pct == null ? '–' : st.pct + '%') + '</b><small>' + (st.pct == null ? 'Use or log an item to start' : 'of your food used before it expired') + '</small></div></div>' +
      '<p class="g-note">🌍 You save food = you make the Earth a better place.</p>' +
      '<p class="g-fyi">FYI: food waste causes 8-10% of global greenhouse gas emissions (UNEP, 2024).</p></div>';
  }

  // Freshness guide popup: the 5 levels, with item counts. Tap a level to filter the fridge.
  function legendModal() {
    const fs = fridgeState();
    modal('<h3>Freshness indicator</h3><p style="font-size:12px;color:var(--muted);margin-bottom:10px">The bear\'s mood shows how fresh your fridge is. Tap a level to see those items.</p>' +
      LEVEL_ORDER.map(k => { const L = KK.LEVELS[k], n = fs.counts[k] || 0;
        return '<button class="legend-row" data-act="lvl" data-v="' + k + '" style="--c:' + L.color + '">' + head(k, 'width:54px;flex-shrink:0') + '<div class="lg-txt"><b>' + L.code + ' · ' + esc(L.label) + '</b><small>' + esc(L.range) + '</small><small>' + esc(LEVEL_NOTE[k]) + '</small></div><span class="cnt">' + n + '</span></button>'; }).join('') +
      '<button class="btn yellow" data-act="ff">⏩ Demo: fast-forward 1 day</button><button class="btn" data-act="close">Close</button>');
  }
  function toast(msg, good) {
    const old = $app.querySelector('.toast'); if (old) old.remove();
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = (good ? pose('happy', 'height:40px') : '') + '<span>' + esc(msg) + '</span>'; $app.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  function modal(html) {
    closeModal();
    const m = document.createElement('div'); m.className = 'modal-bg'; m.id = 'modal';
    m.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
    m.addEventListener('click', e => { if (e.target === m) closeModal(); });
    $app.appendChild(m);
  }
  function closeModal() { const m = document.getElementById('modal'); if (m) m.remove(); }
  const go = r => { closeModal(); location.hash = '#/' + r; };
  const emptyBox = txt => '<div class="empty">' + pose('empty', 'height:150px') + '<br>' + txt + '</div>';

  /* ================= 4. SCREENS ================= */
  const V = {};

  V.splash = () => {
    timer = setTimeout(() => go(S.user ? 'home' : 'onb/1'), 2200);
    return '<div class="screen splash"><div class="splash-title"><h1>KulkasKita</h1><p>Eat it before it expires.</p></div><div class="big-bear">' + head(CLOSE.splash, '', 'close mood-' + CLOSE.splash) + '</div></div>';
  };

  // Small line icons for the onboarding chips
  const IC = {
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 9v6M12 9v6M16 9v6"/>',
    box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
    bell: '<path d="M12 5a6 6 0 0 0-6 6v4l-2 2h16l-2-2v-4a6 6 0 0 0-6-6zM10 20h4M12 2v3"/>',
    bars: '<path d="M5 20v-5M10 20V9M15 20v-8M20 20V5"/>',
    doc: '<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/>',
    cal: '<path d="M5 5h14v15H5zM9 3v4M15 3v4M5 10h14M9 14h2"/>',
  };
  const chipIc = n => '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>';
  const ONB = [
    ['Scan your receipt,<br>skip the typing', 'Snap one photo. We read every item and set its shelf life.', [['scan', 'OCR Scan'], ['box', 'Auto category']], 'onb1'],
    ['Know what to<br>eat first', "Colors show what's fresh and what's fading. We nudge you 1 to 3 days early.", [['bell', 'Smart Alerts'], ['bars', 'Color Status']], 'onb2'],
    ['Turn leftovers into<br>dinner', "Get quick recipes from what's already in your fridge. Less waste, less spending.", [['doc', 'Recipe Rescue'], ['cal', 'Meal plan']], 'onb3'],
  ];
  V.onb = n => {
    n = Math.min(3, Math.max(1, +n || 1)); const o = ONB[n - 1];
    tutFrom = '';
    const btns = n === 1 ? '<button class="onb-btn" data-go="onb/2">Next</button><p class="onb-link">Have an account? <button data-go="login">Log in</button></p>'
      : n === 2 ? '<button class="onb-btn" data-go="onb/3">Next</button><button class="onb-link" data-go="onb/1">Back</button>'
      : '<button class="onb-btn" data-go="login">Get Started</button><button class="onb-link" data-go="onb/2">Back</button>';
    return '<div class="screen onb"><div class="onb-top"><span>' + n + '/3</span>' + (n < 3 ? '<button data-go="login">SKIP</button>' : '') + '</div>' +
      '<div class="onb-card"><img class="mascot close" src="assets/mascot-closeup' + n + '.png" alt="KulkasKita mascot" onerror="this.onerror=null;this.src=\'assets/mascot-aman.png\'"></div>' +
      '<h2>' + o[0] + '</h2><p class="onb-desc">' + o[1] + '</p><div class="onb-chips">' + o[2].map(c => '<span class="onb-chip">' + chipIc(c[0]) + c[1] + '</span>').join('') + '</div>' +
      '<div class="onb-actions">' + btns + '</div></div>';
  };

  // LOGIN (required): nickname + email + password are all validated in the 'login' action below.
  V.login = () => '<div class="screen onb login"><div style="text-align:center">' + pose('login', 'height:150px;margin:0 auto') + '<h2>Welcome!</h2><p>Sign in to start protecting your fridge.</p></div>' +
    '<label for="lname">Nickname</label><input id="lname" class="input" placeholder="e.g. Kay" maxlength="20" value="' + esc(S.user ? S.user.name : '') + '" autocomplete="nickname">' +
    '<label for="lmail">Email</label><input id="lmail" class="input" type="email" placeholder="name@email.com" autocomplete="email">' +
    '<label for="lpass">Password</label><input id="lpass" class="input" type="password" placeholder="At least 6 characters" autocomplete="current-password">' +
    '<div class="field-err" id="lerr" role="alert"></div>' +
    '<button class="btn primary" data-act="login">Sign in</button><p style="text-align:center;font-size:11px;color:var(--muted);margin-top:10px">New email = a new account is created on this device. Your data stays on this device. We fill your fridge with sample items, then show a quick tutorial you can skip.</p></div>';

  // HOME: only 4 blocks -> expiring card, rescue gauge, fridge list, recipe ideas
  V.home = () => {
    const fs = fridgeState(), top = KK.suggestRecipes(S.items).slice(0, 5);
    let h = '<div class="section-title"><span>Protect Your Food!</span></div>' + hero(fs) + gaugeCard() +
      '<div class="section-title"><span>Your Fridge</span><a data-go="fridge">View all</a></div>';
    h += S.items.length ? sorted().slice(0, 4).map(itemRow).join('') : emptyBox('Your fridge is empty.<br>Tap + to add items.');
    if (top.length) h += '<div class="section-title"><span>Recipe Ideas</span><a data-go="recipes">View all</a></div><div class="hscroll">' + top.map(recipeMini).join('') + '</div>';
    return screen(h, 'home');
  };

  V.fridge = () => {
    const fs = fridgeState(), c = V._cat || 'All', q = (V._q || '').toLowerCase(), lk = V._lvl || '';
    const cats = ['All'].concat([...new Set(S.items.map(i => i.cat))]);
    const list = sorted().filter(i => (c === 'All' || i.cat === c) && i.name.toLowerCase().includes(q) && (!lk || lv(i).key === lk));
    const lvlChips = [''].concat(LEVEL_ORDER).map(k => { const on = lk === k, n = k ? (fs.counts[k] || 0) : S.items.length;
      return '<button class="chip' + (on ? ' on' : '') + '" data-act="lvl" data-v="' + k + '">' + (k ? '<i class="dot" style="background:' + KK.LEVELS[k].color + '"></i> ' + esc(KK.LEVELS[k].short) : 'All') + ' ' + n + '</button>'; }).join('');
    let h = titleBar('Your Fridge') + '<input class="input" id="search" placeholder="Search items..." value="' + esc(V._q || '') + '" aria-label="Search items">' +
      '<div class="chips" style="margin:10px 0 4px">' + lvlChips + '</div><div style="text-align:right;margin:0 4px 6px"><button class="linkbtn" data-act="legend">Freshness guide ›</button></div>' +
      '<div class="chips" style="margin:0 0 10px">' + cats.map(k => '<button class="chip' + (k === c ? ' on' : '') + '" data-act="cat" data-v="' + esc(k) + '">' + esc(k) + '</button>').join('') + '</div>';
    h += list.length ? list.map(itemRow).join('') : emptyBox('Nothing here yet.');
    return screen(h, 'fridge');
  };

  V.item = id => {
    const it = S.items.find(i => i.id === id); if (!it) return screen(titleBar('Fridge item', 'fridge') + emptyBox('Item not found.'), 'fridge');
    const l = lv(it), m = KK.itemMsg(it);
    return screen(titleBar('Fridge item', 'fridge') +
      '<div class="hero" style="--c:' + l.color + '"><div class="txt"><h2>' + esc(m.title) + '</h2><p>' + esc(m.sub) + '</p><span class="pill" style="background:' + l.color + '">' + l.code + ' · ' + esc(l.label) + '</span></div>' + head(l.key, '', 'mood-' + l.key) + '</div>' +
      '<div class="detail-banner">' + it.emoji + ' ' + esc(it.name) + '<span class="pill blue" style="margin-left:auto">' + esc(it.cat) + '</span></div>' +
      '<div class="detail-body"><div class="kv"><span>Expiry date</span><input class="input" style="width:150px;padding:6px 8px" type="date" data-field="expiry" data-id="' + it.id + '" value="' + it.expiry + '" aria-label="Expiry date"></div>' +
      '<div class="kv"><span>Bought on</span><b>' + fmt(it.bought) + '</b></div>' +
      '<div class="kv"><span>Quantity</span><input class="input" style="width:90px;padding:6px 8px" type="number" min="1" data-field="qty" data-id="' + it.id + '" value="' + esc(it.qty) + '" aria-label="Quantity"></div>' +
      '<div class="kv"><span>Food status</span><b style="color:' + l.color + '">' + KK.dayText(dl(it)) + '</b></div>' +
      '<div class="life big" aria-hidden="true"><i style="width:' + Math.max(4, KK.freshness(it) * 100) + '%;background:' + l.color + '"></i></div></div>' +
      '<button class="btn primary" data-act="recipe-for" data-id="' + it.id + '">Find recipes with this item</button>' +
      '<div class="btn-row"><button class="btn" data-act="used" data-id="' + it.id + '">✓ Used up</button><button class="btn danger" data-act="wasted" data-id="' + it.id + '">Wasted</button></div>', 'fridge');
  };

  V.add = () => screen(titleBar('Add to Fridge') +
    '<div class="card"><div class="mascot-row"><div style="width:84px;flex-shrink:0">' + pose('add') + '</div><div class="bubble"><b>Just got back from shopping?</b>Log your groceries in your virtual fridge so nothing goes to waste!</div></div></div>' +
    '<button class="choice" data-go="scan"><div class="ic">📷</div><div><b>Scan Receipt</b><small>AI recommended · automatically logs item names, quantities and estimated expiry dates</small></div></button>' +
    '<button class="choice" data-go="manual"><div class="ic">✏️</div><div><b>Add Manually</b><small>Type the item name, quantity and storage date yourself</small></div></button>', 'add');

  // SCAN: camera frame. Flow: pick photo -> crop editor (#cropctl) -> "Save & scan" -> OCR. Normal buttons live in #scanctl.
  const ghostBtn = 'style="color:#fff;border-color:#fff;background:transparent"';
  V.scan = () => '<div class="screen"><div class="cam"><div style="align-self:flex-start;width:100%"><button class="back" data-go="add" style="color:#fff" aria-label="Back">‹</button></div>' +
    '<div class="frame" id="frame"><div style="padding:20px;opacity:.8">📄<br>Place the receipt inside the frame<br>and make sure the text is clear.<br><small>You can crop the photo before scanning.</small></div></div>' +
    '<div class="hint" id="scanhint" aria-live="polite">Point the camera at your receipt</div><div class="err" id="scanerr" role="alert"></div>' +
    '<div class="progress" id="prog" style="width:100%;display:none"><i></i></div>' +
    '<div class="scanctl" id="scanctl">' +
      '<button class="shutter" data-act="pick-cam" aria-label="Take a photo of the receipt">📷</button>' +
      '<div class="btn-row" style="width:100%"><button class="btn yellow" data-act="pick-gal">Choose from gallery</button><button class="btn yellow" data-act="demo-receipt">Sample receipt</button></div>' +
      '<button class="btn" ' + ghostBtn + ' data-go="manual">Add manually instead</button>' +
    '</div>' +
    '<div class="scanctl" id="cropctl" hidden>' +
      '<div class="btn-row" style="width:100%"><button class="btn" ' + ghostBtn + ' data-act="crop-rotate">⟳ Rotate</button><button class="btn" ' + ghostBtn + ' data-act="crop-reset">Reset</button></div>' +
      '<button class="btn yellow" data-act="crop-save">✂️ Save &amp; scan</button>' +
      '<button class="btn" ' + ghostBtn + ' data-act="crop-cancel">Cancel</button>' +
    '</div>' +
    '<input type="file" id="fcam" accept="image/*" capture="environment" hidden><input type="file" id="fgal" accept="image/*" hidden></div></div>';

  V.review = () => {
    if (!draft.length && !rest.length) return screen(titleBar('Add to Fridge', 'add') + emptyBox('No items to review yet.'), 'add');
    return screen(titleBar('Review scan results', 'scan') + '<p style="font-size:12px;color:var(--muted);margin:-4px 0 12px">Edit anything that is wrong, then save. Shelf life is estimated automatically.</p>' +
      (draft.length ? '' : '<div class="card yellow" style="font-size:12px">No food items were recognized. Tap an item below to add it, or add items manually.</div>') +
      draft.map((d, i) => '<div class="rev"><div class="rev-head"><div class="thumb">' + d.emoji + '</div><input class="input" data-d="' + i + '" data-f="name" value="' + esc(d.name) + '" aria-label="Item name"><button class="del" data-act="del-draft" data-i="' + i + '" aria-label="Remove">✕</button></div>' +
        '<div class="grid3"><div><small>Qty</small><input class="input" type="number" min="1" data-d="' + i + '" data-f="qty" value="' + esc(d.qty) + '"></div>' +
        '<div><small>Category</small><input class="input" data-d="' + i + '" data-f="cat" value="' + esc(d.cat) + '"></div>' +
        '<div><small>Expires</small><input class="input" type="date" data-d="' + i + '" data-f="expiry" value="' + d.expiry + '"></div></div></div>').join('') +
      (rest.length ? '<div class="section-title"><span>Other items on the receipt (not recognized)</span></div><div class="rest">' + rest.map((r, i) => '<button class="chip" data-act="add-other" data-i="' + i + '">+ ' + esc(r.raw) + '</button>').join('') + '</div>' : '') +
      (draft.length ? '<button class="btn primary" data-act="save-draft">Save ' + draft.length + (draft.length === 1 ? ' item' : ' items') + ' to fridge</button>' : '') + '<button class="btn" data-go="manual">+ Add another item</button>', 'add');
  };

  V.manual = () => {
    const t = KK.toISODate(today());
    return screen(titleBar('Add to Fridge (Manual)', 'add') +
      '<label for="mname">Item name</label><input id="mname" class="input" list="foods" placeholder="e.g. Bok choy" autocomplete="off"><datalist id="foods">' + KK.FOODS.map(f => '<option value="' + esc(f.name) + '">').join('') + '</datalist>' +
      '<div class="grid2"><div><label for="mqty">Quantity</label><input id="mqty" class="input" type="number" min="1" value="1"></div><div><label for="mcat">Category</label><input id="mcat" class="input" placeholder="Vegetables"></div></div>' +
      '<div class="grid2"><div><label for="mbought">Bought on</label><input id="mbought" class="input" type="date" value="' + t + '"></div><div><label for="mexp">Expiry date</label><input id="mexp" class="input" type="date" value="' + KK.toISODate(KK.addDays(today(), 7)) + '"></div></div>' +
      '<p id="mhint" style="font-size:11px;color:var(--muted);margin-top:8px">The expiry date fills in automatically when the item is recognized. You can change it.</p>' +
      '<button class="btn primary" data-act="save-manual">Save to fridge</button>', 'add');
  };

  function tagsFor(r) { return r.used.map(n => '<span class="tag have">' + esc(n) + '</span>').join('') + r.missing.map(n => '<span class="tag miss">missing: ' + esc(n) + '</span>').join(''); }
  function recipeCard(r) {
    return '<button class="row light" data-go="recipe/' + r.id + '" style="display:block"><div style="display:flex;gap:10px;align-items:center"><div class="thumb" style="background:var(--yellow)">' + r.emoji + '</div><div class="info"><b>' + esc(r.name) + '</b><small>⏱ ' + r.time + ' min' + (r.urgency >= 3 ? ' · rescues items about to expire' : '') + '</small></div><span class="chev">›</span></div><div style="margin-top:6px">' + tagsFor(r) + '</div></button>';
  }
  function recipeMini(r) {
    return '<button class="rcard" data-go="recipe/' + r.id + '"><div class="rimg">' + r.emoji + '</div><b>' + esc(r.name) + '</b><small>⏱ ' + r.time + ' min</small><small>uses: ' + esc(r.used.join(', ') || '-') + '</small><span class="btn small primary" style="text-align:center">Cook now</span></button>';
  }

  V.recipes = () => {
    const list = KK.suggestRecipes(S.items), only = V._only, fs = fridgeState();
    const shown = only ? list.filter(r => r.used.includes(only)) : list;
    return screen(titleBar('Auto-Generated Recipes') +
      '<div class="card"><div class="mascot-row"><div style="width:78px;flex-shrink:0">' + (only ? pose('recipes') : head(fs.key)) + '</div><div class="bubble"><b>Hi ' + esc(name()) + "! Let's cook</b>" + (only ? 'Recipes with ' + esc(only) + '.' : 'Recipes are picked from your fridge, with the items closest to expiry first.') + '</div></div>' +
      (only ? '<button class="btn small" style="margin-top:10px" data-act="clear-only">Show all</button>' : '') + '</div>' +
      (shown.length ? shown.map(recipeCard).join('') : emptyBox('No matching recipes yet.<br>Add items to your fridge first.')), 'home');
  };

  V.recipe = id => {
    const r = KK.suggestRecipes(S.items).find(x => x.id === id) || (function () { const b = KK.RECIPES.find(x => x.id === id); return b && Object.assign({}, b, { used: [], missing: b.need }); })();
    if (!r) return screen(titleBar('Recipe', 'recipes') + emptyBox('Recipe not found.'), 'home');
    return screen(titleBar('Recipe', 'recipes') +
      '<div class="detail-img" style="height:120px;font-size:64px">' + r.emoji + '</div>' +
      '<div class="detail-banner" style="font-size:18px">' + esc(r.name) + '</div><div class="detail-body">' +
      '<div class="kv"><span>Time</span><b>⏱ ' + r.time + ' min</b></div>' +
      '<div style="margin:8px 0"><b style="font-size:13px">Main ingredients</b><br>' + r.need.map(n => '<span class="tag ' + (r.missing.includes(n) ? 'miss' : 'have') + '">' + esc(n) + '</span>').join('') + '</div>' +
      '<div style="margin:8px 0"><b style="font-size:13px">Optional</b><br>' + r.opt.map(n => '<span class="tag ' + (r.used.includes(n) ? 'have' : '') + '">' + esc(n) + '</span>').join('') + '</div>' +
      '<b style="font-size:13px">Steps</b><ol class="steps">' + r.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol></div>' +
      '<button class="btn primary" data-act="cook" data-id="' + r.id + '">🍳 Cook this (mark items as used)</button>' +
      '<div class="btn-row"><button class="btn" data-act="plan-pick" data-id="' + r.id + '">+ Meal plan</button>' + (r.missing.length ? '<button class="btn" data-act="miss-shop" data-id="' + r.id + '">+ Shopping list</button>' : '') + '</div>', 'home');
  };

  V.mealplan = () => {
    const days = []; for (let i = 0; i < 7; i++) days.push(KK.addDays(today(), i));
    const d = new Date(selDay + 'T00:00:00'); const plan = S.plan[selDay] || {};
    return screen(titleBar('Meal Plan') +
      '<div style="font-size:12px;font-weight:600;margin:0 2px 8px">' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + '</div>' +
      '<div class="week">' + days.map(x => { const iso = KK.toISODate(x); return '<button class="day ' + (iso === selDay ? 'on' : '') + '" data-act="selday" data-v="' + iso + '">' + DAYS[x.getDay()].slice(0, 3) + '<b>' + x.getDate() + '</b></button>'; }).join('') + '</div>' +
      MEALS.map(m => { const r = plan[m] && KK.RECIPES.find(x => x.id === plan[m]);
        return '<button class="meal" data-act="meal" data-v="' + m + '"><div class="info"><b>' + m + '</b>' + (r ? 'Dish : ' + esc(r.name) + '<br>Ingredients : ' + esc(r.need.concat(r.opt).join(', ')) : 'Not planned yet · tap to choose') + '</div><span class="chev">' + (r ? '›' : '+') + '</span></button>'; }).join('') +
      '<button class="btn yellow" data-act="autoplan">✨ Auto-fill from my fridge</button>' + (Object.keys(plan).length ? '<button class="btn danger" data-act="clearplan">Clear this day</button>' : ''), 'mealplan');
  };

  V.shopping = () => {
    const done = S.shopping.filter(x => x.done).length;
    return screen(titleBar('Shopping List') +
      '<div style="display:flex;gap:8px"><input id="shopin" class="input" placeholder="Add an item..." aria-label="Add an item"><button class="btn small primary" data-act="shop-add" style="padding:0 18px" aria-label="Add">+</button></div><div style="height:12px"></div>' +
      (S.shopping.length ? S.shopping.map(x => '<label class="shop ' + (x.done ? 'done' : '') + '" style="margin:0 0 8px"><input type="checkbox" data-act="shop-toggle" data-id="' + x.id + '" ' + (x.done ? 'checked' : '') + '><span>' + esc(x.name) + '</span><button data-act="shop-del" data-id="' + x.id + '" aria-label="Remove" style="color:var(--red)">✕</button></label>').join('')
        : emptyBox('Your shopping list is empty.<br>Items you run out of are added here automatically.')) +
      (done ? '<button class="btn" data-act="shop-clear">Remove ' + done + ' bought ' + (done === 1 ? 'item' : 'items') + '</button>' : ''), 'shopping');
  };

  V.notifications = () => {
    const list = S.items.filter(i => dl(i) <= 3).sort((a, b) => dl(a) - dl(b));
    return screen(titleBar('Notifications', 'home') + (list.length ? list.map(i => { const l = lv(i), m = KK.itemMsg(i);
      return '<button class="row light" data-go="item/' + i.id + '"><div class="thumb hd" style="background:' + l.color + '22">' + head(l.key) + '</div><div class="info"><b>' + esc(m.title) + '</b><small>' + esc(m.sub) + '</small></div><span class="chev">›</span></button>'; }).join('')
      : emptyBox('No reminders.<br>Everything is still fresh!')), 'home');
  };

  V.profile = () => screen(titleBar('Profile', 'home') +
    '<div class="profile-head"><div class="avatar big">' + head(fridgeState().key) + '</div><b style="font-size:18px">' + esc(name()) + '</b><br><small style="color:var(--muted)">KulkasKita user</small></div>' +
    '<div class="card yellow"><b>Account</b><div class="setting"><span>Change nickname</span><button class="btn small" data-act="rename">Change</button></div></div>' +
    '<div class="card yellow"><div class="setting"><span>Expiry notifications</span><button class="switch ' + (S.notif ? 'on' : '') + '" data-act="notif" aria-label="Notifications" role="switch" aria-checked="' + !!S.notif + '"></button></div><small style="color:var(--muted)">Reminders appear in the app 1-3 days before expiry. Turn on to also get browser notifications while the app is open.</small></div>' +
    '<div class="card yellow"><b>Demo mode</b><div class="setting"><span>Bear moods</span><button class="btn small" data-act="legend">View</button></div><small style="color:var(--muted)">Fast-forward the clock by 1 day to watch the bear change expression.</small><button class="btn yellow" data-act="ff">⏩ Fast-forward 1 day</button></div>' +
    '<div class="card yellow"><div class="setting"><span>App tutorial</span><button class="btn small" data-act="tutorial">Replay</button></div><small style="color:var(--muted)">A quick tour of every feature, shown with an empty fridge. Your own data is not touched.</small></div>' +
    '<button class="btn" data-act="reset">Reset sample data</button><button class="btn danger" data-act="logout">Sign out</button>', null);

  /* ---- TUTORIAL (hands-on practice) ----
   * Opened right after the first login (#/tutorial/0) or from Profile > Replay. It runs on the REAL screens with a practice fridge:
   * your real data is parked in tutBackup, save() is paused, and everything is restored when the tutorial ends or is skipped.
   * Each step in TUT:  r = screen to be on, t = CSS selector(s) to spotlight (omit = centered card),
   *   goal = function returning true once the user did the task (omit = info step with a Next button).
   * Only the spotlighted area is clickable. "Skip step" and "Skip tutorial" are always available. Edit TUT to change the tour.
   */
  const route = () => location.hash.replace(/^#\/?/, '').split('/')[0] || 'splash';
  const NAVB = k => '.nav button[data-go="' + k + '"]';
  const TUT = [
    { r: 'home', mood: 'aman', btn: "Let's try", title: "Let's try KulkasKita!", text: 'Practice every feature with a pretend fridge. Nothing you do here is saved. You can skip any step, or the whole tutorial, at any time.' },
    { r: 'home', t: '.hero', mood: 'baik', title: 'Your fridge bear', text: "The bear's mood shows how fresh your fridge is, based on the item closest to expiry. Tap the bear or the i button any time for the freshness guide." },
    { r: 'home', t: '.gauge-card', mood: 'aman', title: 'Food rescue', text: 'Counts the food you used before it expired and the food that was wasted. It fills up as you use your items.' },
    { r: 'home', t: NAVB('add'), goal: () => route() === 'add', mood: 'aman', title: 'Add your first item', text: 'Tap the + button in the menu.' },
    { r: 'add', t: '.choice[data-go="manual"]', goal: () => route() === 'manual', mood: 'aman', title: 'Add manually', text: 'Choose Add Manually. Scanning a receipt comes a bit later.' },
    { r: 'manual', t: '#mname, .grid2, [data-act="save-manual"]', goal: () => S.items.length > 0, mood: 'baik', title: 'Fill in an item', text: 'Type Eggs in the name and tap outside the box. The expiry date fills in by itself. Then tap Save to fridge.' },
    { r: 'home', t: '.hero', mood: 'baik', title: 'The bear reacts', text: 'Now there is food in your fridge, so the bear tells you how it is doing.' },
    { r: 'home', t: NAVB('fridge'), goal: () => route() === 'fridge', mood: 'baik', title: 'Open your fridge', text: 'Tap the fridge tab.' },
    { r: 'fridge', t: '#search, .chips', mood: 'baik', title: 'Search and filters', text: 'Search, or filter by freshness level and category. Handy once the fridge gets full.' },
    { r: 'fridge', t: '.row', goal: () => route() === 'item', mood: 'baik', title: 'Open an item', text: 'Tap your item to see its details.' },
    { r: 'item', t: '[data-field="expiry"], [data-field="qty"]', mood: 'aman', title: 'Item details', text: 'Fix the expiry date or quantity here if the estimate is off. When you finish an item, mark it Used up or Wasted below.' },
    { r: 'item', t: '[data-act="recipe-for"]', goal: () => route() === 'recipes', mood: 'aman', title: 'Find recipes', text: 'Tap Find recipes with this item.' },
    { r: 'recipes', t: '.row.light', goal: () => route() === 'recipe', mood: 'aman', title: 'Pick a recipe', text: 'Recipes are matched to your fridge. Tap one to open it. (No recipe showing? Use Skip step.)' },
    { r: 'recipe', t: '[data-act="plan-pick"]', goal: () => Object.keys(S.plan).length > 0, mood: 'baik', title: 'Plan the meal', text: 'Tap + Meal plan, choose a day and a meal, then tap Save. Cook this marks the ingredients as used, and + Shopping list adds missing ones.' },
    { r: 'mealplan', t: '.week, .meal', mood: 'baik', title: 'Your meal plan', text: 'Your dish now sits in its slot. Tap a day to switch days, or a slot to change the dish.' },
    { r: 'mealplan', t: '[data-act="autoplan"]', goal: () => !!tutDid.autoplan, mood: 'aman', title: 'Auto-fill', text: 'Tap Auto-fill from my fridge and let the app plan the rest of the day.' },
    { r: 'mealplan', t: NAVB('shopping'), goal: () => route() === 'shopping', mood: 'aman', title: 'Shopping list', text: 'Tap the cart tab.' },
    { r: 'shopping', t: '#shopin, [data-act="shop-add"]', goal: () => S.shopping.length > 0, mood: 'baik', title: 'Add to the list', text: 'Type something you need, like Milk, and tap +. Items you use up are added here automatically.' },
    { r: 'shopping', t: NAVB('add'), goal: () => route() === 'add', mood: 'aman', title: 'Scan a receipt', text: 'Now the fast way to fill a fridge. Tap + again.' },
    { r: 'add', t: '.choice[data-go="scan"]', goal: () => route() === 'scan', mood: 'aman', title: 'Scan Receipt', text: 'Tap Scan Receipt.' },
    { r: 'scan', t: '#scanctl', mood: 'hampir', title: 'Camera, gallery, sample', text: 'The shutter takes a photo and the gallery picks one. After either, you crop the photo to just the receipt, then tap Save & scan.' },
    { r: 'scan', t: '[data-act="demo-receipt"]', goal: () => route() === 'review', mood: 'hampir', title: 'Try the sample receipt', text: 'Tap Sample receipt. The app reads it like a real photo.' },
    { r: 'review', t: '[data-act="save-draft"]', goal: () => route() === 'home', mood: 'baik', title: 'Review and save', text: 'Every item is listed with its name, quantity, category and expiry date. You can edit them. Tap Save to add them to the fridge.' },
    { r: 'home', t: '.topbar [data-go="notifications"]', goal: () => route() === 'notifications', mood: 'cukup', title: 'Expiry alerts', text: 'Tap the bell to see items that expire within 3 days.' },
    { r: 'notifications', t: '.topbar .avatar', goal: () => route() === 'profile', mood: 'aman', title: 'Profile', text: 'Tap your avatar to open your profile and settings.' },
    { r: 'profile', t: '[data-act="ff"]', goal: () => !!tutDid.ff, mood: 'hampir', title: 'Demo mode', text: 'Tap Fast-forward 1 day to watch expiry dates move and the bear change mood.' },
    { r: 'profile', t: '[data-act="tutorial"]', mood: 'aman', title: 'Replay any time', text: 'You can run this tutorial again from here whenever you like.' },
    { r: 'home', mood: 'aman', title: "You're all set!", text: '' },
  ];
  V.tutorial = () => ''; // #/tutorial/0 is only an entry point: render() starts the practice fridge and shows TUT[0]
  function tutStart() {
    if (tutBackup) return;
    tutBackup = S; tutDid = {}; tutI = 0;
    S = { user: S.user || { name: 'Kay', email: '' }, items: [], history: [], shopping: [], plan: {}, notif: false, lastNotif: '' };
    draft = []; rest = []; selDay = KK.toISODate(today()); V._cat = 'All'; V._q = ''; V._lvl = ''; V._only = null;
  }
  function tutEnd() { // restore your real data and clear all practice leftovers
    if (!tutBackup) return;
    S = tutBackup; tutBackup = null; tutDid = {};
    draft = []; rest = []; selDay = KK.toISODate(today()); V._cat = 'All'; V._q = ''; V._lvl = ''; V._only = null;
  }
  function tutFinish() {
    const hadUser = tutBackup && tutBackup.user;
    tutEnd();
    if (hadUser && S.accounts && S.accounts[hadUser.email]) { S.accounts[hadUser.email].tutDone = true; save(); } // finished or skipped: not shown again for this account
    const dest = hadUser ? (tutFrom || 'home') : 'login'; tutFrom = '';
    if (location.hash === '#/' + dest) render(); else go(dest);
  }
  function tutOverlay() {
    const s = TUT[tutI], last = tutI === TUT.length - 1, goal = !!s.goal;
    const hadUser = tutBackup && tutBackup.user;
    const text = last ? (hadUser ? "That's the whole tour. Your own fridge data was not touched." : "That's the whole tour! Next, sign in with a nickname. We'll fill your fridge with a few sample items so you can try everything.") : s.text;
    return '<div class="tut" id="tut">' + [0, 1, 2, 3].map(i => '<div class="tut-blk" id="tutb' + i + '"></div>').join('') + '<div class="tut-spot" id="tutspot"></div>' +
      '<div class="tut-card" id="tutcard" role="dialog" aria-label="App tutorial">' +
      '<div class="tut-head">' + head(s.mood || 'aman', 'width:52px;flex-shrink:0') + '<div><small>Step ' + (tutI + 1) + ' of ' + TUT.length + (goal ? ' · <span class="tut-try">Your turn</span>' : '') + '</small><b>' + esc(s.title) + '</b></div></div>' +
      '<p>' + esc(text) + '</p>' +
      '<div class="tut-prog"><i style="width:' + Math.round((tutI + 1) / TUT.length * 100) + '%"></i></div>' +
      '<div class="tut-btns">' + (last ? '' : '<button class="tut-skip" data-tut="end">Skip tutorial</button>') + '<span style="flex:1"></span>' +
      (last ? '<button class="tut-btn primary" data-tut="end">' + (hadUser ? 'Done' : 'Sign in') + '</button>'
        : goal ? '<button class="tut-btn soft" data-tut="next">Skip step</button>'
        : '<button class="tut-btn primary" data-tut="next">' + esc(s.btn || 'Next') + '</button>') + '</div></div></div>';
  }
  // Spotlight the target(s); four invisible blockers cover everything else so only the highlighted area is usable.
  function tutLayout() {
    const tut = $id('tut'), spot = $id('tutspot'), card = $id('tutcard'), base = $app.querySelector('.screen'), s = TUT[tutI];
    if (!tut || !spot || !card || !base || !s) return;
    const blk = [0, 1, 2, 3].map(i => $id('tutb' + i)), app = $app.getBoundingClientRect();
    card.style.transform = '';
    if ($id('modal')) { tut.classList.add('hasmodal'); tut.classList.remove('nospot'); card.style.top = '10px'; return; } // a popup is open: let the user use it
    tut.classList.remove('hasmodal');
    const els = (s.t ? Array.from(base.querySelectorAll(s.t)) : []).filter(e => e.getClientRects().length);
    const c = base.querySelector('.content');
    if (els.length && c && c.contains(els[0])) c.scrollTop += els[0].getBoundingClientRect().top - c.getBoundingClientRect().top - 8;
    const rs = els.map(e => e.getBoundingClientRect());
    tut.classList.toggle('nospot', !rs.length);
    if (!rs.length) { spot.style.display = 'none'; blk.forEach(b => { b.style.display = 'none'; }); card.style.top = '50%'; card.style.transform = 'translateY(-50%)'; return; }
    const pad = 6, L = Math.min.apply(null, rs.map(r => r.left)) - pad - app.left, T = Math.min.apply(null, rs.map(r => r.top)) - pad - app.top,
      R = Math.max.apply(null, rs.map(r => r.right)) + pad - app.left, B = Math.max.apply(null, rs.map(r => r.bottom)) + pad - app.top;
    spot.style.display = 'block'; spot.classList.toggle('solid', !s.goal);
    spot.style.left = L + 'px'; spot.style.top = T + 'px'; spot.style.width = (R - L) + 'px'; spot.style.height = (B - T) + 'px';
    const box = (b, l, t, w, h) => { b.style.display = 'block'; b.style.left = l + 'px'; b.style.top = t + 'px'; b.style.width = Math.max(0, w) + 'px'; b.style.height = Math.max(0, h) + 'px'; };
    box(blk[0], 0, 0, app.width, T); box(blk[1], 0, B, app.width, app.height - B);
    box(blk[2], 0, T, L, B - T); box(blk[3], R, T, app.width - R, B - T);
    const ch = card.offsetHeight; let top;
    if (app.height - B >= ch + 20) top = B + 12; else if (T >= ch + 20) top = T - ch - 12; else top = app.height - ch - 14;
    card.style.top = top + 'px';
  }
  function tutPaint() { const old = $id('tut'); if (old) old.remove(); $app.insertAdjacentHTML('beforeend', tutOverlay()); tutLayout(); setTimeout(tutLayout, 320); }
  function tutAdvance() { // next step; open its screen first if you are somewhere else
    if (tutI >= TUT.length - 1) return;
    tutI++; const s = TUT[tutI];
    if (s.r && route() !== s.r) go(s.r); else tutPaint();
  }
  function tutCheck() { // did the user finish this step's task? then move on
    const s = TUT[tutI]; if (!tutBackup || !s || !s.goal) return false;
    let ok = false; try { ok = !!s.goal(); } catch (e) { /* ignore */ }
    if (ok) tutAdvance();
    return ok;
  }
  function tutRefresh() { if (!tutBackup) return; if (!tutCheck()) tutLayout(); }

  /* ================= 5. OCR PIPELINE =================
   * Flow: photo -> cropOpen() / cropSave() -> preprocess() -> getWorker().recognize() -> ocrLines() -> KK.parseLine() -> highlight -> review
   */
  const TESS_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const ocr = { workerP: null, onProgress: null };
  const $id = id => document.getElementById(id);
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });

  // One reusable Tesseract "worker" (created once). It is warmed up when the scan screen opens.
  function getWorker() {
    if (!ocr.workerP) {
      ocr.workerP = (async () => {
        if (!window.Tesseract) await loadScript(TESS_SRC);
        const w = await Tesseract.createWorker('eng', 1, { logger: m => { if (ocr.onProgress) ocr.onProgress(m); } });
        // PSM 6 = treat the page as one uniform block of text: a good fit for receipts (line by line)
        await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
        return w;
      })();
      ocr.workerP.catch(() => { ocr.workerP = null; });
    }
    return ocr.workerP;
  }

  // Image preprocessing: scale to ~2200px, grayscale, boost contrast. Cleaner images are easier for OCR to read.
  function preprocess(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const sc = Math.min(2.5, 2200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
        for (let i = 0; i < p.length; i += 4) { let v = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; v = (v - 128) * 1.4 + 138; v = v < 0 ? 0 : v > 255 ? 255 : v; p[i] = p[i + 1] = p[i + 2] = v; }
        g.putImageData(d, 0, 0); URL.revokeObjectURL(url);
        c.toBlob(b => res({ blob: b, preview: c.toDataURL('image/jpeg', .7), w: c.width, h: c.height }), 'image/png');
      };
      img.onerror = rej; img.src = url;
    });
  }

  // Get the list of lines (text + bounding box) from the Tesseract result, whatever the version's format
  function ocrLines(data) {
    let ls = data.lines;
    if (!ls || !ls.length) { ls = []; (data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => ls.push(l)))); }
    if (!ls.length) ls = String(data.text || '').split('\n').map(t => ({ text: t, bbox: null }));
    return ls.map(l => ({ text: (l.text || '').trim(), bbox: l.bbox || null })).filter(l => l.text);
  }

  const scanUI = {
    hint(t) { const e = $id('scanhint'); if (e) e.textContent = t; },
    err(t) { const e = $id('scanerr'); if (e) e.textContent = t || ''; },
    prog(p) { const w = $id('prog'); if (!w) return; w.style.display = p == null ? 'none' : 'block'; if (p != null) w.firstElementChild.style.width = Math.round(p) + '%'; },
    // Show the receipt photo; marks = highlight boxes (green = recognized food, yellow = other item)
    shot(pre, marks, scanning) {
      const f = $id('frame'); if (!f) return;
      f.classList.add('has-shot'); f.classList.toggle('scanning', !!scanning);
      f.innerHTML = '<div class="shot"><img alt="Receipt photo" src="' + pre.preview + '">' + (marks || []).map(m =>
        '<div class="hl ' + m.cls + '" style="left:' + (m.x0 / pre.w * 100) + '%;top:' + (m.y0 / pre.h * 100) + '%;width:' + ((m.x1 - m.x0) / pre.w * 100) + '%;height:' + ((m.y1 - m.y0) / pre.h * 100) + '%"></div>').join('') + '</div>';
    },
  };
  const STAGE = { 'loading tesseract core': 'Preparing OCR engine...', 'initializing tesseract': 'Preparing OCR engine...', 'loading language traineddata': 'Downloading language data (one-time)...', 'initializing api': 'Almost ready...', 'recognizing text': 'Reading receipt...' };

  /* ---- Photo crop editor: shown after you take/choose a photo, BEFORE scanning ----
   * crop.cv = working canvas (max 2600px, can be rotated); crop.box = crop rectangle as 0..1 fractions of the image.
   * Drag the 8 handles to resize, drag inside the box to move it. "Save & scan" cuts the photo and sends it to the OCR.
   */
  function loadImg(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
      img.src = url;
    });
  }
  async function cropOpen(file) {
    if (!file || !$id('frame')) return;
    scanUI.err(''); scanUI.hint('Loading photo...');
    try {
      const img = await loadImg(file);
      const sc = Math.min(1, 2600 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      if (crop && crop.url) URL.revokeObjectURL(crop.url);
      crop = { cv: cv, box: { x: .06, y: .06, w: .88, h: .88 }, url: null };
      await cropShow();
    } catch (e) { crop = null; scanUI.hint('Point the camera at your receipt'); scanUI.err('Could not open that photo. Try another one.'); }
  }
  function cropShow() {
    return new Promise(res => {
      if (!crop) return res();
      crop.cv.toBlob(b => {
        if (!crop) return res();
        if (crop.url) URL.revokeObjectURL(crop.url);
        crop.url = URL.createObjectURL(b);
        cropRender(); res();
      }, 'image/jpeg', .92);
    });
  }
  function cropRender() {
    const f = $id('frame'); if (!f || !crop) return;
    f.classList.remove('has-shot', 'scanning'); f.classList.add('cropping');
    f.innerHTML = '<div class="crop-stage"><div class="crop-wrap" id="cropwrap"><img id="cropimg" alt="Receipt photo to crop" draggable="false" src="' + crop.url + '">' +
      '<div class="crop-box" id="cropbox">' + ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'].map(h => '<i class="h-' + h + '" data-h="' + h + '"></i>').join('') + '</div></div></div>';
    const cc = $id('cropctl'), sc = $id('scanctl'); if (cc) cc.hidden = false; if (sc) sc.hidden = true;
    scanUI.err(''); scanUI.prog(null); scanUI.hint('Drag the corners or edges to adjust the crop box, or drag inside it to move it.');
    cropPaint(); cropBind();
  }
  function cropPaint() {
    const b = $id('cropbox'); if (!b || !crop) return; const c = crop.box;
    b.style.left = (c.x * 100) + '%'; b.style.top = (c.y * 100) + '%'; b.style.width = (c.w * 100) + '%'; b.style.height = (c.h * 100) + '%';
  }
  function cropBind() {
    const wrap = $id('cropwrap'), box = $id('cropbox'); if (!wrap || !box) return;
    const cl = (v, a, b) => Math.min(b, Math.max(a, v)); let drag = null;
    wrap.addEventListener('pointerdown', e => {
      const h = e.target.dataset && e.target.dataset.h;
      if (!h && e.target !== box) return;
      e.preventDefault(); const r = wrap.getBoundingClientRect();
      drag = { h: h || 'move', x: e.clientX, y: e.clientY, b: Object.assign({}, crop.box), w: r.width, hh: r.height };
      try { wrap.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    });
    wrap.addEventListener('pointermove', e => {
      if (!drag || !crop) return;
      const dx = (e.clientX - drag.x) / drag.w, dy = (e.clientY - drag.y) / drag.hh, MIN = 0.08;
      let x0 = drag.b.x, y0 = drag.b.y, x1 = x0 + drag.b.w, y1 = y0 + drag.b.h;
      if (drag.h === 'move') { const w = drag.b.w, hh = drag.b.h; x0 = cl(x0 + dx, 0, 1 - w); y0 = cl(y0 + dy, 0, 1 - hh); x1 = x0 + w; y1 = y0 + hh; }
      else {
        if (drag.h.includes('l')) x0 = cl(x0 + dx, 0, x1 - MIN);
        if (drag.h.includes('r')) x1 = cl(x1 + dx, x0 + MIN, 1);
        if (drag.h.includes('t')) y0 = cl(y0 + dy, 0, y1 - MIN);
        if (drag.h.includes('b')) y1 = cl(y1 + dy, y0 + MIN, 1);
      }
      crop.box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; cropPaint();
    });
    const end = () => { drag = null; };
    wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
  }
  function cropRotate() { // rotate the working photo 90 degrees clockwise
    if (!crop) return;
    const s = crop.cv, c = document.createElement('canvas'); c.width = s.height; c.height = s.width;
    const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(Math.PI / 2); g.drawImage(s, -s.width / 2, -s.height / 2);
    crop.cv = c; crop.box = { x: .06, y: .06, w: .88, h: .88 }; cropShow();
  }
  function cropEnd() { // leave the editor and restore the normal scan buttons
    if (crop && crop.url) URL.revokeObjectURL(crop.url);
    crop = null;
    const f = $id('frame'); if (f) f.classList.remove('cropping');
    const cc = $id('cropctl'), sc = $id('scanctl'); if (cc) cc.hidden = true; if (sc) sc.hidden = false;
  }
  async function cropSave() { // cut the photo to the box, then scan it
    if (!crop) return;
    const cv = crop.cv, b = crop.box, sx = Math.round(b.x * cv.width), sy = Math.round(b.y * cv.height);
    const sw = Math.max(16, Math.min(cv.width - sx, Math.round(b.w * cv.width))), sh = Math.max(16, Math.min(cv.height - sy, Math.round(b.h * cv.height)));
    const out = document.createElement('canvas'); out.width = sw; out.height = sh;
    out.getContext('2d').drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', .95));
    cropEnd();
    handleFile(blob);
  }

  function startReview(res) {
    draft = res.items.map(it => Object.assign({}, it, { expiry: KK.toISODate(KK.addDays(today(), it.days)) }));
    rest = res.others; go('review');
  }
  async function handleFile(file, opts) {
    if (!file) return;
    opts = opts || {};
    scanUI.err(''); scanUI.hint('Preparing photo...'); scanUI.prog(2);
    let pre;
    try {
      pre = await preprocess(file);
      scanUI.shot(pre, [], true);
      let cur = 2;
      ocr.onProgress = m => {
        scanUI.hint(STAGE[m.status] || 'Processing...');
        const p = m.status === 'recognizing text' ? 35 + m.progress * 65 : m.status === 'loading language traineddata' ? 8 + m.progress * 27 : 8;
        cur = Math.max(cur, p); scanUI.prog(cur);
      };
      const worker = await getWorker();
      const { data } = await worker.recognize(pre.blob);
      ocr.onProgress = null;
      const parsed = ocrLines(data).map(l => ({ l, item: KK.parseLine(l.text) }));
      const res = KK.splitItems(parsed.map(p => p.item));
      const marks = parsed.filter(p => p.item && p.l.bbox).map(p => ({ x0: p.l.bbox.x0, y0: p.l.bbox.y0, x1: p.l.bbox.x1, y1: p.l.bbox.y1, cls: p.item.known ? 'ok' : 'maybe' }));
      scanUI.shot(pre, marks, false); scanUI.prog(null);
      if (!res.items.length && !res.others.length) { scanUI.hint('Point the camera at your receipt'); scanUI.err('Receipt not detected. Try a closer, brighter photo, or add items manually.'); return; }
      scanUI.hint('Found ' + res.items.length + ' food ' + (res.items.length === 1 ? 'item' : 'items') + ' 🎉');
      setTimeout(() => { if (location.hash === '#/scan') startReview(res); }, 1600);
    } catch (e) {
      ocr.onProgress = null; scanUI.prog(null);
      if (opts.fallback) { scanUI.hint('Offline mode: using sample results'); setTimeout(() => startReview(KK.splitItems(DEMO_LINES.map(KK.parseLine))), 900); return; }
      scanUI.hint('Point the camera at your receipt');
      scanUI.err('Could not read the receipt (check your internet connection to download the OCR engine). Try again or add items manually.');
    }
  }

  // Sample receipt: drawn on a canvas, then READ by the real OCR (not pre-made text)
  const DEMO_LINES = ['INDOMART SUPERMARKET', 'Jl. Kebon Jeruk No. 45', 'Tgl: 18 Mei 2026  Jam: 10:15', '--------------------------------', 'QTY NAMA BARANG        HARGA   TOTAL',
    '1 AYAM BAGIAN 500G     45.000  45.000', '2 WORTEL LOKAL (PACK)  12.000  24.000', '1 BAWANG PUTIH          3.500   3.500', '1 PAKCOI 500G           6.000   6.000', '1 TOMAT                 5.000   5.000',
    '1 TELUR AYAM 10 BIJI   28.000  28.000', '1 SUSU UHT 1L          18.000  18.000', '1 NORI RUMPUT LAUT      7.000   7.000', '--------------------------------', 'SUBTOTAL               136.500', 'TUNAI                  150.000'];
  function demoReceiptBlob() {
    const c = document.createElement('canvas'), fs = 24, lh = 34; c.width = 640; c.height = DEMO_LINES.length * lh + 60;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#1a1a1a'; g.font = fs + 'px "Courier New", Courier, monospace';
    DEMO_LINES.forEach((t, i) => g.fillText(t, 24, 44 + i * lh));
    return new Promise(res => c.toBlob(res, 'image/png'));
  }

  async function notifyDue() {
    if (!S.notif || !('Notification' in window) || Notification.permission !== 'granted') return;
    const key = KK.toISODate(today()); if (S.lastNotif === key) return;
    const a = alerts(); if (!a.length) return;
    S.lastNotif = key; save();
    try { new Notification('KulkasKita 🐻‍❄️', { body: a.slice(0, 3).map(i => i.name + ' (' + KK.dayText(dl(i)) + ')').join(', ') + ' should be used soon!' }); } catch (e) { /* ignore */ }
  }

  /* ================= 6. ROUTER & EVENTS ================= */
  const PUBLIC = ['splash', 'onb', 'login', 'tutorial'];
  function render() {
    clearTimeout(timer); closeModal();
    const parts = location.hash.replace(/^#\/?/, '').split('/'); let r = parts[0] || 'splash'; const arg = parts[1];
    if (!V[r]) r = 'splash';
    if (r === 'tutorial') { tutStart(); tutI = 0; r = TUT[0].r; history.replaceState(null, '', '#/' + r); } // practice fridge starts here
    else if (tutBackup && ['splash', 'onb', 'login'].includes(r)) tutEnd();                              // left the tutorial: restore real data
    if (crop && r !== 'scan') cropEnd();
    if (!S.user && !PUBLIC.includes(r)) r = 'onb';
    $app.dataset.screen = r;
    if (tutBackup) $app.dataset.tutmode = '1'; else delete $app.dataset.tutmode;
    $app.innerHTML = V[r](r === 'onb' && !arg ? 1 : arg);
    const c = $app.querySelector('.content'); if (c) c.scrollTop = 0;
    if (r !== 'recipes') V._only = null;
    if (r === 'scan') setTimeout(() => { getWorker().catch(() => { /* offline: handled when scanning */ }); }, 400); // warm up the OCR engine
    if (tutBackup) { $app.insertAdjacentHTML('beforeend', tutOverlay()); tutLayout(); setTimeout(tutLayout, 320); tutCheck(); }
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('resize', () => { if (tutBackup) tutLayout(); });

  function removeItem(it, type) {
    S.history.push({ type: type, name: it.name });
    S.items = S.items.filter(i => i.id !== it.id);
    if (type === 'used' && !S.shopping.some(x => x.name === it.name && !x.done)) S.shopping.push({ id: uid(), name: it.name, done: false });
    save();
  }
  function useRecipe(r) {
    r.used.forEach(n => {
      const it = S.items.find(i => i.name === n); if (!it) return;
      if (it.qty > 1) { it.qty -= 1; S.history.push({ type: 'used', name: n }); } else removeItem(it, 'used');
    });
    save();
  }

  $app.addEventListener('click', async e => {
    const tb = e.target.closest('.tut [data-tut]'); // tutorial buttons
    if (tb) {
      const k = tb.dataset.tut;
      if (k === 'next') tutAdvance(); else tutFinish();
      return;
    }
    const el = e.target.closest('[data-go],[data-act]'); if (!el) return;
    if (el.dataset.go) { go(el.dataset.go); return; }
    const a = el.dataset.act, id = el.dataset.id;
    if (tutBackup && a) tutDid[a] = true; // remembers which buttons were tapped (used by tutorial goals)
    switch (a) {
      case 'close': closeModal(); break;
      case 'legend': legendModal(); break;
      case 'tutorial': tutFrom = 'profile'; go('tutorial/0'); break;
      case 'ff': { // demo: fast-forward 1 day (all dates move back by 1 day)
        const sh = iso => KK.toISODate(KK.addDays(new Date(iso + 'T00:00:00'), -1));
        S.items.forEach(i => { i.expiry = sh(i.expiry); if (i.bought) i.bought = sh(i.bought); });
        save(); toast('Clock moved forward 1 day. Watch the bear!'); closeModal(); render(); break;
      }
      case 'login': { // all fields required; same email + wrong password is rejected
        const n = $id('lname').value.trim(), em = $id('lmail').value.trim().toLowerCase(), pw = $id('lpass').value;
        const fail = (msg, field) => { $id('lerr').textContent = msg; ['lname', 'lmail', 'lpass'].forEach(i => $id(i).classList.toggle('bad', i === field)); $id(field).focus(); };
        if (n.length < 2) { fail('Enter a nickname (at least 2 characters).', 'lname'); break; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { fail('Enter a valid email address, like name@email.com.', 'lmail'); break; }
        if (pw.length < 6) { fail('Password must be at least 6 characters.', 'lpass'); break; }
        const h = await hashPw(em + ':' + pw);
        S.accounts = S.accounts || {};
        if (S.accounts[em] && S.accounts[em].hash !== h) { fail('Wrong password for this email.', 'lpass'); break; }
        const seen = !!(S.accounts[em] && S.accounts[em].tutDone);      // has THIS account already finished the tutorial?
        S.accounts[em] = { name: n.slice(0, 20), hash: h, tutDone: seen }; // new email = register, known email = log in
        S.user = { name: n.slice(0, 20), email: em };
        if (!S.items.length && !S.history.length) seed();
        tutFrom = ''; save(); go(seen ? 'home' : 'tutorial/0'); break;   // new account (or tutorial never finished) -> hands-on tutorial, skippable
      }
      case 'cat': V._cat = el.dataset.v; render(); break;
      case 'lvl': { // filter the fridge by freshness level
        const v = el.dataset.v, onFridge = location.hash.startsWith('#/fridge'); closeModal();
        V._lvl = (onFridge && V._lvl === v) ? '' : v;
        if (onFridge) render(); else go('fridge'); break;
      }
      case 'used': { const it = S.items.find(i => i.id === id); if (it) { removeItem(it, 'used'); toast(it.name + ' marked as used. Added to your shopping list.', true); go('fridge'); } break; }
      case 'wasted': { const it = S.items.find(i => i.id === id); if (it) { removeItem(it, 'wasted'); toast(it.name + ' logged as wasted.'); go('fridge'); } break; }
      case 'recipe-for': { const it = S.items.find(i => i.id === id); V._only = it ? it.name : null; go('recipes'); break; }
      case 'clear-only': V._only = null; render(); break;
      case 'pick-cam': $id('fcam').click(); break;
      case 'pick-gal': $id('fgal').click(); break;
      case 'demo-receipt': handleFile(await demoReceiptBlob(), { fallback: true }); break;
      case 'crop-rotate': cropRotate(); break;
      case 'crop-reset': if (crop) { crop.box = { x: .06, y: .06, w: .88, h: .88 }; cropPaint(); } break;
      case 'crop-cancel': cropEnd(); render(); break;
      case 'crop-save': cropSave(); break;
      case 'del-draft': draft.splice(+el.dataset.i, 1); render(); break;
      case 'add-other': { const r = rest.splice(+el.dataset.i, 1)[0]; if (r) draft.push(Object.assign({}, r, { expiry: KK.toISODate(KK.addDays(today(), r.days)) })); render(); break; }
      case 'save-draft': {
        const t = KK.toISODate(today());
        draft.forEach(d => { if (!d.name.trim()) return; S.items.push({ id: uid(), name: d.name.trim(), qty: Math.max(1, +d.qty || 1), cat: d.cat || 'Other', emoji: d.emoji, bought: t, expiry: d.expiry }); });
        const n = draft.length; draft = []; rest = []; save(); toast(n + (n === 1 ? ' item' : ' items') + ' saved to your fridge!', true); go('home'); break;
      }
      case 'save-manual': {
        const nm = document.getElementById('mname').value.trim(); if (!nm) { toast('Enter an item name first.'); break; }
        const g = KK.guessItem(nm, 1), exp = document.getElementById('mexp').value;
        if (!exp) { toast('Choose an expiry date.'); break; }
        S.items.push({ id: uid(), name: g.known ? g.name : nm, qty: Math.max(1, +document.getElementById('mqty').value || 1), cat: document.getElementById('mcat').value.trim() || g.cat, emoji: g.emoji, bought: document.getElementById('mbought').value || KK.toISODate(today()), expiry: exp });
        save(); toast(nm + ' added!', true); go('home'); break;
      }
      case 'cook': { const r = KK.suggestRecipes(S.items).find(x => x.id === id); if (r) { useRecipe(r); toast('Enjoy your meal! Used items updated.', true); go('home'); } break; }
      case 'miss-shop': { const r = KK.suggestRecipes(S.items).find(x => x.id === id); if (r) { r.missing.forEach(n => { if (!S.shopping.some(x => x.name === n && !x.done)) S.shopping.push({ id: uid(), name: n, done: false }); }); save(); toast('Missing items added to your shopping list.'); } break; }
      case 'plan-pick': {
        const days = []; for (let i = 0; i < 7; i++) days.push(KK.addDays(today(), i));
        const r = KK.RECIPES.find(x => x.id === id);
        modal('<h3>Add to Meal Plan</h3><label for="pd">Day</label><select id="pd" class="input">' + days.map(x => '<option value="' + KK.toISODate(x) + '">' + DAYS[x.getDay()] + ', ' + MONTHS[x.getMonth()] + ' ' + x.getDate() + '</option>').join('') + '</select>' +
          '<label for="pm">Meal</label><select id="pm" class="input">' + MEALS.map(m => '<option' + (m === r.meal ? ' selected' : '') + '>' + m + '</option>').join('') + '</select>' +
          '<button class="btn primary" data-act="plan-save" data-id="' + id + '">Save</button>');
        break;
      }
      case 'plan-save': { const d = $id('pd').value, m = $id('pm').value; S.plan[d] = S.plan[d] || {}; S.plan[d][m] = id; selDay = d; save(); toast('Added to meal plan!', true); go('mealplan'); break; }
      case 'selday': selDay = el.dataset.v; render(); break;
      case 'meal': {
        const m = el.dataset.v, list = KK.suggestRecipes(S.items), rs = KK.RECIPES.filter(r => !list.some(x => x.id === r.id)).map(r => Object.assign({}, r, { used: [], missing: r.need }));
        modal('<h3>Choose ' + m + '</h3>' + list.concat(rs).sort((a, b) => (b.meal === m) - (a.meal === m)).map(r => '<button class="row light" data-act="meal-set" data-v="' + m + '" data-id="' + r.id + '"><div class="thumb" style="background:var(--yellow)">' + r.emoji + '</div><div class="info"><b>' + esc(r.name) + '</b><small>⏱ ' + r.time + ' min' + (r.meal === m ? ' · great for ' + m.toLowerCase() : '') + '</small></div></button>').join('') +
          ((S.plan[selDay] || {})[m] ? '<button class="btn danger" data-act="meal-del" data-v="' + m + '">Remove this meal</button>' : ''));
        break;
      }
      case 'meal-set': S.plan[selDay] = S.plan[selDay] || {}; S.plan[selDay][el.dataset.v] = id; save(); render(); break;
      case 'meal-del': if (S.plan[selDay]) delete S.plan[selDay][el.dataset.v]; save(); render(); break;
      case 'autoplan': {
        const list = KK.suggestRecipes(S.items); const used = new Set(Object.values(S.plan[selDay] || {})); S.plan[selDay] = S.plan[selDay] || {};
        MEALS.forEach(m => { if (S.plan[selDay][m]) return; const pick = list.find(r => r.meal === m && !used.has(r.id)) || (m !== 'Drink' ? list.find(r => !used.has(r.id) && r.meal !== 'Drink') : null); if (pick) { S.plan[selDay][m] = pick.id; used.add(pick.id); } });
        save(); render(); toast(list.length ? 'Meal plan filled from your fridge.' : 'Your fridge is empty, add items first.'); break;
      }
      case 'clearplan': delete S.plan[selDay]; save(); render(); break;
      case 'shop-add': { const i = $id('shopin'), v = i.value.trim(); if (v) { S.shopping.push({ id: uid(), name: v, done: false }); save(); render(); } break; }
      case 'shop-del': e.preventDefault(); S.shopping = S.shopping.filter(x => x.id !== id); save(); render(); break;
      case 'shop-clear': S.shopping = S.shopping.filter(x => !x.done); save(); render(); break;
      case 'rename': { const n = prompt('New nickname:', name()); if (n && n.trim()) { S.user.name = n.trim().slice(0, 20); save(); render(); } break; }
      case 'notif': {
        if (!S.notif) {
          if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (er) { /* ignore */ } }
          S.notif = true; toast('Reminders on' + ((window.Notification && Notification.permission === 'granted') ? ' (including browser notifications).' : ' inside the app.'));
        } else S.notif = false;
        save(); render(); notifyDue(); break;
      }
      case 'reset': if (confirm('Reset your fridge to the sample data?')) { seed(); S.shopping = []; S.plan = {}; save(); toast('Sample data restored.'); go('home'); } break;
      case 'logout': if (confirm('Sign out? Your data stays on this device.')) { S.user = null; save(); go('onb/1'); } break;
    }
  });

  $app.addEventListener('click', () => { if (tutBackup) setTimeout(tutRefresh, 60); }); // re-check the tutorial goal after every tap

  $app.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'fcam' || t.id === 'fgal') { cropOpen(t.files[0]); t.value = ''; return; } // photo -> crop editor -> scan
    if (t.dataset.act === 'shop-toggle') { const x = S.shopping.find(y => y.id === t.dataset.id); if (x) { x.done = t.checked; save(); render(); } return; }
    if (t.dataset.field) {
      const it = S.items.find(i => i.id === t.dataset.id); if (!it) return;
      if (t.dataset.field === 'qty') it.qty = Math.max(1, +t.value || 1); else if (t.value) it.expiry = t.value;
      save(); render(); return;
    }
    if (t.id === 'mname' || t.id === 'mbought') { // auto-fill the expiry date
      const f = KK.findFood($id('mname').value);
      if (f) {
        const b = $id('mbought').value || KK.toISODate(today());
        $id('mexp').value = KK.toISODate(KK.addDays(new Date(b + 'T00:00:00'), f.days));
        if (!$id('mcat').value) $id('mcat').value = f.cat;
        $id('mhint').textContent = f.name + ' usually lasts about ' + f.days + ' days in the fridge.';
      }
    }
  });
  $app.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'search') { V._q = t.value; const pos = t.selectionStart; render(); const s = $id('search'); if (s) { s.focus(); s.setSelectionRange(pos, pos); } return; }
    if (t.dataset.d !== undefined) { const d = draft[+t.dataset.d], f = t.dataset.f; if (d) d[f] = t.value; }
  });
  $app.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'shopin') { e.preventDefault(); $app.querySelector('[data-act="shop-add"]').click(); }
    if (['lname', 'lmail', 'lpass'].includes(e.target.id)) { e.preventDefault(); $app.querySelector('[data-act="login"]').click(); }
  });

  render(); notifyDue();
})();