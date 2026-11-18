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
const DB_FILE = path.join(DATA_DIR, 'db.json');
const LOG_FILE = path.join(DATA_DIR, 'events.log');
fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- VERİTABANI (JSON dosyası) ----------
const DEFAULT_SETTINGS = {
  siteName: 'Los Santos Race Book',
  raceIntervalSec: 180, betCutoffSec: 15, raceDurationSec: 40,
  autoRace: true, strictOwner: true, defaultHorseStake: 100,
  horses: [
    { name: 'Bleeder', weight: 26, multiplier: 3.3 },
    { name: "Hennigan's Steed", weight: 22, multiplier: 3.9 },
    { name: 'Vespucci Express', weight: 18, multiplier: 4.7 },
    { name: 'Yellow Jack', weight: 15, multiplier: 5.7 },
    { name: 'Leonida Lightning', weight: 11, multiplier: 7.7 },
    { name: 'Vinewood Dream', weight: 8, multiplier: 10.6 }
  ]
};
let db = { settings: DEFAULT_SETTINGS, tickets: {}, races: [], logs: [], nextRaceId: 1 };
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
const money = n => '$' + Number(n).toLocaleString('en-US');
const horseCount = () => db.settings.horses.length;
const horseName = n => (db.settings.horses[n - 1] || {}).name || '?';

// ---------- BİLET KODLARI ----------
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let code;
  do { code = 'A-' + Array.from(crypto.randomBytes(6), b => ALPHABET[b % 32]).join(''); } while (db.tickets[code]);
  return code;
}
function normalizeCode(raw) {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[KA][A-Z0-9]{6}$/.test(c) ? c[0] + '-' + c.slice(1) : '';
}

// ---------- YARIŞ MOTORU ----------
const TICK_MS = 200, RESULT_HOLD_MS = 20000;
let race = null, raceTimer = null, paused = false;

function newRace() {
  race = { id: db.nextRaceId, phase: 'betting', startsAt: null, positions: Array(horseCount()).fill(0), order: null, times: null };
  scheduleStart();
  broadcastRace();
}
function scheduleStart() {
  race.startsAt = db.settings.autoRace && !paused ? Date.now() + db.settings.raceIntervalSec * 1000 : null;
}
function publicRace() {
  const s = db.settings, last = db.races[db.races.length - 1];
  return {
    id: race.id, phase: race.phase, startsAt: race.startsAt, now: Date.now(), tickMs: TICK_MS,
    siteName: s.siteName, intervalSec: s.raceIntervalSec, cutoffSec: s.betCutoffSec,
    positions: race.positions, order: race.order, times: race.times,
    horses: s.horses.map((h, i) => ({ n: i + 1, name: h.name, multiplier: h.multiplier })),
    last: last ? { id: last.id, winner: last.winner, winnerName: last.winnerName } : null
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
  return order; // order[0] = kazanan atın indeksi
}

function startRace() {
  if (race.phase !== 'betting') return;
  race.phase = 'running';
  race.startsAt = null;
  const N = horseCount(), order = pickOrder();
  const base = Math.max(50, Math.round(db.settings.raceDurationSec * 1000 / TICK_MS));
  const fin = [];
  let t = base;
  order.forEach(h => { fin[h] = t; t += 1 + Math.floor(Math.random() * 3); });
  const wob = fin.map(() => ({ a: 3 + Math.random() * 4, f: (0.5 + Math.random() * 0.9) * TICK_MS / 1000, p: Math.random() * 6.3 }));
  let tick = 0;
  log('race_start', `Yarış #${race.id} başladı (${N} at)`, { raceId: race.id });
  broadcastRace();
  raceTimer = setInterval(() => {
    tick++;
    for (let h = 0; h < N; h++) {
      const T = fin[h];
      const wave = wob[h].a * Math.sin(tick * wob[h].f + wob[h].p) * (1 - tick / T) * Math.min(1, tick / 25);
      const p = tick >= T ? 100 : Math.min(99, (tick / T) * 100 + wave);
      race.positions[h] = Math.max(race.positions[h], +p.toFixed(2));
    }
    io.emit('race:tick', { p: race.positions, t: tick * TICK_MS });
    if (race.positions.every(p => p >= 100)) { clearInterval(raceTimer); finishRace(order, fin); }
  }, TICK_MS);
}

function finishRace(order, fin) {
  race.phase = 'results';
  race.order = order;
  race.times = order.map(h => fin[h] * TICK_MS);
  const winner = order[0] + 1;
  const rec = { id: race.id, t: Date.now(), winner, winnerName: horseName(winner), order: order.map(i => i + 1), times: race.times, bets: 0, wins: 0, stake: 0, payout: 0 };
  log('race_finish', `Yarış #${race.id} bitti. Kazanan: ${winner}. ${rec.winnerName}`, { raceId: race.id, winner });

  for (const tk of Object.values(db.tickets)) {
    if (tk.type !== 'A' || tk.status !== 'active' || tk.raceId !== race.id || !tk.horse) continue;
    const who = tk.redeemedBy || tk.owner;
    rec.bets++; rec.stake += tk.price;
    if (tk.horse === winner) {
      tk.status = 'won'; tk.payout = Math.round(tk.price * tk.multiplier);
      rec.wins++; rec.payout += tk.payout;
      log('ticket_won', `${who} KAZANDI: ${tk.code} (${tk.horse}. ${horseName(tk.horse)}, ${money(tk.price)} x${tk.multiplier}) → ${money(tk.payout)}`, { code: tk.code, who, amount: tk.payout, raceId: race.id });
    } else {
      tk.status = 'lost'; tk.payout = 0;
      log('ticket_lost', `${who} kaybetti: ${tk.code} (${tk.horse}. ${horseName(tk.horse)}, ${money(tk.price)})`, { code: tk.code, who, raceId: race.id });
    }
    tk.resolvedAt = Date.now();
    io.to('t:' + tk.code).emit('ticket', publicTicket(tk));
  }
  db.races.push(rec);
  if (db.races.length > 300) db.races.shift();
  db.nextRaceId = race.id + 1;
  save();
  broadcastRace();
  setTimeout(newRace, RESULT_HOLD_MS);
}

setInterval(() => {
  if (race && race.phase === 'betting' && race.startsAt && Date.now() >= race.startsAt) startRace();
}, 500);

// Bahis kapanışına kalan süre yetmiyorsa bilet bir sonraki yarışa yazılır
function upcomingRaceId() {
  const closed = race.phase !== 'betting' || (race.startsAt && race.startsAt - Date.now() < db.settings.betCutoffSec * 1000);
  return closed ? race.id + 1 : race.id;
}

// ---------- BİLET YARDIMCILARI ----------
function publicTicket(tk) {
  const r = tk.raceId && db.races.find(x => x.id === tk.raceId);
  const resolved = ['won', 'lost', 'paid'].includes(tk.status);
  return {
    code: tk.code, owner: tk.owner, price: tk.price, horse: tk.horse, horseName: tk.horse ? horseName(tk.horse) : null,
    status: tk.status, payout: tk.payout || 0, raceId: tk.raceId || null, multiplier: tk.multiplier || null,
    paidAt: tk.paidAt || null, winner: resolved && r ? { n: r.winner, name: r.winnerName } : null
  };
}
function registerRace(tk) {
  tk.raceId = upcomingRaceId();
  tk.multiplier = db.settings.horses[tk.horse - 1].multiplier;
  const who = tk.redeemedBy || tk.owner;
  log('horse_bet', `${who} → ${tk.horse}. ${horseName(tk.horse)} (${money(tk.price)}, x${tk.multiplier}) Yarış #${tk.raceId}`, { code: tk.code, who, raceId: tk.raceId });
}

// ---------- OYUNCU SOKETİ ----------
io.on('connection', socket => {
  let strikes = 0, lockedUntil = 0;
  const ip = socket.handshake.address;
  socket.emit('race', publicRace());

  // Kod doğrulama: hatalı denemeleri sayar, 5 hatada 30 sn kilitler
  function getTicket(req, ack) {
    if (typeof ack !== 'function') return null;
    if (Date.now() < lockedUntil) { ack({ ok: false, reason: 'locked', secs: Math.ceil((lockedUntil - Date.now()) / 1000) }); return null; }
    const code = normalizeCode(req && req.code);
    const name = String((req && req.name) || '').trim().slice(0, 40);
    const tk = code && db.tickets[code];
    if (!tk) {
      strikes++;
      log('invalid_code', `Geçersiz kod denemesi: "${String(req && req.code).slice(0, 20)}" (${name || 'isimsiz'})`, { ip, who: name });
      if (strikes >= 5) { lockedUntil = Date.now() + 30000; strikes = 0; ack({ ok: false, reason: 'locked', secs: 30 }); }
      else ack({ ok: false, reason: 'invalid', strikes });
      return null;
    }
    strikes = 0;
    if (tk.type !== 'A' || tk.status === 'void') { ack({ ok: false, reason: 'void' }); return null; }
    if (db.settings.strictOwner && tk.owner && name && name.toLowerCase() !== tk.owner.toLowerCase()) {
      log('owner_mismatch', `Sahiplik uyuşmazlığı: ${code} ${tk.owner} adına, ${name} sundu`, { code, who: name, ip });
      ack({ ok: false, reason: 'owner' });
      return null;
    }
    return { tk, name };
  }

  socket.on('redeem', (req, ack) => {
    const r = getTicket(req, ack);
    if (!r) return;
    const { tk, name } = r;
    if (tk.status === 'issued') {
      tk.redeemedBy = name || tk.owner || 'Bilinmiyor';
      tk.redeemedAt = Date.now();
      tk.status = 'active';
      log('ticket_redeemed', `${tk.redeemedBy} bileti okuttu: ${tk.code} (${money(tk.price)})`, { code: tk.code, who: tk.redeemedBy, ip });
      if (tk.horse) registerRace(tk);
    }
    socket.join('t:' + tk.code);
    save();
    ack({ ok: true, ticket: publicTicket(tk), pickHorse: tk.status === 'active' && !tk.horse });
  });

  socket.on('pickHorse', (req, ack) => {
    const tk = db.tickets[normalizeCode(req && req.code)];
    const n = parseInt(req && req.horse, 10);
    if (!tk || tk.type !== 'A' || tk.status !== 'active' || tk.horse || !(n >= 1 && n <= horseCount()) || typeof ack !== 'function') return;
    tk.horse = n;
    registerRace(tk);
    save();
    ack({ ok: true, ticket: publicTicket(tk) });
  });

  // Ödeme ekranı: durumu değiştirmeden bilet sonucunu gösterir
  socket.on('lookup', (req, ack) => {
    const r = getTicket(req, ack);
    if (!r) return;
    socket.join('t:' + r.tk.code);
    ack({ ok: true, ticket: publicTicket(r.tk) });
  });
});

// ---------- ADMİN API ----------
const tokens = new Set();
const failLog = {};
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
function auth(req, res, next) {
  if (tokens.has(req.get('x-admin-token'))) return next();
  res.status(401).json({ error: 'Yetkisiz' });
}
adminIo.use((s, next) => (tokens.has(s.handshake.auth && s.handshake.auth.token) ? next() : next(new Error('auth'))));

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
  const all = Object.values(db.tickets).filter(t => t.type === 'A' && t.status !== 'void');
  const sum = (arr, f) => arr.reduce((a, t) => a + f(t), 0);
  const by = st => all.filter(t => st.includes(t.status));
  res.json({
    settings: db.settings, race: publicRace(), paused,
    stats: {
      sold: all.length, revenue: sum(all, t => t.price),
      paid: sum(by(['paid']), t => t.payout), pending: sum(by(['won']), t => t.payout), pendingCount: by(['won']).length,
      won: by(['won', 'paid']).length, lost: by(['lost']).length, active: by(['active']).length, unplayed: by(['issued']).length
    },
    races: db.races.slice(-20).reverse()
  });
});

app.get('/api/admin/tickets', auth, (req, res) => {
  const { status, q } = req.query;
  let list = Object.values(db.tickets).filter(t => t.type === 'A');
  if (status) list = list.filter(t => status.split(',').includes(t.status));
  if (q) { const s = String(q).toLowerCase(); list = list.filter(t => (t.code + ' ' + t.owner + ' ' + (t.redeemedBy || '')).toLowerCase().includes(s)); }
  res.json(list.sort((a, b) => b.createdAt - a.createdAt).slice(0, 300));
});

app.post('/api/admin/tickets', auth, (req, res) => {
  const b = req.body;
  const qty = Math.min(Math.max(parseInt(b.quantity, 10) || 1, 1), 50);
  const price = Math.min(Math.max(1, Math.round(+b.price || db.settings.defaultHorseStake)), 10000000);
  const horse = +b.horse >= 1 && +b.horse <= horseCount() ? +b.horse : null;
  const owner = String(b.owner || '').trim().slice(0, 40);
  const created = [];
  for (let i = 0; i < qty; i++) {
    const code = newCode();
    db.tickets[code] = { code, type: 'A', owner, price, horse, status: 'issued', createdAt: Date.now() };
    created.push(code);
  }
  log('ticket_created', `${qty}x bahis bileti oluşturuldu (${money(price)}${horse ? ', ' + horse + '. ' + horseName(horse) : ''}${owner ? ', ' + owner : ''}): ${created.join(', ')}`, { who: owner });
  res.json({ created: created.map(c => ({ code: c, price, owner, horse })) });
});

function ticketAction(action, from) {
  app.post(`/api/admin/tickets/:code/${action}`, auth, (req, res) => {
    const tk = db.tickets[req.params.code];
    if (!tk) return res.status(404).json({ error: 'Bilet yok' });
    if (!from.includes(tk.status)) return res.status(400).json({ error: `Bu durumda yapılamaz (${tk.status})` });
    if (action === 'pay') {
      tk.status = 'paid'; tk.paidAt = Date.now();
      log('ticket_paid', `ÖDENDİ: ${tk.code} → ${tk.redeemedBy || tk.owner}, ${money(tk.payout)}`, { code: tk.code, who: tk.redeemedBy || tk.owner, amount: tk.payout });
    } else {
      tk.status = 'void';
      log('ticket_void', `İPTAL: ${tk.code} (${tk.owner || 'sahipsiz'})`, { code: tk.code });
    }
    io.to('t:' + tk.code).emit('ticket', publicTicket(tk));
    res.json({ ok: true });
  });
}
ticketAction('pay', ['won']);
ticketAction('void', ['issued', 'active']);

// Bir yarışa yazılan tüm bahisler ve sonuçları (canlı yarış için id = mevcut yarış)
app.get('/api/admin/races/:id', auth, (req, res) => {
  const id = +req.params.id;
  const rec = db.races.find(r => r.id === id) || null;
  const tickets = Object.values(db.tickets).filter(t => t.type === 'A' && t.raceId === id && t.horse && t.status !== 'void')
    .sort((a, b) => (a.redeemedAt || 0) - (b.redeemedAt || 0));
  res.json({ race: rec, live: race.id === id, tickets });
});

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
  const b = req.body, s = db.settings, num = (v, d, min, max = 1e9) => Math.min(max, Math.max(min, Number.isFinite(+v) ? +v : d));
  s.siteName = String(b.siteName || s.siteName).trim().slice(0, 40);
  s.raceIntervalSec = num(b.raceIntervalSec, s.raceIntervalSec, 20);
  s.betCutoffSec = num(b.betCutoffSec, s.betCutoffSec, 0);
  s.raceDurationSec = num(b.raceDurationSec, s.raceDurationSec, 20, 180);
  s.autoRace = !!b.autoRace; s.strictOwner = !!b.strictOwner;
  s.defaultHorseStake = num(b.defaultHorseStake, s.defaultHorseStake, 1);
  if (Array.isArray(b.horses) && b.horses.length === s.horses.length) {
    s.horses = b.horses.map((h, i) => ({ name: String(h.name || s.horses[i].name).slice(0, 30), weight: num(h.weight, 1, 0.01), multiplier: num(h.multiplier, 2, 1) }));
  }
  if (race.phase === 'betting') scheduleStart();
  log('settings', 'Ayarlar güncellendi');
  broadcastRace();
  res.json({ ok: true });
});

newRace();
server.listen(PORT, () => {
  console.log(`${db.settings.siteName} http://localhost:${PORT}  |  Admin: /admin.html`);
  if (ADMIN_PASSWORD === 'changeme') console.log('UYARI: Varsayılan admin şifresi! ADMIN_PASSWORD ortam değişkenini ayarla.');
});
