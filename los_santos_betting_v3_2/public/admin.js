const $ = id => document.getElementById(id);
const money = n => '$' + Number(n || 0).toLocaleString('en-US');
const fmtT = t => new Date(t).toLocaleString('tr-TR', { hour12: false });
const STATUS = { issued: 'Verildi', active: 'Oynanıyor', won: 'Kazandı (ödenmedi)', lost: 'Kaybetti', paid: 'Ödendi', void: 'İptal' };
let token = sessionStorage.getItem('ld_admin') || '', state = null, adminSocket = null, refreshTimer;

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && url !== '/api/admin/login') { logout(); throw new Error('Oturum bitti'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Hata');
  return data;
}
function logout() { sessionStorage.removeItem('ld_admin'); token = ''; location.reload(); }

// ---------- GİRİŞ ----------
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const r = await api('POST', '/api/admin/login', { password: $('pw').value });
    token = r.token; sessionStorage.setItem('ld_admin', token);
    $('warn').classList.toggle('hidden', !r.defaultPassword);
    start();
  } catch (err) { $('loginErr').textContent = err.message; }
});

function cell(tr, text, cls) { const td = tr.insertCell(); td.textContent = text; if (cls) td.className = cls; return td; }
function table(host, heads, rows) {
  host.innerHTML = '';
  if (!rows.length) { host.textContent = 'Kayıt yok.'; host.className = 'tbl muted'; return; }
  host.className = 'tbl';
  const t = document.createElement('table');
  const hr = t.createTHead().insertRow();
  heads.forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.append(th); });
  const tb = t.createTBody();
  rows.forEach(r => { const tr = tb.insertRow(); r(tr); });
  host.append(t);
}
function btn(td, label, fn, cls) { const b = document.createElement('button'); b.textContent = label; b.className = 'mini ' + (cls || ''); b.onclick = fn; td.append(b); }
function copy(text, el) { navigator.clipboard.writeText(text).then(() => { if (el) { const o = el.textContent; el.textContent = 'Kopyalandı'; setTimeout(() => el.textContent = o, 1200); } }); }

// ---------- BAŞLAT ----------
async function start() {
  $('login').classList.add('hidden'); $('app').classList.remove('hidden');
  adminSocket = io('/admin', { auth: { token } });
  adminSocket.on('log', entry => { if ($('lLive').checked && !$('logs').classList.contains('hidden')) loadLogs(); scheduleRefresh(); });
  adminSocket.on('race', () => scheduleRefresh());
  adminSocket.on('order', () => { beep(); scheduleRefresh(); });
  adminSocket.on('feedback', () => scheduleRefresh());
  await loadState(); loadTickets(); loadLogs();
}
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { loadState(); if (!$('tickets').classList.contains('hidden')) loadTickets(); if (!$('orders').classList.contains('hidden')) loadOrders(); if (!$('feedback').classList.contains('hidden')) loadFeedback(); }, 600);
}

document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('hidden', s.id !== b.dataset.tab));
  if (b.dataset.tab === 'tickets') loadTickets();
  if (b.dataset.tab === 'logs') loadLogs();
  if (b.dataset.tab === 'orders') loadOrders();
  if (b.dataset.tab === 'products') loadProducts();
  if (b.dataset.tab === 'feedback') loadFeedback();
});

// ---------- PANEL ----------
async function loadState() {
  state = await api('GET', '/api/admin/state');
  const s = state.stats, profit = s.revenue - s.paid - s.pending;
  $('stats').innerHTML = '';
  [['Satılan bilet', s.sold], ['Toplam gelir', money(s.revenue)], ['Ödenen', money(s.paid)], ['Ödeme bekleyen', money(s.pending)], ['Net kâr', money(profit)], ['Oynanmayı bekleyen', s.active]].forEach(([k, v]) => {
    const d = document.createElement('div'); d.className = 'stat';
    const a = document.createElement('small'); a.textContent = k;
    const b = document.createElement('b'); b.textContent = v;
    if (k === 'Net kâr') b.className = profit >= 0 ? 'pos' : 'neg';
    d.append(a, b); $('stats').append(d);
  });
  $('fbBadge').textContent = s.newFeedback; $('fbBadge').classList.toggle('hidden', !s.newFeedback);
  $('ordBadge').textContent = s.newOrders; $('ordBadge').classList.toggle('hidden', !s.newOrders);
  const r = state.race;
  let info = `Yarış #${r.id} — ` + ({ betting: 'bahis açık', running: 'koşuluyor', results: 'sonuç ekranı' })[r.phase];
  if (r.phase === 'betting' && r.startsAt) info += `, başlangıç: ${fmtT(r.startsAt)}`;
  if (state.paused) info += ' (otomatik yarış durduruldu)';
  $('raceInfo').textContent = info;
  $('pauseBtn').textContent = state.paused ? 'Otomatik yarışı sürdür' : 'Otomatik yarışı durdur';
  $('runBtn').disabled = r.phase !== 'betting';

  const tk = await api('GET', '/api/admin/tickets?status=won');
  table($('pending'), ['Kod', 'Oyuncu', 'Tür', 'Tutar', ''], tk.map(t => tr => {
    cell(tr, t.code); cell(tr, t.redeemedBy || t.owner || '—'); cell(tr, t.type === 'K' ? 'Kazı kazan' : 'At yarışı'); cell(tr, money(t.payout), 'pos');
    btn(tr.insertCell(), 'Ödendi işaretle', async () => { await api('POST', `/api/admin/tickets/${t.code}/pay`); loadState(); });
  }));
  table($('raceHist'), ['Yarış', 'Zaman', 'Kazanan', 'Sıralama'], state.races.map(x => tr => {
    cell(tr, '#' + x.id); cell(tr, fmtT(x.t)); cell(tr, `${x.winner}. ${x.winnerName}`); cell(tr, x.order.join(' › '));
  }));
  fillSettings();
  fillHorseSelect();
}
$('runBtn').onclick = async () => { try { await api('POST', '/api/admin/race/run'); } catch (e) { alert(e.message); } loadState(); };
$('pauseBtn').onclick = async () => { await api('POST', '/api/admin/race/' + (state.paused ? 'resume' : 'pause')); loadState(); };

// ---------- BİLETLER ----------
function fillHorseSelect() {
  if ($('gHorse').options.length === state.settings.horses.length + 1) return;
  $('gHorse').innerHTML = '<option value="">Oyuncu seçsin</option>';
  state.settings.horses.forEach((h, i) => $('gHorse').add(new Option(`${i + 1}. ${h.name} (x${h.multiplier})`, i + 1)));
}
function syncGenForm() {
  const isA = $('gType').value === 'A';
  $('gHorseWrap').classList.toggle('hidden', !isA);
  if (state) $('gPrice').placeholder = isA ? state.settings.defaultHorseStake : state.settings.defaultScratchPrice;
}
$('gType').onchange = syncGenForm;

$('genForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = { type: $('gType').value, owner: $('gOwner').value, price: $('gPrice').value, horse: $('gHorse').value, quantity: $('gQty').value };
  const r = await api('POST', '/api/admin/tickets', body);
  const out = $('genOut');
  out.innerHTML = '';
  const lines = r.created.map(c => `${c.type === 'K' ? 'Davis Lotto Kazı Kazan' : 'Inside Track At Bileti' + (c.horse ? ' (At ' + c.horse + ')' : '')} | Kod: ${c.code} | ${money(c.price)}${c.owner ? ' | ' + c.owner : ''}`);
  lines.forEach((l, i) => {
    const d = document.createElement('div'); d.className = 'code';
    const s = document.createElement('code'); s.textContent = r.created[i].code;
    const x = document.createElement('span'); x.textContent = l;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mini'; b.textContent = 'Kopyala'; b.onclick = () => copy(l, b);
    d.append(s, x, b); out.append(d);
  });
  if (lines.length > 1) { const b = document.createElement('button'); b.type = 'button'; b.className = 'mini'; b.textContent = 'Hepsini kopyala'; b.onclick = () => copy(lines.join('\n'), b); out.append(b); }
  loadTickets(); loadState();
});

async function loadTickets() {
  const qs = new URLSearchParams({ q: $('tQ').value, status: $('tStatus').value });
  const list = await api('GET', '/api/admin/tickets?' + qs);
  table($('tList'), ['Kod', 'Tür', 'Oyuncu', 'Bedel', 'At', 'Durum', 'Kazanç', 'İşlem'], list.map(t => tr => {
    cell(tr, t.code); cell(tr, t.type === 'K' ? 'Kazı' : 'At');
    cell(tr, t.redeemedBy && t.redeemedBy !== t.owner ? `${t.owner || '—'} → ${t.redeemedBy}` : (t.owner || '—'));
    cell(tr, money(t.price));
    cell(tr, t.horse ? `${t.horse}${t.raceId ? ' (#' + t.raceId + ')' : ''}` : '—');
    cell(tr, STATUS[t.status], 's-' + t.status);
    cell(tr, t.payout ? money(t.payout) : '—');
    const td = tr.insertCell();
    if (t.status === 'won') btn(td, 'Öde', async () => { await api('POST', `/api/admin/tickets/${t.code}/pay`); loadTickets(); loadState(); });
    if (t.status === 'issued' || t.status === 'active') btn(td, 'İptal', async () => { if (confirm(t.code + ' iptal edilsin mi?')) { await api('POST', `/api/admin/tickets/${t.code}/void`); loadTickets(); } }, 'danger');
  }));
}
$('tQ').oninput = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(loadTickets, 300); };
$('tStatus').onchange = loadTickets;

// ---------- LOGLAR ----------
async function loadLogs() {
  const qs = new URLSearchParams({ q: $('lQ').value, type: $('lType').value });
  const list = await api('GET', '/api/admin/logs?' + qs);
  table($('lList'), ['Zaman', 'Tür', 'Olay'], list.map(l => tr => { cell(tr, fmtT(l.t)); cell(tr, l.type, 'l-' + l.type); cell(tr, l.msg); }));
}
$('lQ').oninput = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(loadLogs, 300); };
$('lType').onchange = loadLogs;

// ---------- AYARLAR ----------
let filled = false;
function fillSettings() {
  if (filled) return;
  filled = true;
  const s = state.settings, p = s.prizes;
  $('sInterval').value = s.raceIntervalSec; $('sCutoff').value = s.betCutoffSec;
  $('sScratch').value = s.defaultScratchPrice; $('sStake').value = s.defaultHorseStake;
  $('sAuto').checked = s.autoRace; $('sStrict').checked = s.strictOwner;
  $('pJackAmt').value = p.jackpot.amount; $('pJackW').value = p.jackpot.weight;
  $('pBigAmt').value = p.big.amount; $('pBigW').value = p.big.weight;
  $('pRefW').value = p.refund.weight; $('pNoneW').value = p.none.weight;
  $('sHorses').innerHTML = '';
  s.horses.forEach((h, i) => {
    const d = document.createElement('div'); d.className = 'horsebox';
    d.innerHTML = `<b>${i + 1}</b><label>Ad<input class="hn"></label><label>Şans<input class="hw" type="number" step="any"></label><label>Çarpan<input class="hm" type="number" step="any"></label>`;
    d.querySelector('.hn').value = h.name; d.querySelector('.hw').value = h.weight; d.querySelector('.hm').value = h.multiplier;
    $('sHorses').append(d);
  });
  syncGenForm();
}
$('setForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    raceIntervalSec: $('sInterval').value, betCutoffSec: $('sCutoff').value, defaultScratchPrice: $('sScratch').value, defaultHorseStake: $('sStake').value,
    autoRace: $('sAuto').checked, strictOwner: $('sStrict').checked,
    horses: [...document.querySelectorAll('.horsebox')].map(d => ({ name: d.querySelector('.hn').value, weight: d.querySelector('.hw').value, multiplier: d.querySelector('.hm').value })),
    prizes: { jackpot: { amount: $('pJackAmt').value, weight: $('pJackW').value }, big: { amount: $('pBigAmt').value, weight: $('pBigW').value }, refund: { weight: $('pRefW').value }, none: { weight: $('pNoneW').value } }
  };
  try { await api('PUT', '/api/admin/settings', body); $('setMsg').textContent = 'Kaydedildi.'; filled = false; $('gHorse').innerHTML = ''; await loadState(); }
  catch (err) { $('setMsg').textContent = err.message; }
  setTimeout(() => $('setMsg').textContent = '', 2500);
});

if (token) { api('GET', '/api/admin/state').then(() => start()).catch(() => { sessionStorage.removeItem('ld_admin'); token = ''; }); }

// ---------- ÜRÜNLER ----------
function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Görsel okunamadı.'));
    img.src = url;
  });
}
async function loadProducts() {
  const list = await api('GET', '/api/admin/products');
  const host = $('pList');
  host.innerHTML = '';
  if (!list.length) { host.textContent = 'Menüde ürün yok. Yukarıdan ekle.'; return; }
  const save = async (p, patch, msg) => { try { await api('PUT', '/api/admin/products/' + p.id, patch); } catch (e) { alert(e.message); } loadProducts(); };
  list.forEach(p => {
    const row = document.createElement('div');
    row.className = 'prow';
    const pic = document.createElement('div'); pic.className = 'pthumb';
    if (p.image) { const im = document.createElement('img'); im.src = p.image; im.alt = ''; pic.append(im); } else pic.textContent = '—';
    const name = document.createElement('input'); name.value = p.name; name.maxLength = 50; name.setAttribute('aria-label', 'Ürün adı');
    name.onchange = () => save(p, { name: name.value });
    const price = document.createElement('input'); price.type = 'number'; price.min = 0; price.value = p.price; price.setAttribute('aria-label', 'Fiyat');
    price.onchange = () => save(p, { price: price.value });
    const stock = document.createElement('button');
    stock.className = 'stockbtn ' + (p.inStock ? 'yes' : 'no'); stock.textContent = p.inStock ? 'Stokta var' : 'Tükendi';
    stock.onclick = () => save(p, { inStock: !p.inStock });
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp,image/gif'; file.className = 'hidden';
    file.onchange = async () => { if (file.files[0]) { try { save(p, { image: await toDataUrl(file.files[0]) }); } catch (e) { alert(e.message); } } };
    const imgBtn = document.createElement('button'); imgBtn.className = 'mini'; imgBtn.textContent = p.image ? 'Görseli değiştir' : 'Görsel ekle'; imgBtn.onclick = () => file.click();
    const acts = document.createElement('div'); acts.className = 'pacts'; acts.append(stock, imgBtn, file);
    if (p.image) { const rm = document.createElement('button'); rm.className = 'mini'; rm.textContent = 'Görseli kaldır'; rm.onclick = () => save(p, { removeImage: true }); acts.append(rm); }
    const del = document.createElement('button'); del.className = 'mini danger'; del.textContent = 'Sil';
    del.onclick = async () => { if (confirm(`"${p.name}" menüden silinsin mi?`)) { await api('DELETE', '/api/admin/products/' + p.id); loadProducts(); } };
    acts.append(del);
    row.append(pic, name, price, acts);
    host.append(row);
  });
}
$('pForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const f = $('pImg').files[0];
    const body = { name: $('pName').value, price: $('pPrice').value, inStock: $('pStock').checked };
    if (f) body.image = await toDataUrl(f);
    await api('POST', '/api/admin/products', body);
    $('pName').value = ''; $('pPrice').value = 0; $('pImg').value = ''; $('pStock').checked = true;
    $('pMsg').textContent = 'Ürün eklendi.';
    loadProducts();
  } catch (err) { $('pMsg').textContent = err.message; }
  setTimeout(() => $('pMsg').textContent = '', 2500);
});

// ---------- SİPARİŞLER ----------
const OSTATUS = { new: 'Yeni', ready: 'Hazır', done: 'Teslim edildi', cancelled: 'İptal' };
async function loadOrders() {
  const list = await api('GET', '/api/admin/orders?status=' + $('oStatus').value);
  const setStatus = async (o, status) => { try { await api('POST', `/api/admin/orders/${o.id}/status`, { status }); } catch (e) { alert(e.message); } loadOrders(); loadState(); };
  table($('oList'), ['No', 'Zaman', 'Oyuncu', 'Ürünler', 'Toplam', 'Durum', 'İşlem'], list.map(o => tr => {
    cell(tr, '#' + o.id); cell(tr, fmtT(o.createdAt)); cell(tr, o.who);
    cell(tr, o.items.map(i => `${i.qty}x ${i.name}`).join(', '));
    cell(tr, money(o.total));
    cell(tr, OSTATUS[o.status], 'o-' + o.status);
    const td = tr.insertCell();
    if (o.status === 'new') btn(td, 'Hazır', () => setStatus(o, 'ready'));
    if (o.status === 'new' || o.status === 'ready') { btn(td, 'Teslim edildi', () => setStatus(o, 'done')); btn(td, 'İptal', () => setStatus(o, 'cancelled'), 'danger'); }
  }));
}
$('oStatus').onchange = loadOrders;

function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
    o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + 0.18);
  } catch (e) { /* ses çalınamadı */ }
}

// ---------- MÜŞTERİ DEFTERİ ----------
async function loadFeedback() {
  const list = await api('GET', '/api/admin/feedback?kind=' + $('fKind').value);
  table($('fList'), ['Zaman', 'Tür', 'Kimden', 'Mesaj', 'Durum', 'İşlem'], list.map(f => tr => {
    cell(tr, fmtT(f.createdAt));
    cell(tr, f.kind === 'praise' ? 'Övgü' : 'Şikayet', 'f-' + f.kind);
    cell(tr, f.who);
    cell(tr, f.text, 'ftext');
    cell(tr, f.status === 'new' ? 'Yeni' : 'Okundu');
    const td = tr.insertCell();
    if (f.status === 'new') btn(td, 'Okundu', async () => { await api('POST', `/api/admin/feedback/${f.id}/read`); loadFeedback(); loadState(); });
    btn(td, 'Sil', async () => { if (confirm('Bu kayıt silinsin mi?')) { await api('DELETE', '/api/admin/feedback/' + f.id); loadFeedback(); loadState(); } }, 'danger');
  }));
}
$('fKind').onchange = loadFeedback;
