const socket = io();
const $ = id => document.getElementById(id);
const money = n => '$' + Number(n).toLocaleString('en-US');
const fmtTime = ms => { const s = ms / 1000; return String(Math.floor(s / 60)).padStart(2, '0') + ':' + (s % 60).toFixed(1).padStart(4, '0'); };
const mmss = sec => String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

// Jokey renkleri ve at tüyü renkleri
const SILKS = [
  { coat: '#6b3f1d', dark: '#3d2210', silk: '#d33a2c', cap: '#ffffff' },
  { coat: '#262321', dark: '#100e0d', silk: '#2f6fd1', cap: '#ffd23f' },
  { coat: '#b5651d', dark: '#7a4210', silk: '#f2c230', cap: '#222222' },
  { coat: '#a3a8ad', dark: '#6d7378', silk: '#2f9e55', cap: '#ffffff' },
  { coat: '#d9b27a', dark: '#9c7a47', silk: '#8e44c9', cap: '#ffffff' },
  { coat: '#4a2a18', dark: '#27150b', silk: '#f07f2c', cap: '#222222' }
];
const silk = i => SILKS[i % SILKS.length];
const chip = n => { const c = el('span', 'chip', n); c.style.background = silk(n - 1).silk; c.style.color = ['#ffffff', '#ffd23f'].includes(silk(n - 1).cap) && silk(n - 1).silk !== '#f2c230' ? '#fff' : '#111'; return c; };

let race = null, offset = 0, view = 'menu', myTicket = null, myCreds = null;
let disp = [], target = [], extra = [], gallop = [];
let lastTickT = 0, tickAt = 0, said = {}, lastLead = -1, lastLeadSay = 0;

// ---------- EKRANLAR ----------
function show(v) {
  view = v;
  ['menu', 'race', 'pay'].forEach(id => $(id).classList.toggle('hidden', id !== v));
  closeOverlays();
  window.scrollTo(0, 0);
}
function closeOverlays() { $('rules').classList.add('hidden'); }
document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (!go) return;
  const t = go.dataset.go;
  if (t === 'rules') openRules();
  else if (t === 'back') closeOverlays();
  else show(t);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlays(); });

function openRules() {
  $('rules').classList.remove('hidden');
  if (!race) return;
  $('rulesRace').textContent = `Yarışlar yaklaşık ${Math.round(race.intervalSec / 60 * 10) / 10} dakikada bir koşulur. Başlamasına ${race.cutoffSec} saniye kala bahisler kapanır; geç kalan bilet sıradaki yarışa yazılır. Kazanç = bahis x çarpan. Atların kazanma şansı eşit değildir: çarpanı yüksek atın kazanma ihtimali daha düşüktür.`;
  const t = $('oddsTable'); t.innerHTML = '';
  race.horses.forEach(h => { const tr = t.insertRow(); tr.insertCell().textContent = h.n + '. ' + h.name; tr.insertCell().textContent = 'x' + h.multiplier; });
}

// ---------- SUNUCUDAN YARIŞ DURUMU ----------
function fit(n) { for (const a of [disp, target, extra, gallop]) { while (a.length < n) a.push(0); a.length = n; } }

socket.on('race', r => {
  const prev = race;
  race = r; offset = r.now - Date.now();
  fit(r.horses.length);
  document.querySelectorAll('.site-name').forEach(e => e.textContent = r.siteName.toUpperCase());
  document.title = r.siteName;
  buildTote();
  if (!prev || prev.id !== r.id) newRaceReset(!prev);
  if (r.phase === 'betting') { target.fill(0); disp.fill(0); extra.fill(0); }
  if (!prev && r.phase !== 'betting') { r.positions.forEach((p, i) => { target[i] = disp[i] = p / 100; }); if (r.phase === 'results') extra.fill(0.07); }
  if (r.phase === 'running' && (!prev || prev.phase !== 'running')) { if (prev) onRaceStart(); else announce('Yarış sürüyor.'); }
  if (r.phase === 'results' && (!prev || prev.phase !== 'results')) onRaceEnd(!!prev);
  updateClock();
});
socket.on('race:tick', d => {
  if (!race) return;
  race.positions = d.p;
  d.p.forEach((p, i) => target[i] = p / 100);
  lastTickT = d.t; tickAt = performance.now();
});
socket.on('connect', () => { if (myCreds) socket.emit('lookup', myCreds, res => { if (res && res.ok) { myTicket = res.ticket; renderMine(); } }); });

function newRaceReset(first) {
  said = {}; lastLead = -1; lastTickT = 0;
  $('results').classList.add('hidden');
  $('banner').classList.add('hidden');
  if (!first) announce('Yeni yarış için bahisler açıldı. Atlar kapılarda.');
}
let bannerTimer;
function flash(text, ms = 2400) {
  const b = $('banner'); b.textContent = text; b.classList.remove('hidden');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
}
function announce(text) { $('tickerText').textContent = text; }

function onRaceStart() { said = {}; lastLead = -1; lastTickT = 0; tickAt = performance.now(); flash('VE BAŞLADILAR!'); announce('Kapılar açıldı, yarış başladı!'); }
function onRaceEnd(live) {
  const r = race, names = r.order.map(i => r.horses[i].name);
  const photo = r.times[1] - r.times[0] <= r.tickMs;
  announce(`${photo ? 'Foto finiş! ' : ''}Birinci ${names[0]}, ikinci ${names[1]}${names[2] ? ', üçüncü ' + names[2] : ''}.`);
  if (live) flash(photo ? 'FOTO FİNİŞ' : 'RESMİ SONUÇ', 3200);
  $('resTitle').textContent = `YARIŞ #${r.id} RESMİ SONUÇ` + (photo ? ' (FOTO FİNİŞ)' : '');
  const t = $('resTable'); t.innerHTML = '';
  r.order.forEach((idx, k) => {
    const tr = t.insertRow();
    tr.insertCell().textContent = k + 1 + '.';
    const c = tr.insertCell(); c.append(chip(idx + 1), ' ' + r.horses[idx].name);
    tr.insertCell().textContent = k === 0 ? fmtTime(r.times[0]) : '+' + ((r.times[k] - r.times[0]) / 1000).toFixed(1) + ' sn';
    tr.insertCell().textContent = k === 0 ? 'x' + r.horses[idx].multiplier : '';
    if (k === 0) tr.className = 'first';
  });
  $('results').classList.remove('hidden');
}

// ---------- SAAT VE DURUM ----------
function left() { return race && race.startsAt ? Math.max(0, Math.round((race.startsAt - (Date.now() + offset)) / 1000)) : 0; }
function updateClock() {
  if (!race) return;
  const r = race, live = $('liveTag');
  let top, tag, cls, next;
  if (r.phase === 'running') { top = `Yarış #${r.id} koşuluyor`; tag = '● CANLI'; cls = 'live run'; next = 'KOŞULUYOR'; }
  else if (r.phase === 'results') { top = `Yarış #${r.id} bitti`; tag = '● RESMİ SONUÇ'; cls = 'live done'; next = 'SONUÇ AÇIKLANDI'; }
  else if (!r.startsAt) { top = 'Yarışlar durduruldu'; tag = '● DURAKLATILDI'; cls = 'live wait'; next = 'DURAKLATILDI'; }
  else {
    const l = left(), closed = l < r.cutoffSec;
    top = `Yarış #${r.id} — ${mmss(l)}${closed ? ' (bahis kapalı)' : ''}`;
    tag = closed ? '● BAHİSLER KAPANDI' : '● BAHİSLER AÇIK'; cls = 'live ' + (closed ? 'wait' : 'open'); next = `#${r.id} — ${mmss(l)}`;
  }
  $('clock').textContent = top;
  live.textContent = tag; live.className = cls;
  $('raceNo').textContent = `YARIŞ #${r.id}`;
  $('menuNext').textContent = next;
  $('menuLast').textContent = r.last ? `#${r.last.id} — ${r.last.winner}. ${r.last.winnerName}` : 'Henüz yarış yok';
  if (r.phase === 'betting') $('raceClock').textContent = r.startsAt ? mmss(left()) : '--:--';
  if (r.phase === 'results' && r.times) $('raceClock').textContent = fmtTime(r.times[0]);
}
setInterval(updateClock, 250);

// ---------- PROGRAM VE CANLI SIRALAMA ----------
let toteKey = '', liEls = [];
function buildTote() {
  const key = JSON.stringify(race.horses) + (myTicket ? myTicket.horse : '');
  if (key === toteKey) return;
  toteKey = key;
  const t = $('tote'); t.innerHTML = '';
  race.horses.forEach(h => {
    const tr = t.insertRow();
    if (myTicket && myTicket.horse === h.n && myTicket.status === 'active') tr.className = 'mine-row';
    tr.insertCell().append(chip(h.n));
    tr.insertCell().textContent = h.name;
    tr.insertCell().textContent = 'x' + h.multiplier;
  });
  const ol = $('live'); ol.innerHTML = ''; liEls = [];
  race.horses.forEach(h => {
    const li = el('li');
    li.append(el('span', 'pos', '–'), chip(h.n), el('span', 'nm', h.name), el('span', 'gap', ''));
    liEls.push(li); ol.append(li);
  });
}
let lastLive = 0;
function updateLive(now) {
  if (now - lastLive < 150 || !liEls.length) return;
  lastLive = now;
  const n = race.horses.length;
  let idx = [...Array(n).keys()];
  if (race.phase === 'results' && race.order) idx = race.order;
  else if (race.phase === 'running') idx.sort((a, b) => disp[b] - disp[a] || a - b);
  idx.forEach((i, k) => {
    const li = liEls[i];
    li.querySelector('.pos').textContent = race.phase === 'betting' ? '–' : k + 1;
    let gap = 'Kapıda';
    if (race.phase === 'running') gap = k === 0 ? 'LİDER' : ((disp[idx[0]] - disp[i]) * 1000 / 2.4).toFixed(1) + ' boy';
    if (race.phase === 'results' && race.times) gap = k === 0 ? fmtTime(race.times[0]) : '+' + ((race.times[k] - race.times[0]) / 1000).toFixed(1);
    li.querySelector('.gap').textContent = gap;
    li.classList.toggle('lead', race.phase !== 'betting' && k === 0);
    $('live').append(li);
  });
}

// ---------- SPİKER ----------
function commentate(now) {
  if (race.phase !== 'running') return;
  const n = race.horses.length;
  const idx = [...Array(n).keys()].sort((a, b) => disp[b] - disp[a] || a - b);
  const lead = idx[0], sec = idx[1], p = disp[lead], nm = i => race.horses[i].name;
  const gap = (disp[lead] - disp[sec]) * 1000 / 2.4;
  if (lead !== lastLead && p > 0.04 && now - lastLeadSay > 3500) {
    announce(lastLead === -1 ? `${nm(lead)} kapıdan hızlı çıktı ve ilk sırada.` : `${nm(lead)} öne geçti!`);
    lastLead = lead; lastLeadSay = now;
  }
  const say = (key, thr, text) => { if (!said[key] && p >= thr) { said[key] = true; announce(text); } };
  say('a', 0.33, `Geri düzlüğe giriyorlar. ${nm(lead)} önde, ${nm(sec)} hemen arkasında.`);
  say('b', 0.54, `Son virajı dönüyorlar. ${nm(lead)} liderliği koruyor.`);
  say('c', 0.83, gap < 2 ? `Son düzlük! ${nm(lead)} ile ${nm(sec)} burun buruna!` : `Son düzlük! ${nm(lead)} açılıyor, fark ${gap.toFixed(0)} boy.`);
  say('d', 0.95, `Bitiş çizgisine doğru ${nm(lead)} önde!`);
}

// ---------- PİST ÇİZİMİ (kuş bakışı, oval) ----------
const cv = $('track'), cx = cv.getContext('2d');
const dpr = Math.min(2, window.devicePixelRatio || 1);
cv.width = 1000 * dpr; cv.height = 560 * dpr;
const W = 1000, H = 560, CX = 500, CY = 272, L = 340, R0 = 88, LW = 21, START = 70, HORSE_BACK = 22;
const laneR = i => R0 + LW * (i + 0.5);
const perim = r => 2 * L + 2 * Math.PI * r;

function stadium(c, r) {
  c.beginPath();
  c.moveTo(CX - L / 2, CY + r); c.lineTo(CX + L / 2, CY + r);
  c.arc(CX + L / 2, CY, r, Math.PI / 2, -Math.PI / 2, true);
  c.lineTo(CX - L / 2, CY - r);
  c.arc(CX - L / 2, CY, r, -Math.PI / 2, Math.PI / 2, true);
  c.closePath();
}
function pointAt(d, r) {
  const P = perim(r), arc = Math.PI * r;
  d = ((d % P) + P) % P;
  if (d < START) return { x: CX + L / 2 - START + d, y: CY + r, a: 0 };
  d -= START;
  if (d < arc) { const th = d / r; return { x: CX + L / 2 + r * Math.sin(th), y: CY + r * Math.cos(th), a: -th }; }
  d -= arc;
  if (d < L) return { x: CX + L / 2 - d, y: CY - r, a: Math.PI };
  d -= L;
  if (d < arc) { const th = d / r; return { x: CX - L / 2 - r * Math.sin(th), y: CY - r * Math.cos(th), a: Math.PI - th }; }
  d -= arc;
  return { x: CX - L / 2 + d, y: CY + r, a: 0 };
}
const horseD = (i, prog) => -HORSE_BACK + prog * (perim(laneR(i)) + HORSE_BACK);

let bgCanvas = null, bgN = 0;
function buildBg(N) {
  bgN = N;
  const c = document.createElement('canvas'); c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  g.fillStyle = '#3b7737'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 28) { g.fillStyle = (y / 28) % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; g.fillRect(0, y, W, 28); }
  for (let i = 0; i < 26; i++) { const x = 20 + i * 38 + Math.random() * 14; g.fillStyle = '#1f4a22'; g.beginPath(); g.arc(x, 18 + Math.random() * 10, 15 + Math.random() * 6, 0, 7); g.fill(); }
  const rOut = R0 + N * LW + 4;
  stadium(g, rOut); g.fillStyle = '#a67c4e'; g.fill();
  g.save(); stadium(g, rOut); g.clip();
  for (let i = 0; i < 2200; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,232,190,.08)'; g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 3, 1); }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 1; g.setLineDash([6, 9]);
  for (let i = 1; i < N; i++) { stadium(g, R0 + i * LW); g.stroke(); }
  g.setLineDash([]);
  stadium(g, R0); g.fillStyle = '#4a8c43'; g.fill();
  g.fillStyle = '#2f6f93'; g.beginPath(); g.ellipse(CX - 125, CY + 24, 52, 20, 0, 0, 7); g.fill();
  g.strokeStyle = '#d3e6ef'; g.lineWidth = 2; g.stroke();
  [[CX + 135, CY - 30], [CX + 160, CY + 20], [CX + 110, CY + 38], [CX - 190, CY - 25]].forEach(([x, y]) => { g.fillStyle = '#2d6a2e'; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); g.fillStyle = '#3e8a3c'; g.beginPath(); g.arc(x - 3, y - 3, 6, 0, 7); g.fill(); });
  g.lineWidth = 3; g.strokeStyle = '#f2f0e6'; stadium(g, R0); g.stroke(); stadium(g, rOut); g.stroke();
  // çeyrek mesafe direkleri
  [0.25, 0.5, 0.75].forEach(p => { const q = pointAt(p * perim(R0 - 8), R0 - 8); g.fillStyle = '#c0392b'; g.fillRect(q.x - 2, q.y - 6, 4, 12); g.fillStyle = '#fff'; g.fillRect(q.x - 2, q.y - 1, 4, 4); });
  // tribün
  const gy = CY + rOut + 26;
  g.fillStyle = '#4b463c'; g.fillRect(50, gy, 900, H - gy);
  g.fillStyle = '#8a3a2d'; g.fillRect(50, gy, 900, 7);
  for (let r = 0; r < 4; r++) { g.fillStyle = r % 2 ? '#5f594d' : '#6c665a'; g.fillRect(50, gy + 9 + r * 11, 900, 9); }
  for (let x = 56; x < 944; x += 6) for (let r = 0; r < 4; r++) if (Math.random() < 0.8) { g.fillStyle = ['#d9534f', '#f0ad4e', '#5bc0de', '#e8e8e8', '#7a5c3a', '#3a6ea5'][Math.floor(Math.random() * 6)]; g.beginPath(); g.arc(x + Math.random() * 3, gy + 15 + r * 11, 2.4, 0, 7); g.fill(); }
  // bitiş çizgisi
  const x0 = CX + L / 2 - START, y0 = CY + R0, h = N * LW;
  for (let j = 0; j * 6 < h; j++) for (let k = 0; k < 2; k++) { g.fillStyle = (j + k) % 2 ? '#111' : '#fff'; g.fillRect(x0 - 6 + k * 6, y0 + j * 6, 6, Math.min(6, h - j * 6)); }
  g.fillStyle = '#b3261e'; g.fillRect(x0 - 24, CY + rOut + 6, 48, 14);
  g.fillStyle = '#fff'; g.font = 'bold 10px Arial'; g.textAlign = 'center'; g.fillText('FİNİŞ', x0, CY + rOut + 17);
  bgCanvas = c;
}

function drawHorse(c, x, y, ang, i, ph, rest) {
  const s = silk(i);
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(1, 3, 15, 6.5, 0, 0, 7); c.fill();
  c.strokeStyle = s.dark; c.lineWidth = 2.2; c.lineCap = 'round';
  const A = rest ? 0.5 : 5;
  [[9, -3.4, 0], [9, 3.4, 2.4], [-9, -3.4, Math.PI], [-9, 3.4, Math.PI + 2.4]].forEach(([lx, ly, off]) => {
    c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + Math.sin(ph + off) * A, ly + (ly < 0 ? -2 : 2)); c.stroke();
  });
  c.strokeStyle = '#241a14'; c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(-12, 0); c.quadraticCurveTo(-18, Math.sin(ph * 0.7) * 2.5, -22, Math.sin(ph * 0.7 + 1) * 3.5); c.stroke();
  c.fillStyle = s.coat; c.beginPath(); c.ellipse(0, 0, 13, 5.4, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(13, 0, 5, 3.2, 0, 0, 7); c.fill();
  c.fillStyle = s.dark; c.beginPath(); c.ellipse(19, Math.sin(ph * 1.4) * (rest ? 0.3 : 1.1), 4.6, 2.6, 0, 0, 7); c.fill();
  c.fillStyle = s.silk; c.fillRect(-3, -4.6, 7, 9.2);
  c.beginPath(); c.ellipse(0.5, 0, 4.2, 3.8, 0, 0, 7); c.fill();
  c.strokeStyle = '#3b2a20'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(3, -3); c.lineTo(8, -2); c.moveTo(3, 3); c.lineTo(8, 2); c.stroke();
  c.fillStyle = s.cap; c.beginPath(); c.arc(4.5, 0, 2.6, 0, 7); c.fill();
  c.restore();
}

const dust = [];
let lastFrame = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (view !== 'race' || !race) { lastFrame = now; return; }
  const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000); lastFrame = now;
  const N = race.horses.length;
  if (!bgCanvas || bgN !== N) buildBg(N);
  const k = 1 - Math.exp(-dt * 9), running = race.phase === 'running';

  for (let i = 0; i < N; i++) {
    if (race.phase === 'betting') { disp[i] = 0; extra[i] = 0; }
    else {
      disp[i] += (target[i] - disp[i]) * k;
      if (target[i] >= 1 && disp[i] > 0.995) extra[i] += (0.07 - extra[i]) * (1 - Math.exp(-dt * 1.6));
    }
    const moving = running && target[i] < 1, cooling = race.phase !== 'betting' && target[i] >= 1 && extra[i] < 0.066;
    gallop[i] += dt * (moving ? 15 : cooling ? 3 + 9 * (1 - extra[i] / 0.07) : 1.2);
  }

  const c = cx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.drawImage(bgCanvas, 0, 0, W, H);

  const pos = [...Array(N).keys()].map(i => ({ i, ...pointAt(horseD(i, disp[i] + extra[i]), laneR(i)) }));

  if (race.phase === 'betting') {
    c.strokeStyle = '#d6d6d6'; c.lineWidth = 2;
    for (let i = 0; i < N; i++) {
      const p = pointAt(horseD(i, 0), laneR(i));
      c.strokeRect(p.x - 27, p.y - LW / 2 + 1, 30, LW - 2);
      c.beginPath(); c.moveTo(p.x + 3, p.y - LW / 2 + 1); c.lineTo(p.x + 3, p.y + LW / 2 - 1); c.stroke();
    }
  }

  for (let i = 0; i < N; i++) if (running && target[i] < 1 && Math.random() < 0.6) {
    const p = pointAt(horseD(i, disp[i]) - 20, laneR(i));
    dust.push({ x: p.x, y: p.y + (Math.random() - 0.5) * 6, vx: -Math.cos(p.a) * 16 + (Math.random() - 0.5) * 10, vy: -Math.sin(p.a) * 16 + (Math.random() - 0.5) * 10, a: 0.45, r: 2 });
  }
  for (let j = dust.length - 1; j >= 0; j--) {
    const d = dust[j]; d.x += d.vx * dt; d.y += d.vy * dt; d.a -= dt * 1.0; d.r += dt * 6;
    if (d.a <= 0) { dust.splice(j, 1); continue; }
    c.fillStyle = `rgba(196,160,112,${d.a})`; c.beginPath(); c.arc(d.x, d.y, d.r, 0, 7); c.fill();
  }

  const lead = disp.indexOf(Math.max(...disp.slice(0, N)));
  [...pos].sort((a, b) => a.y - b.y).forEach(p => drawHorse(c, p.x, p.y, p.a, p.i, gallop[p.i], !running && !(race.phase === 'results' && extra[p.i] < 0.066)));
  pos.forEach(p => {
    const ty = p.y - 19, s = silk(p.i);
    c.fillStyle = (race.phase === 'running' && p.i === lead && disp[lead] > 0.03) ? '#ffd23f' : 'rgba(0,0,0,.6)';
    c.beginPath(); c.arc(p.x, ty, 8.2, 0, 7); c.fill();
    c.fillStyle = s.silk; c.beginPath(); c.arc(p.x, ty, 6.6, 0, 7); c.fill();
    c.fillStyle = s.silk === '#f2c230' ? '#111' : '#fff'; c.font = 'bold 10px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.i + 1, p.x, ty + 0.5);
  });

  // iç saha skor tabelası
  c.fillStyle = 'rgba(10,12,10,.82)'; c.fillRect(CX - 105, CY - 36, 210, 72);
  c.strokeStyle = '#f2f0e6'; c.lineWidth = 2; c.strokeRect(CX - 105, CY - 36, 210, 72);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.font = '18px VT323, monospace'; c.fillStyle = '#ffd23f'; c.fillText(`YARIŞ #${race.id}`, CX, CY - 15);
  c.fillStyle = '#e8f5e0';
  let line2 = race.phase === 'betting' ? (race.startsAt ? 'Başlamasına ' + mmss(left()) : 'Duraklatıldı') : race.phase === 'running' ? 'CANLI' : 'Sonuç';
  c.fillText(line2, CX, CY + 5);
  const names = race.phase === 'results' && race.order ? race.horses[race.order[0]].name : race.phase === 'running' && disp[lead] > 0.02 ? race.horses[lead].name : '';
  if (names) { c.font = '16px VT323, monospace'; c.fillStyle = '#9fe8a0'; c.fillText('1. ' + names.slice(0, 22), CX, CY + 26); }

  if (running) {
    const ms = lastTickT + Math.min(race.tickMs, performance.now() - tickAt);
    $('raceClock').textContent = lastTickT ? fmtTime(ms) : '--:--';
  }
  updateLive(now);
  if (now - (commentate.t || 0) > 300) { commentate.t = now; commentate(now); }
}
requestAnimationFrame(frame);

// ---------- BAHİS FİŞİ ----------
const slipMsg = t => { $('slipMsg').textContent = t; };
const FAIL = {
  invalid: r => 'Kod sistemde yok.' + (r.strikes >= 3 ? ' Art arda hatalı denemede ekran kilitlenir.' : ''),
  locked: r => `Çok fazla hatalı deneme. ${r.secs} saniye bekle.`,
  void: () => 'Bu bilet geçersiz ya da iptal edilmiş.',
  owner: () => 'Bu bilet başka bir karaktere ait.'
};
$('nameIn').value = localStorage.getItem('ld_name') || '';
$('payName').value = localStorage.getItem('ld_name') || '';

$('slip').addEventListener('submit', e => {
  e.preventDefault();
  const code = $('codeIn').value.trim(), name = $('nameIn').value.trim();
  if (!code) return slipMsg('Bilet kodunu yaz.');
  if (!name) return slipMsg('Karakter adını yaz.');
  localStorage.setItem('ld_name', name);
  $('giveBtn').disabled = true;
  socket.emit('redeem', { code, name }, res => {
    $('giveBtn').disabled = false;
    $('pick').classList.add('hidden');
    if (!res.ok) return slipMsg(FAIL[res.reason](res));
    myTicket = res.ticket; myCreds = { code, name }; $('codeIn').value = '';
    toteKey = ''; buildTote(); renderMine();
    if (res.pickHorse) { openPick(res.ticket); slipMsg('Bahis yapacağın atı seç.'); }
    else if (res.ticket.status === 'active') slipMsg(registered(res.ticket));
    else slipMsg('Bu bilet daha önce kullanılmış. Sonucu "Bahsim" bölümünde ve ödeme ekranında görebilirsin.');
  });
});
const registered = t => `Bahis kaydedildi: ${t.horse}. ${t.horseName}, ${money(t.price)}, çarpan x${t.multiplier}. Yarış #${t.raceId}.` + (race && t.raceId > race.id ? ' Bu yarışın bahisleri kapalı, bilet sıradaki yarışa yazıldı.' : '');

function openPick(t) {
  const box = $('pick'); box.innerHTML = '';
  race.horses.forEach(h => {
    const b = el('button'); b.type = 'button';
    b.append(chip(h.n), ` ${h.name} — x${h.multiplier}`);
    b.onclick = () => socket.emit('pickHorse', { code: t.code, horse: h.n }, res => {
      if (!res || !res.ok) return;
      myTicket = res.ticket; box.classList.add('hidden');
      toteKey = ''; buildTote(); renderMine(); slipMsg(registered(res.ticket));
    });
    box.append(b);
  });
  box.classList.remove('hidden');
}

const STATUS_TXT = { issued: 'Oynanmadı', active: 'Yarış bekleniyor', won: 'KAZANDIN — ödeme bekliyor', lost: 'Kaybettin', paid: 'Kazanç ödendi', void: 'İptal' };
function lines(t, host) {
  const add = (k, v) => { const p = el('p'); p.append(el('b', '', k + ' '), v); host.append(p); };
  add('Kod:', t.code);
  if (t.horse) add('At:', `${t.horse}. ${t.horseName}`);
  add('Bahis:', money(t.price) + (t.multiplier ? ` (x${t.multiplier})` : ''));
  if (t.raceId) add('Yarış:', '#' + t.raceId);
  if (t.winner) add('Kazanan at:', `${t.winner.n}. ${t.winner.name}`);
  add('Durum:', STATUS_TXT[t.status] || t.status);
  if (t.status === 'won' || t.status === 'paid') add('Kazanç:', money(t.payout));
}
function renderMine() {
  const t = myTicket;
  $('mine').classList.toggle('hidden', !t);
  if (!t) return;
  const b = $('mineBody'); b.innerHTML = ''; lines(t, b);
  $('mineToPay').classList.toggle('hidden', !['won', 'paid', 'lost'].includes(t.status));
}
$('mineToPay').onclick = () => { if (!myCreds) return; show('pay'); $('payCode').value = myCreds.code; $('payName').value = myCreds.name; lookup(); };

socket.on('ticket', t => {
  if (myTicket && t.code === myTicket.code) {
    myTicket = t; toteKey = ''; if (race) buildTote(); renderMine();
    if (t.status === 'won') slipMsg(`Kazandın! ${money(t.payout)} kazanç. Ödeme ekranından fişini aç ve yetkiliye göster.`);
    if (t.status === 'lost') slipMsg('Bu yarışı kaybettin.');
    if (t.status === 'paid') slipMsg('Kazancın ödendi.');
  }
  if (payTicket && t.code === payTicket.code) { payTicket = t; renderPayDoc(t); }
});

// ---------- ÖDEME EKRANI ----------
let payTicket = null;
const payMsg = t => { $('payMsg').textContent = t; };
function lookup() {
  const code = $('payCode').value.trim(), name = $('payName').value.trim();
  if (!code) return payMsg('Bilet kodunu yaz.');
  localStorage.setItem('ld_name', name);
  $('payBtn').disabled = true;
  socket.emit('lookup', { code, name }, res => {
    $('payBtn').disabled = false;
    if (!res.ok) { payMsg(FAIL[res.reason](res)); $('payDoc').classList.add('hidden'); payTicket = null; return; }
    payMsg(''); payTicket = res.ticket; myCreds = { code, name }; renderPayDoc(res.ticket);
  });
}
$('payForm').addEventListener('submit', e => { e.preventDefault(); lookup(); });

function renderPayDoc(t) {
  const body = $('payBody'); body.innerHTML = '';
  body.append(el('h2', '', 'ÖDEME FİŞİ'));
  lines(t, body);
  if (t.status === 'won') body.append(el('p', 'note', 'Bu fişi yetkiliye göster. Ödeme yapılınca durum "ödendi" olur.'));
  if (t.status === 'issued') body.append(el('p', 'note', 'Bu bilet henüz oynanmadı. Yarış ekranından bahsini kaydet.'));
  if (t.status === 'active') body.append(el('p', 'note', 'Yarış bitince sonuç bu ekranda kendiliğinden güncellenir.'));
  const map = { issued: ['OYNANMADI', 'wait'], active: ['YARIŞ BEKLİYOR', 'wait'], won: ['ÖDEME BEKLİYOR', 'ok'], paid: ['ÖDENDİ', 'ok'], lost: ['KAYBETTİ', 'deny'], void: ['İPTAL', 'deny'] };
  const [txt, cls] = map[t.status] || ['', ''];
  const st = $('payStamp'); st.textContent = txt; st.className = 'stamp ' + cls;
  $('payDoc').classList.remove('hidden');
  void st.offsetWidth; st.classList.add('slam');
}

// ---------- CRT GÖRÜNÜMÜ ----------
function applyCrt(on) {
  document.body.classList.toggle('crt-on', on);
  $('crtToggle').textContent = 'CRT efekti: ' + (on ? 'açık' : 'kapalı');
}
$('crtToggle').onclick = () => { const on = !document.body.classList.contains('crt-on'); localStorage.setItem('ld_crt', on ? 'on' : 'off'); applyCrt(on); };
applyCrt(localStorage.getItem('ld_crt') !== 'off');
if (document.body.classList.contains('crt-on')) { document.body.classList.add('power-on'); setTimeout(() => document.body.classList.remove('power-on'), 1000); }
