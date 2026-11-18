const $ = id => document.getElementById(id);
const money = n => '$' + Number(n || 0).toLocaleString('en-US');
const fmtT = t => new Date(t).toLocaleString('tr-TR', { hour12: false });
const fmtMs = ms => (ms / 1000).toFixed(1) + ' sn';
const STATUS = { issued: 'Oynanmadı', active: 'Yarış bekliyor', won: 'Kazandı (ödenmedi)', lost: 'Kaybetti', paid: 'Ödendi', void: 'İptal' };
const RESULT = { won: 'Kazandı', paid: 'Kazandı', lost: 'Kaybetti', active: 'Bekliyor' };
let token = sessionStorage.getItem('ld_admin') || '', state = null, timer;

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && url !== '/api/admin/login') { logout(); throw new Error('Oturum bitti'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Hata');
  return data;
}
function logout() { sessionStorage.removeItem('ld_admin'); token = ''; location.reload(); }

// ---------- YARDIMCILAR ----------
function cell(tr, text, cls) { const td = tr.insertCell(); td.textContent = text; if (cls) td.className = cls; return td; }
function table(host, heads, rows, empty = 'Kayıt yok.') {
  host.innerHTML = '';
  if (!rows.length) { host.textContent = empty; host.className = 'tbl muted'; return; }
  host.className = 'tbl';
  const t = document.createElement('table');
  const hr = t.createTHead().insertRow();
  heads.forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.append(th); });
  const tb = t.createTBody();
  rows.forEach(r => r(tb.insertRow()));
  host.append(t);
}
function btn(td, label, fn, cls) { const b = document.createElement('button'); b.textContent = label; b.className = 'mini ' + (cls || ''); b.onclick = fn; td.append(b); }
function copy(text, el) { navigator.clipboard.writeText(text).then(() => { const o = el.textContent; el.textContent = 'Kopyalandı'; setTimeout(() => el.textContent = o, 1200); }); }
const hName = n => (state && state.settings.horses[n - 1] ? state.settings.horses[n - 1].name : '?');
const who = t => t.redeemedBy || t.owner || '—';
const debounce = (fn, ms = 300) => { let x; return () => { clearTimeout(x); x = setTimeout(fn, ms); }; };

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
if (token) api('GET', '/api/admin/state').then(() => start()).catch(() => { sessionStorage.removeItem('ld_admin'); token = ''; });

async function start() {
  $('login').classList.add('hidden'); $('app').classList.remove('hidden');
  const s = io('/admin', { auth: { token } });
  s.on('log', () => { if ($('lLive').checked && visible('logs')) loadLogs(); refreshSoon(); });
  s.on('race', refreshSoon);
  await loadState(); loadTickets(); loadLogs();
}
const visible = id => !$(id).classList.contains('hidden');
const refreshSoon = debounce(() => {
  loadState();
  if (visible('tickets')) loadTickets();
  if (visible('pay')) loadPay();
  if (visible('races')) loadRace($('rSel').value);
}, 600);

document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('hidden', s.id !== b.dataset.tab));
  ({ tickets: loadTickets, pay: loadPay, races: loadRaces, logs: loadLogs })[b.dataset.tab]?.();
});
function openTab(name) { document.querySelector(`#tabs button[data-tab="${name}"]`).click(); }

// ---------- PANEL ----------
let horseKey = '';
async function loadState() {
  state = await api('GET', '/api/admin/state');
  const s = state.stats, profit = s.revenue - s.paid - s.pending, st = state.settings;
  $('adminTitle').textContent = st.siteName + ' — Yönetim';
  $('stats').innerHTML = '';
  [['Satılan bilet', s.sold], ['Toplam gelir', money(s.revenue)], ['Ödenen', money(s.paid)], ['Ödeme bekleyen', `${money(s.pending)} (${s.pendingCount})`], ['Net kâr', money(profit)],
    ['Kazanan bilet', s.won], ['Kaybeden bilet', s.lost], ['Yarış bekleyen', s.active], ['Oynanmamış', s.unplayed]].forEach(([k, v]) => {
    const d = document.createElement('div'); d.className = 'stat';
    const a = document.createElement('small'); a.textContent = k;
    const b = document.createElement('b'); b.textContent = v;
    if (k === 'Net kâr') b.className = profit >= 0 ? 'pos' : 'neg';
    d.append(a, b); $('stats').append(d);
  });
  $('payBadge').textContent = s.pendingCount; $('payBadge').classList.toggle('hidden', !s.pendingCount);

  const r = state.race;
  let info = `Yarış #${r.id} — ` + ({ betting: 'bahis açık', running: 'koşuluyor', results: 'sonuç ekranı' })[r.phase];
  if (r.phase === 'betting' && r.startsAt) info += `, başlangıç: ${fmtT(r.startsAt)}`;
  if (state.paused) info += ' (otomatik yarış durduruldu)';
  $('raceInfo').textContent = info;
  $('pauseBtn').textContent = state.paused ? 'Otomatik yarışı sürdür' : 'Otomatik yarışı durdur';
  $('runBtn').disabled = r.phase !== 'betting';

  table($('raceHist'), ['Yarış', 'Zaman', 'Kazanan at', 'Bahis', 'Kazanan bilet', 'Toplam bahis', 'Ödenecek', ''], state.races.map(x => tr => {
    cell(tr, '#' + x.id); cell(tr, fmtT(x.t)); cell(tr, `${x.winner}. ${x.winnerName}`);
    cell(tr, x.bets); cell(tr, x.wins); cell(tr, money(x.stake)); cell(tr, money(x.payout), x.payout ? 'pos' : '');
    btn(tr.insertCell(), 'Detay', () => { openTab('races'); $('rSel').value = x.id; loadRace(x.id); });
  }), 'Henüz yarış koşulmadı.');

  const key = st.horses.map(h => h.name).join('|');
  if (key !== horseKey) {
    horseKey = key;
    $('gHorse').innerHTML = '<option value="">Oyuncu seçsin</option>';
    st.horses.forEach((h, i) => $('gHorse').add(new Option(`${i + 1}. ${h.name} (x${h.multiplier})`, i + 1)));
    fillSettings();
  }
  if (!$('gPrice').placeholder || $('gPrice').placeholder !== String(st.defaultHorseStake)) $('gPrice').placeholder = st.defaultHorseStake;
}
$('runBtn').onclick = async () => { try { await api('POST', '/api/admin/race/run'); } catch (e) { alert(e.message); } loadState(); };
$('pauseBtn').onclick = async () => { await api('POST', '/api/admin/race/' + (state.paused ? 'resume' : 'pause')); loadState(); };

// ---------- BİLETLER ----------
$('genForm').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await api('POST', '/api/admin/tickets', { owner: $('gOwner').value, price: $('gPrice').value, horse: $('gHorse').value, quantity: $('gQty').value });
  const out = $('genOut'); out.innerHTML = '';
  const lines = r.created.map(c => `Race Book Bahis Bileti | Kod: ${c.code} | ${money(c.price)}${c.horse ? ' | At ' + c.horse : ''}${c.owner ? ' | ' + c.owner : ''}`);
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
  const list = await api('GET', '/api/admin/tickets?' + new URLSearchParams({ q: $('tQ').value, status: $('tStatus').value }));
  table($('tList'), ['Kod', 'Oyuncu', 'At', 'Bahis', 'Çarpan', 'Yarış', 'Sonuç', 'Kazanç', 'Durum', 'İşlem'], list.map(t => tr => {
    cell(tr, t.code);
    cell(tr, t.redeemedBy && t.redeemedBy !== t.owner ? `${t.owner || '—'} → ${t.redeemedBy}` : who(t));
    cell(tr, t.horse ? `${t.horse}. ${hName(t.horse)}` : '—');
    cell(tr, money(t.price)); cell(tr, t.multiplier ? 'x' + t.multiplier : '—'); cell(tr, t.raceId ? '#' + t.raceId : '—');
    cell(tr, RESULT[t.status] || '—', 'r-' + t.status);
    cell(tr, t.status === 'won' || t.status === 'paid' ? money(t.payout) : '—');
    cell(tr, STATUS[t.status], 's-' + t.status);
    const td = tr.insertCell();
    if (t.status === 'won') btn(td, 'Ödendi', () => payTicket(t));
    if (t.status === 'issued' || t.status === 'active') btn(td, 'İptal', async () => { if (confirm(t.code + ' iptal edilsin mi?')) { await api('POST', `/api/admin/tickets/${t.code}/void`); loadTickets(); loadState(); } }, 'danger');
  }));
}
$('tQ').oninput = debounce(loadTickets); $('tStatus').onchange = loadTickets;

// ---------- ÖDEMELER ----------
async function payTicket(t) {
  if (!confirm(`${who(t)} için ${money(t.payout)} ödendi olarak işaretlensin mi?`)) return;
  try { await api('POST', `/api/admin/tickets/${t.code}/pay`); } catch (e) { alert(e.message); }
  loadPay(); loadTickets(); loadState();
}
async function loadPay() {
  const [won, paid] = await Promise.all([api('GET', '/api/admin/tickets?status=won'), api('GET', '/api/admin/tickets?status=paid')]);
  $('pendingTotal').textContent = won.length ? '— toplam ' + money(won.reduce((a, t) => a + t.payout, 0)) : '';
  table($('pending'), ['Kod', 'Oyuncu', 'At', 'Yarış', 'Kazanç', ''], won.map(t => tr => {
    cell(tr, t.code); cell(tr, who(t)); cell(tr, `${t.horse}. ${hName(t.horse)}`); cell(tr, '#' + t.raceId); cell(tr, money(t.payout), 'pos');
    btn(tr.insertCell(), 'Ödendi işaretle', () => payTicket(t));
  }), 'Ödeme bekleyen kazanç yok.');
  table($('paidList'), ['Kod', 'Oyuncu', 'At', 'Yarış', 'Ödenen', 'Ödeme zamanı'], paid.map(t => tr => {
    cell(tr, t.code); cell(tr, who(t)); cell(tr, `${t.horse}. ${hName(t.horse)}`); cell(tr, '#' + t.raceId); cell(tr, money(t.payout)); cell(tr, t.paidAt ? fmtT(t.paidAt) : '—');
  }), 'Henüz ödeme yapılmadı.');
}

// ---------- YARIŞLAR ----------
async function loadRaces() {
  const cur = state.race.id, ids = [cur + 1, cur, ...state.races.map(r => r.id).filter(i => i !== cur)];
  const sel = $('rSel'), keep = sel.value;
  sel.innerHTML = '';
  ids.forEach((id, i) => sel.add(new Option(`#${id}` + (i === 0 ? ' (sonraki)' : id === cur && state.race.phase !== 'results' ? ' (şu anki)' : ''), id)));
  sel.value = ids.map(String).includes(keep) ? keep : String(state.race.phase === 'results' ? cur : cur);
  loadRace(sel.value);
}
$('rSel').onchange = () => loadRace($('rSel').value);
async function loadRace(id) {
  if (!id) return;
  const d = await api('GET', '/api/admin/races/' + id), horses = state.settings.horses;
  const info = $('rInfo'); info.innerHTML = '';
  const p = document.createElement('p');
  if (d.race) p.textContent = `Yarış #${id} koşuldu — kazanan: ${d.race.winner}. ${d.race.winnerName} (${fmtMs(d.race.times[0])}). Sıralama: ` + d.race.order.map((n, k) => `${k + 1}. ${hName(n)}`).join(' › ');
  else p.textContent = `Yarış #${id} henüz koşulmadı. Aşağıda şu ana kadar yazılan bahisler ve risk tablosu var.`;
  info.append(p);

  if (!d.race) {
    const rows = horses.map((h, i) => {
      const bets = d.tickets.filter(t => t.horse === i + 1);
      return { n: i + 1, name: h.name, count: bets.length, stake: bets.reduce((a, t) => a + t.price, 0), out: bets.reduce((a, t) => a + Math.round(t.price * (t.multiplier || h.multiplier)), 0) };
    });
    const total = rows.reduce((a, r) => a + r.stake, 0), worst = Math.max(...rows.map(r => r.out));
    table($('rRisk'), ['At', 'Bahis adedi', 'Toplam bahis', 'Bu at kazanırsa ödenecek', 'Kasa sonucu'], rows.map(r => tr => {
      cell(tr, `${r.n}. ${r.name}`); cell(tr, r.count); cell(tr, money(r.stake)); cell(tr, money(r.out), r.out === worst && worst > 0 ? 'neg' : '');
      cell(tr, money(total - r.out), total - r.out >= 0 ? 'pos' : 'neg');
    }));
  } else { $('rRisk').innerHTML = ''; $('rRisk').className = 'tbl'; }

  table($('rBets'), ['Oyuncu', 'Kod', 'At', 'Bahis', 'Çarpan', 'Sonuç', 'Kazanç', 'Ödeme'], d.tickets.map(t => tr => {
    cell(tr, who(t)); cell(tr, t.code); cell(tr, `${t.horse}. ${hName(t.horse)}`); cell(tr, money(t.price)); cell(tr, 'x' + (t.multiplier || '—'));
    cell(tr, RESULT[t.status] || '—', 'r-' + t.status);
    cell(tr, t.status === 'won' || t.status === 'paid' ? money(t.payout) : '—');
    cell(tr, t.status === 'paid' ? 'Ödendi' : t.status === 'won' ? 'Bekliyor' : '—', t.status === 'won' ? 's-won' : '');
  }), 'Bu yarışa yazılı bahis yok.');
}

// ---------- LOGLAR ----------
async function loadLogs() {
  const list = await api('GET', '/api/admin/logs?' + new URLSearchParams({ q: $('lQ').value, type: $('lType').value }));
  table($('lList'), ['Zaman', 'Tür', 'Olay'], list.map(l => tr => { cell(tr, fmtT(l.t)); cell(tr, l.type, 'l-' + l.type); cell(tr, l.msg); }));
}
$('lQ').oninput = debounce(loadLogs); $('lType').onchange = loadLogs;

// ---------- AYARLAR ----------
function fillSettings() {
  const s = state.settings;
  $('sName').value = s.siteName; $('sInterval').value = s.raceIntervalSec; $('sDuration').value = s.raceDurationSec;
  $('sCutoff').value = s.betCutoffSec; $('sStake').value = s.defaultHorseStake;
  $('sAuto').checked = s.autoRace; $('sStrict').checked = s.strictOwner;
  const box = $('sHorses'); box.innerHTML = '';
  s.horses.forEach((h, i) => {
    const d = document.createElement('div'); d.className = 'horsebox';
    d.innerHTML = '<b></b><label>Ad<input class="hn"></label><label>Şans<input class="hw" type="number" step="any"></label><label>Çarpan<input class="hm" type="number" step="any"></label><span class="rtp"></span>';
    d.querySelector('b').textContent = i + 1;
    d.querySelector('.hn').value = h.name; d.querySelector('.hw').value = h.weight; d.querySelector('.hm').value = h.multiplier;
    box.append(d);
  });
  box.oninput = updateRtp; updateRtp();
}
function updateRtp() {
  const rows = [...document.querySelectorAll('.horsebox')], total = rows.reduce((a, d) => a + (+d.querySelector('.hw').value || 0), 0) || 1;
  rows.forEach(d => { const r = (+d.querySelector('.hw').value / total) * (+d.querySelector('.hm').value); const s = d.querySelector('.rtp'); s.textContent = 'Geri ödeme %' + (r * 100).toFixed(0); s.className = 'rtp ' + (r > 1 ? 'neg' : 'pos'); });
}
$('setForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    siteName: $('sName').value, raceIntervalSec: $('sInterval').value, raceDurationSec: $('sDuration').value, betCutoffSec: $('sCutoff').value,
    defaultHorseStake: $('sStake').value, autoRace: $('sAuto').checked, strictOwner: $('sStrict').checked,
    horses: [...document.querySelectorAll('.horsebox')].map(d => ({ name: d.querySelector('.hn').value, weight: d.querySelector('.hw').value, multiplier: d.querySelector('.hm').value }))
  };
  try { await api('PUT', '/api/admin/settings', body); $('setMsg').textContent = 'Kaydedildi.'; horseKey = ''; await loadState(); }
  catch (err) { $('setMsg').textContent = err.message; }
  setTimeout(() => $('setMsg').textContent = '', 2500);
});
