/* KulkasKita - logika inti (tanpa DOM, bisa dites di Node) */
(function (root) {
  // Kamus makanan: kata kunci -> kategori, umur simpan (hari), emoji
  const FOODS = [
    { k: ['pakcoi', 'pak coi', 'bokchoy', 'bok choy', 'pak choi', 'pakchoy', 'sawi'], name: 'Bok choy', cat: 'Vegetables', days: 4, emoji: '🥬' },
    { k: ['bayam', 'spinach'], name: 'Spinach', cat: 'Vegetables', days: 3, emoji: '🥬' },
    { k: ['kangkung', 'water spinach'], name: 'Water spinach', cat: 'Vegetables', days: 3, emoji: '🥬' },
    { k: ['kol', 'kubis', 'cabbage'], name: 'Cabbage', cat: 'Vegetables', days: 10, emoji: '🥬' },
    { k: ['wortel', 'carrot'], name: 'Carrot', cat: 'Vegetables', days: 14, emoji: '🥕' },
    { k: ['tomat', 'tomato'], name: 'Tomato', cat: 'Vegetables', days: 6, emoji: '🍅' },
    { k: ['cabai', 'cabe', 'lombok', 'chili', 'chilli'], name: 'Chili', cat: 'Seasoning', days: 7, emoji: '🌶️' },
    { k: ['bawang merah', 'shallot'], name: 'Shallot', cat: 'Seasoning', days: 21, emoji: '🧅' },
    { k: ['bawang putih', 'garlic'], name: 'Garlic', cat: 'Seasoning', days: 30, emoji: '🧄' },
    { k: ['bawang bombay', 'bombay', 'onion'], name: 'Onion', cat: 'Seasoning', days: 21, emoji: '🧅' },
    { k: ['kentang', 'potato'], name: 'Potato', cat: 'Vegetables', days: 20, emoji: '🥔' },
    { k: ['brokoli', 'broccoli'], name: 'Broccoli', cat: 'Vegetables', days: 5, emoji: '🥦' },
    { k: ['timun', 'mentimun', 'cucumber'], name: 'Cucumber', cat: 'Vegetables', days: 6, emoji: '🥒' },
    { k: ['jagung', 'corn'], name: 'Corn', cat: 'Vegetables', days: 4, emoji: '🌽' },
    { k: ['ayam', 'chicken'], name: 'Chicken', cat: 'Meat & Fish', days: 2, emoji: '🍗' },
    { k: ['daging sapi', 'sapi', 'beef'], name: 'Beef', cat: 'Meat & Fish', days: 3, emoji: '🥩' },
    { k: ['ikan', 'salmon', 'tuna', 'lele', 'nila', 'fish'], name: 'Fish', cat: 'Meat & Fish', days: 2, emoji: '🐟' },
    { k: ['udang', 'shrimp', 'prawn'], name: 'Shrimp', cat: 'Meat & Fish', days: 2, emoji: '🦐' },
    { k: ['sosis', 'sausage'], name: 'Sausage', cat: 'Processed', days: 14, emoji: '🌭' },
    { k: ['nugget'], name: 'Nuggets', cat: 'Processed', days: 60, emoji: '🍗' },
    { k: ['telur', 'telor', 'egg', 'eggs'], name: 'Eggs', cat: 'Protein', days: 21, emoji: '🥚' },
    { k: ['tempe', 'tempeh'], name: 'Tempeh', cat: 'Protein', days: 3, emoji: '🟫' },
    { k: ['tahu', 'tofu'], name: 'Tofu', cat: 'Protein', days: 3, emoji: '⬜' },
    { k: ['susu', 'milk'], name: 'Milk', cat: 'Dairy', days: 7, emoji: '🥛' },
    { k: ['keju', 'cheese'], name: 'Cheese', cat: 'Dairy', days: 30, emoji: '🧀' },
    { k: ['yogurt', 'yoghurt'], name: 'Yogurt', cat: 'Dairy', days: 10, emoji: '🥣' },
    { k: ['mentega', 'butter', 'margarin', 'margarine'], name: 'Butter', cat: 'Dairy', days: 60, emoji: '🧈' },
    { k: ['roti', 'bread'], name: 'Bread', cat: 'Carbs', days: 4, emoji: '🍞' },
    { k: ['nasi', 'cooked rice'], name: 'Cooked rice', cat: 'Carbs', days: 1, emoji: '🍚' },
    { k: ['mie', 'mi instan', 'indomie', 'noodle', 'noodles'], name: 'Noodles', cat: 'Carbs', days: 180, emoji: '🍜' },
    { k: ['beras', 'rice'], name: 'Rice', cat: 'Carbs', days: 180, emoji: '🍚' },
    { k: ['pisang', 'banana'], name: 'Banana', cat: 'Fruit', days: 5, emoji: '🍌' },
    { k: ['apel', 'apple'], name: 'Apple', cat: 'Fruit', days: 20, emoji: '🍎' },
    { k: ['jeruk', 'orange'], name: 'Orange', cat: 'Fruit', days: 14, emoji: '🍊' },
    { k: ['semangka', 'watermelon'], name: 'Watermelon', cat: 'Fruit', days: 5, emoji: '🍉' },
    { k: ['mangga', 'mango'], name: 'Mango', cat: 'Fruit', days: 5, emoji: '🥭' },
    { k: ['alpukat', 'avocado'], name: 'Avocado', cat: 'Fruit', days: 4, emoji: '🥑' },
    { k: ['kecap', 'saos', 'saus', 'sauce'], name: 'Sauce', cat: 'Seasoning', days: 180, emoji: '🍶' },
    { k: ['minyak', 'oil'], name: 'Cooking oil', cat: 'Seasoning', days: 365, emoji: '🛢️' },
    { k: ['jus', 'juice'], name: 'Juice', cat: 'Drinks', days: 5, emoji: '🧃' },
  ];

  // Baris yang BUKAN barang (header/footer struk). (?![a-z]) = harus kata utuh, jadi "NORI" tidak dianggap "NO."
  const NOISE = /^(?:subtotal|sub total|total|ppn|pajak|tunai|kembali|kembalian|bayar|cash|change|kasir|no\.?|tgl|tanggal|jam|struk|terima ?kasih|terimakasih|alamat|j[l1i]\.?\s|telp|npwp|diskon|qty|nama barang|harga|member|point|poin|tax|service|pagan|debit|kartu|alfamart|indomaret|indomart|supermarket|store|toko|jumlah|item|receipt|cashier|thank|invoice|amount|price|vat|address)(?![a-z])/i;
  // Baris barang pasti punya harga: "6.000", "6,000", "6 000" atau angka 4+ digit
  const PRICE = /\d{1,3}[.,\s]\d{3}(?!\d)|\d{4,}/;

  // Jarak Levenshtein: berapa huruf yang beda antara dua kata (dipakai untuk memaafkan salah baca OCR)
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  // Bersihkan kesalahan umum OCR: "PAKC0I" -> "PAKCOI", "|" -> "I"
  function normalizeOCR(text) {
    return String(text || '').replace(/\|/g, 'I').split(/\r?\n/).map(line =>
      line.split(/(\s+)/).map(tok => {
        const letters = (tok.match(/\p{L}/gu) || []).length, digits = (tok.match(/\d/g) || []).length;
        if (letters >= 3 && digits >= 1 && digits <= 2 && letters > digits) return tok.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
        return tok;
      }).join('')
    ).join('\n');
  }

  function findFood(text) {
    const t = String(text).toLowerCase();
    let best = null, bestLen = 0;
    // 1) cocok persis (kata kunci terpanjang menang)
    for (const f of FOODS) {
      for (const kw of f.k) {
        const re = new RegExp('(^|[^a-z])' + kw.replace(/ /g, '\\s*') + '([^a-z]|$)');
        if (re.test(t) && kw.length > bestLen) { best = f; bestLen = kw.length; }
      }
    }
    if (best) return best;
    // 2) cocok mirip (typo OCR): bandingkan tiap kata dengan kata kunci satu kata
    const words = t.split(/[^a-z]+/).filter(w => w.length >= 5);
    let bestD = 99;
    for (const w of words) {
      for (const f of FOODS) {
        for (const kw of f.k) {
          if (kw.includes(' ') || kw.length < 5) continue;
          const d = lev(w, kw), lim = kw.length >= 8 ? 2 : 1;
          if (d <= lim && d < bestD) { best = f; bestD = d; }
        }
      }
    }
    return best;
  }

  function guessItem(rawName, qty) {
    const f = findFood(rawName);
    const clean = String(rawName).replace(/[^\p{L}\p{N}\s.%/-]/gu, ' ').replace(/\s+/g, ' ').trim();
    const nice = clean.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());
    return {
      name: f ? f.name : nice || 'Item',
      raw: clean,
      qty: qty || 1,
      cat: f ? f.cat : 'Other',
      days: f ? f.days : 7,
      emoji: f ? f.emoji : '🛒',
      known: !!f,
    };
  }

  // Satu baris struk -> satu item (atau null kalau bukan baris barang).
  // Contoh: "1 PAKCOI 500G 6.000 6.000" -> {name:'Pakcoi', qty:1, days:4, known:true}
  function parseLine(line) {
    line = normalizeOCR(line).trim();
    if (line.length < 4 || NOISE.test(line) || !PRICE.test(line)) return null;
    let qty = 1, name = line;
    const lead = line.match(/^(\d{1,2}|[lI|])\s+(.*)$/);              // "1 PAKCOI ..." ("l"/"I" = OCR salah baca angka 1)
    if (lead) { qty = /\d/.test(lead[1]) ? parseInt(lead[1], 10) : 1; name = lead[2]; }
    const x = name.match(/(\d{1,2})\s*[xX]\s*[\d.,]+/);               // "2 x 6.000"
    if (x) qty = parseInt(x[1], 10);
    name = name.replace(/\s*\d{1,2}\s*[xX]\s*[\d.,]+.*$/, '')         // buang "2 x 6.000 12.000"
               .replace(/(\s+[\d.,]{3,})+\s*$/, '')                   // buang harga di ujung
               .trim();
    if (!/\p{L}{3,}/u.test(name)) return null;
    if (qty < 1 || qty > 50) qty = 1;
    return guessItem(name, qty);
  }
  // Gabungkan item kembar (nama sama -> jumlah dijumlah)
  function mergeItems(list, keyField) {
    const map = {};
    for (const it of list) {
      const k = String(it[keyField || 'name']).toLowerCase();
      if (map[k]) map[k].qty += it.qty; else map[k] = Object.assign({}, it);
    }
    return Object.values(map);
  }
  // Pisahkan: bahan makanan yang dikenali vs baris berharga yang tidak dikenali (user bisa menambahkan manual)
  function splitItems(parsed) {
    const ok = parsed.filter(Boolean);
    return { items: mergeItems(ok.filter(i => i.known)), others: mergeItems(ok.filter(i => !i.known), 'raw') };
  }
  function parseReceipt(text) { return splitItems(String(text || '').split(/\r?\n/).map(parseLine)).items; }

  const DAY = 86400000;
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function daysLeft(expiryISO, now) {
    return Math.round((startOfDay(expiryISO) - startOfDay(now || new Date())) / DAY);
  }
  function addDays(date, n) { const d = startOfDay(date); d.setDate(d.getDate() + n); return d; }
  function toISODate(d) {
    const x = new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  // ===== Sistem indikator maskot (5 level, sesuai proposal Gambar 4.8.3) =====
  // A aman (>=8 hari) | B baik (5-7) | C cukup (3-4) | D hampir kedaluwarsa (0-2) | E sudah kedaluwarsa (<0)
  const LEVELS = {
    aman:   { key: 'aman',   code: 'A', short: 'Safe',    label: 'Safe',          color: '#2fb344', range: '8+ days' },
    baik:   { key: 'baik',   code: 'B', short: 'Good',    label: 'Good',          color: '#7cc24a', range: '5-7 days' },
    cukup:  { key: 'cukup',  code: 'C', short: 'Fair',    label: 'Fair',          color: '#f5a524', range: '3-4 days' },
    hampir: { key: 'hampir', code: 'D', short: 'Urgent',  label: 'Expiring soon', color: '#ef6a3a', range: '0-2 days' },
    basi:   { key: 'basi',   code: 'E', short: 'Expired', label: 'Expired',       color: '#e5484d', range: 'Past date' },
  };
  function level(dl) {
    if (dl < 0) return LEVELS.basi;
    if (dl <= 2) return LEVELS.hampir;
    if (dl <= 4) return LEVELS.cukup;
    if (dl <= 7) return LEVELS.baik;
    return LEVELS.aman;
  }
  const status = level; // alias agar kode lama tetap jalan
  const days = n => n + (n === 1 ? ' day' : ' days');
  function dayText(dl) {
    if (dl < 0) return 'Expired ' + days(Math.abs(dl)) + ' ago';
    if (dl === 0) return 'Today';
    return days(dl) + ' left';
  }
  // Level kulkas = level bahan yang PALING mendesak
  function mascotMood(items, now) {
    if (!items.length) return 'baik';
    return level(Math.min.apply(null, items.map(i => daysLeft(i.expiry, now)))).key;
  }
  // Sisa kesegaran 0..1 untuk progress bar: sisa hari / total masa simpan sejak dibeli
  function freshness(it, now) {
    const total = Math.max(1, Math.round((startOfDay(it.expiry) - startOfDay(it.bought || now || new Date())) / DAY));
    return Math.max(0, Math.min(1, daysLeft(it.expiry, now) / total));
  }
  // Kalimat maskot per bahan (gaya "Hurry! Bok choy needs cooking")
  function itemMsg(it, now) {
    const d = daysLeft(it.expiry, now), n = it.name;
    if (d < 0) return { title: n + ' has expired', sub: "Check it carefully before eating. When in doubt, throw it out." };
    if (d <= 2) return { title: 'Hurry! ' + n + ' needs cooking 🥺', sub: d === 0 ? 'It expires today. Cook it now!' : 'Only ' + days(d) + ' left before it wilts!' };
    if (d <= 4) return { title: n + ' needs attention', sub: 'Only ' + days(d) + ' left before it wilts.' };
    if (d <= 7) return { title: n + ' is still good', sub: days(d) + ' left. Plan a meal with it.' };
    return { title: n + ' is fresh 😊', sub: days(d) + ' left. All good.' };
  }

  // Resep
  const RECIPES = [
    { id: 'tumis-pakcoi', name: 'Garlic Bok Choy Stir-fry', time: 10, emoji: '🥬', need: ['Bok choy', 'Garlic'], opt: ['Chili', 'Cooking oil'], steps: ['Slice the garlic and wash the bok choy.', 'Stir-fry the garlic until fragrant.', 'Add the bok choy, a pinch of salt and a splash of soy sauce.', 'Toss for 2-3 minutes, then serve.'], meal: 'Lunch' },
    { id: 'omelet', name: 'Veggie Omelet', time: 8, emoji: '🍳', need: ['Eggs'], opt: ['Tomato', 'Onion', 'Cheese', 'Carrot'], steps: ['Beat the eggs with salt and pepper.', 'Chop the veggies and saute briefly.', 'Pour in the eggs and cook on low heat.', 'Fold and serve.'], meal: 'Breakfast' },
    { id: 'sop-sayur', name: 'Vegetable Soup', time: 20, emoji: '🍲', need: ['Carrot', 'Cabbage'], opt: ['Potato', 'Tomato', 'Garlic', 'Chicken'], steps: ['Bring water to a boil with the garlic.', 'Add carrot and potato, cook for 8 minutes.', 'Add the cabbage and tomato.', 'Season and cook 3 more minutes.'], meal: 'Lunch' },
    { id: 'nasi-goreng', name: 'Rescue Fried Rice', time: 12, emoji: '🍛', need: ['Cooked rice'], opt: ['Eggs', 'Garlic', 'Chili', 'Chicken', 'Sausage'], steps: ['Stir-fry garlic and chili.', 'Add the eggs and scramble.', 'Add the rice and soy sauce.', 'Mix well and serve.'], meal: 'Dinner' },
    { id: 'tumis-kangkung', name: 'Stir-fried Water Spinach', time: 8, emoji: '🥬', need: ['Water spinach'], opt: ['Garlic', 'Chili'], steps: ['Stir-fry garlic and chili.', 'Add the water spinach.', 'Season with oyster sauce or salt, toss quickly.'], meal: 'Lunch' },
    { id: 'tumis-bayam', name: 'Garlic Spinach Stir-fry', time: 8, emoji: '🥬', need: ['Spinach'], opt: ['Garlic', 'Shallot', 'Corn'], steps: ['Stir-fry the garlic and shallot.', 'Add the spinach and corn.', 'Season and remove once wilted.'], meal: 'Lunch' },
    { id: 'ayam-goreng', name: 'Garlic Fried Chicken', time: 20, emoji: '🍗', need: ['Chicken'], opt: ['Garlic', 'Cooking oil'], steps: ['Rub the chicken with garlic and salt.', 'Let it rest for 5 minutes.', 'Fry until golden.'], meal: 'Dinner' },
    { id: 'tahu-tempe', name: 'Fried Tempeh & Tofu', time: 10, emoji: '🟫', need: ['Tempeh'], opt: ['Tofu', 'Chili', 'Cooking oil'], steps: ['Slice the tempeh and tofu.', 'Season with salt and garlic.', 'Fry until browned.'], meal: 'Snack' },
    { id: 'sandwich', name: 'Egg & Cheese Sandwich', time: 7, emoji: '🥪', need: ['Bread'], opt: ['Eggs', 'Cheese', 'Tomato', 'Cucumber'], steps: ['Fry or boil the eggs.', 'Stack on the bread with cheese and veggies.', 'Toast briefly if you like.'], meal: 'Breakfast' },
    { id: 'jus-pisang', name: 'Banana Milk Smoothie', time: 5, emoji: '🥤', need: ['Banana'], opt: ['Milk', 'Yogurt'], steps: ['Add the banana and milk to a blender.', 'Blend until smooth.', 'Serve cold.'], meal: 'Drink' },
    { id: 'kentang-goreng', name: 'Potato Fritters', time: 20, emoji: '🥔', need: ['Potato'], opt: ['Eggs', 'Shallot'], steps: ['Boil and mash the potatoes.', 'Mix in the shallot and egg.', 'Shape and fry.'], meal: 'Snack' },
    { id: 'capcay', name: 'Veggie Chop Suey', time: 15, emoji: '🥘', need: ['Carrot', 'Broccoli'], opt: ['Cabbage', 'Shrimp', 'Garlic', 'Sausage'], steps: ['Stir-fry the garlic.', 'Add the harder veggies first.', 'Add water and seasoning, cook for 5 minutes.'], meal: 'Dinner' },
  ];

  // Cocokkan resep dengan isi kulkas, prioritaskan bahan yang segera kedaluwarsa
  function suggestRecipes(items, now) {
    const byName = {};
    items.forEach(i => { byName[i.name] = i; });
    const out = [];
    for (const r of RECIPES) {
      const haveNeed = r.need.filter(n => byName[n]);
      if (haveNeed.length === 0) continue;
      const missing = r.need.filter(n => !byName[n]);
      const haveOpt = r.opt.filter(n => byName[n]);
      const used = haveNeed.concat(haveOpt);
      let urgency = 0;
      used.forEach(n => {
        const dl = daysLeft(byName[n].expiry, now);
        urgency += dl <= 1 ? 5 : dl <= 3 ? 3 : dl <= 7 ? 1 : 0;
      });
      const score = (haveNeed.length / r.need.length) * 10 + haveOpt.length * 1.2 + urgency - missing.length * 4;
      out.push(Object.assign({}, r, { used, missing, urgency, score, canCook: missing.length === 0 }));
    }
    return out.sort((a, b) => b.score - a.score);
  }

  // Statistik "food rescue": berapa bahan terpakai sebelum kedaluwarsa vs terbuang. pct = null jika belum ada riwayat.
  function stats(items, history) {
    const saved = history.filter(h => h.type === 'used').length;
    const wasted = history.filter(h => h.type === 'wasted').length;
    const total = saved + wasted;
    return { saved, wasted, pct: total ? Math.round((saved / total) * 100) : null };
  }

  const API = { FOODS, RECIPES, LEVELS, findFood, guessItem, parseLine, splitItems, parseReceipt, normalizeOCR, lev, daysLeft, addDays, toISODate, level, status, dayText, mascotMood, freshness, itemMsg, suggestRecipes, stats };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.KK = API;
})(typeof window !== 'undefined' ? window : globalThis);
