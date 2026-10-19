const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const adminIo = io.of('/admin');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const LOG_FILE = path.join(DATA_DIR, 'events.log');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- VERİTABANI (JSON dosyası) ----------
const DEFAULT_SETTINGS = {
  raceIntervalSec: 180, betCutoffSec: 15, autoRace: true, strictOwner: true,
  defaultScratchPrice: 10, defaultHorseStake: 100,
  horses: [
    { name: 'Bleeder', weight: 30, multiplier: 2.8 },
    { name: "Hennigan's Steed", weight: 25, multiplier: 3.4 },
    { name: 'Pisswasser Express', weight: 20, multiplier: 4.2 },
    { name: 'Yellow Jack', weight: 15, multiplier: 5.6 },
    { name: 'Leonida Lightning', weight: 10, multiplier: 8.4 }
  ],
  prizes: { jackpot: { amount: 500, weight: 5 }, big: { amount: 50, weight: 15 }, refund: { weight: 20 }, none: { weight: 60 } }
};
const SEED_PRODUCTS = [
  { id: 'seed1', name: 'Pisswasser (şişe)', price: 5, inStock: true, image: null },
  { id: 'seed2', name: 'Sprunk', price: 3, inStock: true, image: null },
  { id: 'seed3', name: 'Cips', price: 2, inStock: true, image: null }
];
let db = { settings: DEFAULT_SETTINGS, tickets: {}, races: [], logs: [], nextRaceId: 1, products: SEED_PRODUCTS, orders: {}, nextOrderId: 1, feedback: [], nextFeedbackId: 1 };
try {
  const saved = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  db = { ...db, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } };
} catch (e) { /* ilk çalıştırma */ }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DB_FILE + '.tmp', JSON.stringify(db), err => { if (!err) fs.rename(DB_FILE + '.tmp', DB_FILE, () => {}); });
  }, 400);
}

function log(type, msg, data = {}) {
  const entry = { t: Date.now(), type, msg, ...data };
  db.logs.push(entry);
  if (db.logs.length > 5000) db.logs.shift();
  fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', () => {});
  adminIo.emit('log', entry);
  save();
}

// ---------- BİLET KODLARI ----------
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(prefix) {
  let code;
  do {
    code = prefix + '-' + Array.from(crypto.randomBytes(6), b => ALPHABET[b % 32]).join('');
  } while (db.tickets[code]);
  return code;
}
function normalizeCode(raw) {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[KA][A-Z0-9]{6}$/.test(c) ? c[0] + '-' + c.slice(1) : '';
}
const money = n => '$' + Number(n).toLocaleString('en-US');

// ---------- YARIŞ MOTORU ----------
const TICK_MS = 300, RESULT_HOLD_MS = 9000;
let race = null;       // { id, phase: betting|running|results, startsAt, positions, order }
let raceTimer = null;
let paused = false;

function newRace() {
  race = { id: db.nextRaceId, phase: 'betting', startsAt: null, positions: [0, 0, 0, 0, 0], order: null };
  scheduleStart();
  broadcastRace();
}
function scheduleStart() {
  race.startsAt = db.settings.autoRace && !paused ? Date.now() + db.settings.raceIntervalSec * 1000 : null;
}
function publicRace() {
  const s = db.settings;
  return {
    id: race.id, phase: race.phase, startsAt: race.startsAt, now: Date.now(), cutoffSec: s.betCutoffSec,
    positions: race.positions, order: race.order,
    horses: s.horses.map((h, i) => ({ n: i + 1, name: h.name, multiplier: h.multiplier }))
  };
}
function broadcastRace() { io.emit('race', publicRace()); adminIo.emit('race', publicRace()); }

function pickOrder() {
  const pool = db.settings.horses.map((h, i) => ({ i, w: Math.max(0.01, +h.weight || 1) }));
  const order = [];
  while (pool.length) {
    let r = Math.random() * pool.reduce((a, b) => a + b.w, 0), k = 0;
    for (; k < pool.length - 1; k++) { r -= pool[k].w; if (r <= 0) break; }
    order.push(pool.splice(k, 1)[0].i);
  }
  return order; // order[0] = kazanan at indeksi
}

function startRace() {
  if (race.phase !== 'betting') return;
  race.phase = 'running';
  race.startsAt = null;
  const order = pickOrder();
  const finishTick = [];
  let t = 38 + Math.floor(Math.random() * 8);
  order.forEach(h => { finishTick[h] = t; t += 1 + Math.floor(Math.random() * 3); });
  const wob = finishTick.map(() => ({ a: 4 + Math.random() * 5, f: 0.25 + Math.random() * 0.4, p: Math.random() * 6 }));
  let tick = 0;
  log('race_start', `Yarış #${race.id} başladı`, { raceId: race.id });
  broadcastRace();
  raceTimer = setInterval(() => {
    tick++;
    for (let h = 0; h < 5; h++) {
      const T = finishTick[h];
      let p = tick >= T ? 100 : Math.min(99, (tick / T) * 100 + wob[h].a * Math.sin(tick * wob[h].f + wob[h].p) * (1 - tick / T));
      race.positions[h] = Math.max(race.positions[h], +p.toFixed(1));
    }
    io.emit('race:tick', race.positions);
    if (race.positions[order[0]] >= 100) { clearInterval(raceTimer); finishRace(order); }
  }, TICK_MS);
}

function finishRace(order) {
  race.phase = 'results';
  race.order = order;
  const names = db.settings.horses.map(h => h.name);
  const winner = order[0];
  db.races.push({ id: race.id, t: Date.now(), winner: winner + 1, winnerName: names[winner], order: order.map(i => i + 1) });
  if (db.races.length > 200) db.races.shift();
  log('race_finish', `Yarış #${race.id} bitti. Kazanan: ${winner + 1}. ${names[winner]}`, { raceId: race.id, winner: winner + 1 });

  for (const tk of Object.values(db.tickets)) {
    if (tk.type !== 'A' || tk.status !== 'active' || tk.raceId !== race.id || !tk.horse) continue;
    if (tk.horse === winner + 1) {
      tk.status = 'won'; tk.payout = Math.round(tk.price * tk.multiplier);
      log('ticket_won', `${tk.redeemedBy || tk.owner} kazandı: ${tk.code} (${tk.horse}. at) → ${money(tk.payout)}`, { code: tk.code, who: tk.redeemedBy || tk.owner, amount: tk.payout, raceId: race.id });
    } else {
      tk.status = 'lost'; tk.payout = 0;
      log('ticket_lost', `${tk.redeemedBy || tk.owner} kaybetti: ${tk.code} (${tk.horse}. at, ${money(tk.price)})`, { code: tk.code, who: tk.redeemedBy || tk.owner, raceId: race.id });
    }
    tk.resolvedAt = Date.now();
    io.to('t:' + tk.code).emit('ticket', publicTicket(tk));
  }
  db.nextRaceId = race.id + 1;
  save();
  broadcastRace();
  setTimeout(newRace, RESULT_HOLD_MS);
}

setInterval(() => {
  if (race && race.phase === 'betting' && race.startsAt && Date.now() >= race.startsAt) startRace();
}, 500);

// Yarışa kayıt: bahis kapanışına kalan süre yetmiyorsa bir sonraki yarışa yazılır
function upcomingRaceId() {
  const closed = race.phase !== 'betting' || (race.startsAt && race.startsAt - Date.now() < db.settings.betCutoffSec * 1000);
  return closed ? race.id + 1 : race.id;
}

// ---------- BİLET YARDIMCILARI ----------
function publicTicket(tk) {
  const { code, type, owner, price, horse, status, payout, raceId, multiplier, prize } = tk;
  const out = { code, type, owner, price, horse, status, payout, raceId, multiplier };
  if (type === 'K' && prize && (status === 'active' || status === 'won' || status === 'lost' || status === 'paid')) out.prize = { label: prize.label, amount: prize.amount };
  return out;
}
function rollPrize(price) {
  const p = db.settings.prizes;
  const tiers = [
    { id: 'jackpot', amount: +p.jackpot.amount, weight: +p.jackpot.weight },
    { id: 'big', amount: +p.big.amount, weight: +p.big.weight },
    { id: 'refund', amount: price, weight: +p.refund.weight },
    { id: 'none', amount: 0, weight: +p.none.weight }
  ];
  let r = Math.random() * tiers.reduce((a, t) => a + t.weight, 0);
  const tier = tiers.find(t => (r -= t.weight) <= 0) || tiers[3];
  const label = tier.id === 'none' ? 'BOŞ' : tier.id === 'refund' ? 'AMORTİ' : money(tier.amount);
  return { tier: tier.id, amount: tier.amount, label };
}

// ---------- OYUNCU SOKETİ ----------
const fbIp = {};
io.on('connection', socket => {
  let strikes = 0, lockedUntil = 0;
  const ip = socket.handshake.address;
  socket.emit('race', publicRace());
  let lastOrder = 0;

  let lastFb = 0;
  socket.on('feedback', (req, ack) => {
    if (typeof ack !== 'function') return;
    const now = Date.now();
    if (now - lastFb < 20000 || now - (fbIp[ip] || 0) < 20000) return ack({ ok: false, reason: 'fast' });
    const kind = req && (req.kind === 'praise' || req.kind === 'complaint') ? req.kind : null;
    const text = String((req && req.text) || '').trim().slice(0, 500);
    const who = String((req && req.name) || '').trim().slice(0, 40) || 'Anonim';
    if (!kind || text.length < 5) return ack({ ok: false, reason: 'short' });
    lastFb = fbIp[ip] = now;
    const fb = { id: db.nextFeedbackId++, kind, who, text, status: 'new', createdAt: now };
    db.feedback.push(fb);
    if (db.feedback.length > 500) db.feedback.shift();
    log('feedback_new', `${kind === 'praise' ? 'Övgü' : 'Şikayet'} — ${who}: ${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`, { who, ip });
    adminIo.emit('feedback', fb);
    ack({ ok: true, kind });
  });

  socket.on('order', (req, ack) => {
    if (typeof ack !== 'function') return;
    if (Date.now() - lastOrder < 5000) return ack({ ok: false, reason: 'fast' });
    const name = String((req && req.name) || '').trim().slice(0, 40);
    if (!name) return ack({ ok: false, reason: 'name' });
    const raw = Array.isArray(req.items) ? req.items.slice(0, 20) : [];
    const items = [], soldOut = [];
    for (const it of raw) {
      const p = db.products.find(x => x.id === (it && it.id));
      const qty = Math.min(Math.max(parseInt(it && it.qty, 10) || 0, 0), 10);
      if (!p || !qty) continue;
      if (!p.inStock) { soldOut.push(p.name); continue; }
      items.push({ id: p.id, name: p.name, price: p.price, qty });
    }
    if (soldOut.length) return ack({ ok: false, reason: 'stock', names: soldOut.join(', ') });
    if (!items.length) return ack({ ok: false, reason: 'empty' });
    lastOrder = Date.now();
    const order = { id: db.nextOrderId++, who: name, items, total: items.reduce((a, i) => a + i.price * i.qty, 0), status: 'new', createdAt: Date.now() };
    db.orders[order.id] = order;
    socket.join('o:' + order.id);
    log('order_new', `Yeni sipariş #${order.id} — ${name}: ${items.map(i => i.qty + 'x ' + i.name).join(', ')} (${money(order.total)})`, { who: name, orderId: order.id });
    adminIo.emit('order', order);
    ack({ ok: true, id: order.id, total: order.total });
  });

  socket.on('redeem', (req, ack) => {
    if (typeof ack !== 'function') return;
    if (Date.now() < lockedUntil) return ack({ ok: false, reason: 'locked', secs: Math.ceil((lockedUntil - Date.now()) / 1000) });
    const code = normalizeCode(req && req.code);
    const name = String((req && req.name) || '').trim().slice(0, 40);
    const tk = code && db.tickets[code];
    if (!tk) {
      strikes++;
      log('invalid_code', `Geçersiz kod denemesi: "${String(req && req.code).slice(0, 20)}" (${name || 'isimsiz'})`, { ip, who: name });
      if (strikes >= 5) { lockedUntil = Date.now() + 30000; strikes = 0; return ack({ ok: false, reason: 'locked', secs: 30 }); }
      return ack({ ok: false, reason: 'invalid', strikes });
    }
    strikes = 0;
    if (tk.status === 'void') return ack({ ok: false, reason: 'void' });

    if (tk.status === 'issued') {
      if (db.settings.strictOwner && tk.owner && name && name.toLowerCase() !== tk.owner.toLowerCase()) {
        log('owner_mismatch', `Sahiplik uyuşmazlığı: ${code} ${tk.owner} adına, ${name} sundu`, { code, who: name, ip });
        return ack({ ok: false, reason: 'owner', owner: tk.owner });
      }
      tk.redeemedBy = name || tk.owner || 'Bilinmiyor';
      tk.redeemedAt = Date.now();
      tk.status = 'active';
      if (tk.type === 'K') tk.prize = rollPrize(tk.price);
      log('ticket_redeemed', `${tk.redeemedBy} bileti okuttu: ${code} (${tk.type === 'K' ? 'Kazı Kazan' : 'At Yarışı'}, ${money(tk.price)})`, { code, who: tk.redeemedBy, ip });
      if (tk.type === 'A' && tk.horse) registerRace(tk);
    }
    socket.join('t:' + code);
    save();
    ack({ ok: true, ticket: publicTicket(tk), pickHorse: tk.type === 'A' && tk.status === 'active' && !tk.horse });
  });

  socket.on('pickHorse', (req, ack) => {
    const tk = db.tickets[normalizeCode(req && req.code)];
    const n = parseInt(req && req.horse, 10);
    if (!tk || tk.type !== 'A' || tk.status !== 'active' || tk.horse || !(n >= 1 && n <= 5) || typeof ack !== 'function') return;
    tk.horse = n;
    registerRace(tk);
    save();
    ack({ ok: true, ticket: publicTicket(tk) });
  });

  socket.on('scratched', (req, ack) => {
    const tk = db.tickets[normalizeCode(req && req.code)];
    if (!tk || tk.type !== 'K' || tk.status !== 'active') return;
    tk.resolvedAt = Date.now();
    if (tk.prize.amount > 0) {
      tk.status = 'won'; tk.payout = tk.prize.amount;
      log('ticket_won', `${tk.redeemedBy} kazandı: ${tk.code} (Kazı Kazan) → ${money(tk.payout)}`, { code: tk.code, who: tk.redeemedBy, amount: tk.payout });
    } else {
      tk.status = 'lost'; tk.payout = 0;
      log('ticket_lost', `${tk.redeemedBy} kaybetti: ${tk.code} (Kazı Kazan, ${money(tk.price)})`, { code: tk.code, who: tk.redeemedBy });
    }
    save();
    if (typeof ack === 'function') ack({ ticket: publicTicket(tk) });
  });
});

function registerRace(tk) {
  tk.raceId = upcomingRaceId();
  tk.multiplier = db.settings.horses[tk.horse - 1].multiplier;
  const h = db.settings.horses[tk.horse - 1].name;
  log('horse_bet', `${tk.redeemedBy} → ${tk.horse}. ${h} (${money(tk.price)}, x${tk.multiplier}) Yarış #${tk.raceId}`, { code: tk.code, who: tk.redeemedBy, raceId: tk.raceId });
}

// ---------- ADMİN API ----------
const tokens = new Set();
const failLog = {};
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
function auth(req, res, next) {
  if (tokens.has(req.get('x-admin-token'))) return next();
  res.status(401).json({ error: 'Yetkisiz' });
}
adminIo.use((s, next) => (tokens.has(s.handshake.auth && s.handshake.auth.token) ? next() : next(new Error('auth'))));

app.get('/api/public/info', (req, res) => {
  const s = db.settings, p = s.prizes;
  res.json({ horses: s.horses.map((h, i) => ({ n: i + 1, name: h.name, multiplier: h.multiplier })), prizes: [p.jackpot.amount, p.big.amount], cutoffSec: s.betCutoffSec, intervalSec: s.raceIntervalSec });
});

app.post('/api/admin/login', (req, res) => {
  const ip = req.ip, f = failLog[ip] || { n: 0, t: 0 };
  if (f.n >= 5 && Date.now() - f.t < 300000) return res.status(429).json({ error: '5 dakika bekle.' });
  if (crypto.timingSafeEqual(sha(req.body.password), sha(ADMIN_PASSWORD))) {
    delete failLog[ip];
    const token = crypto.randomBytes(24).toString('hex');
    tokens.add(token);
    log('admin_login', 'Admin girişi', { ip });
    return res.json({ token, defaultPassword: ADMIN_PASSWORD === 'changeme' });
  }
  failLog[ip] = { n: f.n + 1, t: Date.now() };
  log('admin_login_fail', 'Hatalı admin şifresi', { ip });
  res.status(401).json({ error: 'Şifre yanlış.' });
});

app.get('/api/admin/state', auth, (req, res) => {
  const all = Object.values(db.tickets).filter(t => t.status !== 'void');
  const sum = (arr, f) => arr.reduce((a, t) => a + f(t), 0);
  res.json({
    settings: db.settings, race: publicRace(), paused,
    stats: {
      sold: all.length, revenue: sum(all, t => t.price),
      paid: sum(all.filter(t => t.status === 'paid'), t => t.payout),
      pending: sum(all.filter(t => t.status === 'won'), t => t.payout),
      pendingCount: all.filter(t => t.status === 'won').length,
      active: all.filter(t => t.status === 'active').length,
      newOrders: Object.values(db.orders).filter(o => o.status === 'new').length,
      newFeedback: db.feedback.filter(f => f.status === 'new').length
    },
    races: db.races.slice(-15).reverse()
  });
});

app.get('/api/admin/tickets', auth, (req, res) => {
  const { status, q } = req.query;
  let list = Object.values(db.tickets);
  if (status) list = list.filter(t => t.status === status);
  if (q) { const s = String(q).toLowerCase(); list = list.filter(t => (t.code + ' ' + t.owner + ' ' + (t.redeemedBy || '')).toLowerCase().includes(s)); }
  res.json(list.sort((a, b) => b.createdAt - a.createdAt).slice(0, 300));
});

app.post('/api/admin/tickets', auth, (req, res) => {
  const b = req.body, type = b.type === 'A' ? 'A' : 'K';
  const qty = Math.min(Math.max(parseInt(b.quantity, 10) || 1, 1), 50);
  const price = Math.max(1, Math.round(+b.price || (type === 'K' ? db.settings.defaultScratchPrice : db.settings.defaultHorseStake)));
  const horse = type === 'A' && b.horse >= 1 && b.horse <= 5 ? +b.horse : null;
  const owner = String(b.owner || '').trim().slice(0, 40);
  const created = [];
  for (let i = 0; i < qty; i++) {
    const code = newCode(type);
    db.tickets[code] = { code, type, owner, price, horse, status: 'issued', createdAt: Date.now() };
    created.push(code);
  }
  log('ticket_created', `${qty}x ${type === 'K' ? 'Kazı Kazan' : 'At Yarışı'} bileti oluşturuldu (${money(price)}${owner ? ', ' + owner : ''}): ${created.join(', ')}`, { who: owner });
  res.json({ created: created.map(c => ({ code: c, type, price, owner, horse })) });
});

function ticketAction(action, from) {
  app.post(`/api/admin/tickets/:code/${action}`, auth, (req, res) => {
    const tk = db.tickets[req.params.code];
    if (!tk) return res.status(404).json({ error: 'Bilet yok' });
    if (!from.includes(tk.status)) return res.status(400).json({ error: `Bu durumda yapılamaz (${tk.status})` });
    if (action === 'pay') { tk.status = 'paid'; tk.paidAt = Date.now(); log('ticket_paid', `ÖDENDİ: ${tk.code} → ${tk.redeemedBy || tk.owner}, ${money(tk.payout)}`, { code: tk.code, who: tk.redeemedBy || tk.owner, amount: tk.payout }); }
    else { tk.status = 'void'; log('ticket_void', `İPTAL: ${tk.code} (${tk.owner || 'sahipsiz'})`, { code: tk.code }); }
    io.to('t:' + tk.code).emit('ticket', publicTicket(tk));
    res.json({ ok: true });
  });
}
ticketAction('pay', ['won']);
ticketAction('void', ['issued', 'active']);

app.get('/api/admin/logs', auth, (req, res) => {
  const { type, q } = req.query;
  let list = db.logs;
  if (type) list = list.filter(l => l.type === type);
  if (q) { const s = String(q).toLowerCase(); list = list.filter(l => l.msg.toLowerCase().includes(s)); }
  res.json(list.slice(-400).reverse());
});

app.post('/api/admin/race/:cmd', auth, (req, res) => {
  const cmd = req.params.cmd;
  if (cmd === 'run') { if (race.phase !== 'betting') return res.status(400).json({ error: 'Yarış zaten sürüyor.' }); log('admin', 'Yarış elle başlatıldı'); startRace(); }
  else if (cmd === 'pause') { paused = true; if (race.phase === 'betting') race.startsAt = null; log('admin', 'Otomatik yarışlar durduruldu'); broadcastRace(); }
  else if (cmd === 'resume') { paused = false; if (race.phase === 'betting') scheduleStart(); log('admin', 'Otomatik yarışlar sürdürüldü'); broadcastRace(); }
  else return res.sendStatus(404);
  res.json({ ok: true });
});

app.put('/api/admin/settings', auth, (req, res) => {
  const b = req.body, s = db.settings, num = (v, d, min) => Math.max(min, Number.isFinite(+v) ? +v : d);
  s.raceIntervalSec = num(b.raceIntervalSec, s.raceIntervalSec, 20);
  s.betCutoffSec = num(b.betCutoffSec, s.betCutoffSec, 0);
  s.autoRace = !!b.autoRace; s.strictOwner = !!b.strictOwner;
  s.defaultScratchPrice = num(b.defaultScratchPrice, s.defaultScratchPrice, 1);
  s.defaultHorseStake = num(b.defaultHorseStake, s.defaultHorseStake, 1);
  if (Array.isArray(b.horses) && b.horses.length === 5) s.horses = b.horses.map((h, i) => ({ name: String(h.name || s.horses[i].name).slice(0, 30), weight: num(h.weight, 1, 0.01), multiplier: num(h.multiplier, 2, 1) }));
  if (b.prizes) for (const k of ['jackpot', 'big']) { s.prizes[k].amount = num(b.prizes[k].amount, s.prizes[k].amount, 1); s.prizes[k].weight = num(b.prizes[k].weight, 0, 0); }
  if (b.prizes) for (const k of ['refund', 'none']) s.prizes[k].weight = num(b.prizes[k].weight, 0, 0);
  if (race.phase === 'betting') scheduleStart();
  log('settings', 'Ayarlar güncellendi');
  broadcastRace();
  res.json({ ok: true });
});

// ---------- ÜRÜNLER VE SİPARİŞLER ----------
function saveImage(dataUrl) {
  const m = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 1.5 * 1024 * 1024) return null;
  const file = crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
  return file;
}
function removeImage(file) { if (file) fs.unlink(path.join(UPLOAD_DIR, path.basename(file)), () => {}); }
const publicProduct = p => ({ id: p.id, name: p.name, price: p.price, inStock: p.inStock, image: p.image ? '/uploads/' + p.image : null });
function menuChanged() { save(); io.emit('menu'); }
const cleanPrice = v => Math.min(Math.max(0, Math.round(+v || 0)), 100000);

app.get('/api/public/menu', (req, res) => res.json(db.products.map(publicProduct)));
app.get('/api/admin/products', auth, (req, res) => res.json(db.products.map(publicProduct)));

app.post('/api/admin/products', auth, (req, res) => {
  const b = req.body, name = String(b.name || '').trim().slice(0, 50);
  if (!name) return res.status(400).json({ error: 'Ürün adı boş olamaz.' });
  const p = { id: crypto.randomBytes(4).toString('hex'), name, price: cleanPrice(b.price), inStock: b.inStock !== false, image: null };
  if (b.image) { p.image = saveImage(b.image); if (!p.image) return res.status(400).json({ error: 'Görsel geçersiz ya da çok büyük.' }); }
  db.products.push(p);
  log('product_add', `Ürün eklendi: ${p.name} (${money(p.price)}, ${p.inStock ? 'stokta var' : 'tükendi'})`);
  menuChanged();
  res.json(publicProduct(p));
});

app.put('/api/admin/products/:id', auth, (req, res) => {
  const p = db.products.find(x => x.id === req.params.id), b = req.body;
  if (!p) return res.status(404).json({ error: 'Ürün yok' });
  const before = p.name;
  if (b.name !== undefined) { const n = String(b.name).trim().slice(0, 50); if (!n) return res.status(400).json({ error: 'Ürün adı boş olamaz.' }); p.name = n; }
  if (b.price !== undefined) p.price = cleanPrice(b.price);
  if (b.image) { const f = saveImage(b.image); if (!f) return res.status(400).json({ error: 'Görsel geçersiz ya da çok büyük.' }); removeImage(p.image); p.image = f; }
  if (b.removeImage) { removeImage(p.image); p.image = null; }
  if (b.inStock !== undefined && p.inStock !== !!b.inStock) { p.inStock = !!b.inStock; log('product_stock', `${p.name}: ${p.inStock ? 'stokta var' : 'tükendi'}`); }
  else if (b.name !== undefined || b.price !== undefined) log('product_edit', `Ürün güncellendi: ${before}${before !== p.name ? ' → ' + p.name : ''} (${money(p.price)})`);
  menuChanged();
  res.json(publicProduct(p));
});

app.delete('/api/admin/products/:id', auth, (req, res) => {
  const i = db.products.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Ürün yok' });
  const [p] = db.products.splice(i, 1);
  removeImage(p.image);
  log('product_remove', `Ürün silindi: ${p.name}`);
  menuChanged();
  res.json({ ok: true });
});

app.get('/api/admin/orders', auth, (req, res) => {
  let list = Object.values(db.orders);
  if (req.query.status) list = list.filter(o => o.status === req.query.status);
  res.json(list.sort((a, b) => b.id - a.id).slice(0, 200));
});

const ORDER_NEXT = { new: ['ready', 'done', 'cancelled'], ready: ['done', 'cancelled'] };
app.post('/api/admin/orders/:id/status', auth, (req, res) => {
  const o = db.orders[req.params.id], to = req.body.status;
  if (!o) return res.status(404).json({ error: 'Sipariş yok' });
  if (!(ORDER_NEXT[o.status] || []).includes(to)) return res.status(400).json({ error: 'Bu durumda yapılamaz.' });
  o.status = to;
  const label = { ready: 'hazır', done: 'teslim edildi', cancelled: 'iptal edildi' }[to];
  log('order_status', `Sipariş #${o.id} (${o.who}) ${label}`, { orderId: o.id, who: o.who });
  io.to('o:' + o.id).emit('orderUpdate', { id: o.id, status: to });
  save();
  res.json({ ok: true });
});

// ---------- ÖVGÜ / ŞİKAYET DEFTERİ (yalnızca personel okur) ----------
app.get('/api/admin/feedback', auth, (req, res) => {
  let list = db.feedback;
  if (req.query.kind) list = list.filter(f => f.kind === req.query.kind);
  res.json([...list].reverse().slice(0, 200));
});
app.post('/api/admin/feedback/:id/read', auth, (req, res) => {
  const f = db.feedback.find(x => x.id === +req.params.id);
  if (!f) return res.status(404).json({ error: 'Kayıt yok' });
  f.status = 'read'; save(); res.json({ ok: true });
});
app.delete('/api/admin/feedback/:id', auth, (req, res) => {
  const i = db.feedback.findIndex(x => x.id === +req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Kayıt yok' });
  db.feedback.splice(i, 1);
  log('feedback_delete', `Geri bildirim #${req.params.id} silindi`);
  res.json({ ok: true });
});

newRace();
server.listen(PORT, () => {
  console.log(`Davis Liquor & Lotto http://localhost:${PORT}  |  Admin: /admin.html`);
  if (ADMIN_PASSWORD === 'changeme') console.log('UYARI: Varsayılan admin şifresi! ADMIN_PASSWORD ortam değişkenini ayarla.');
});
