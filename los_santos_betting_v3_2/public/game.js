const socket = io();
const $ = id => document.getElementById(id);
const money = n => '$' + Number(n).toLocaleString('en-US');

let race = null, offset = 0, current = null, horses = [], prevView = 'menu';
let typeToken = 0;

// ---------- EKRANLAR ----------
function show(view) {
  const v = view === 'menu' ? 'menu' : view === 'order' ? 'order' : 'game';
  ['menu', 'game', 'order'].forEach(id => $(id).classList.toggle('hidden', id !== v));
  document.body.classList.toggle('spectate', view === 'track');
  $('bg').classList.toggle('menu-bg', view === 'menu');
  prevView = view;
  if (view === 'window') type(say('greeting'));
  if (view === 'order') { $('orderName').value = $('orderName').value || localStorage.getItem('ld_name') || ''; loadMenu(); type(say('orderGreet'), null, $('orderText')); }
}
document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (!go) return;
  const t = go.dataset.go;
  if (t === 'rules') openRules();
  else if (t === 'feedback') openFeedback();
  else if (t === 'back') closeOverlays();
  else show(t);
});
function closeOverlays() { document.querySelectorAll('.rules').forEach(x => x.classList.add('hidden')); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlays(); });
async function openRules() {
  $('rules').classList.remove('hidden');
  const info = await (await fetch('/api/public/info')).json();
  $('rulesRace').textContent = `Yarışlar yaklaşık ${Math.round(info.intervalSec / 60 * 10) / 10} dakikada bir koşulur. Başlamasına ${info.cutoffSec} saniye kala bahisler kapanır; geç kalan bilet sıradaki yarışa yazılır. Kazanç = bahis x çarpan.`;
  $('oddsTable').innerHTML = '';
  info.horses.forEach(h => {
    const tr = $('oddsTable').insertRow();
    tr.insertCell().textContent = h.n + '. ' + h.name;
    tr.insertCell().textContent = 'x' + h.multiplier;
  });
  $('rulesScratch').textContent = `Büyük ödül ${money(info.prizes[0])}, orta ödül ${money(info.prizes[1])}. Amorti çıkarsa bilet bedelin geri ödenir.`;
}

// ---------- DİYALOG ----------
function type(text, cb, target) {
  const tok = ++typeToken, el = target || $('clerkText');
  el.textContent = '';
  let i = 0;
  (function step() {
    if (tok !== typeToken) return;
    el.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(step, 22); else if (cb) cb();
  })();
}
let idleTimer;
function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!$('game').classList.contains('hidden') && !document.body.classList.contains('spectate') && !current) type(say('idle')); resetIdle(); }, 45000);
}
resetIdle();

// ---------- FİŞ GÖNDERME ----------
$('slip').addEventListener('submit', e => {
  e.preventDefault();
  const code = $('codeIn').value.trim(), name = $('nameIn').value.trim();
  if (!code) return;
  resetIdle();
  if (!name && !localStorage.getItem('ld_name')) { type(say('needName')); return; }
  const who = name || localStorage.getItem('ld_name');
  if (name) localStorage.setItem('ld_name', name);
  if (!$('nameIn').value) $('nameIn').value = who;
  $('giveBtn').disabled = true;
  socket.emit('redeem', { code, name: who }, res => {
    $('giveBtn').disabled = false;
    handleRedeem(res);
  });
});
$('nameIn').value = localStorage.getItem('ld_name') || '';

function handleRedeem(res) {
  hidePanels();
  if (!res.ok) {
    const map = {
      invalid: () => say(res.strikes >= 3 ? 'invalidAnnoyed' : 'invalid'),
      locked: () => say('locked', { secs: res.secs }),
      void: () => say('void'),
      owner: () => say('ownerMismatch', { owner: res.owner })
    };
    type(map[res.reason]());
    showDoc(res.reason === 'owner' ? 'owner' : res.reason, null, res.reason === 'void' ? 'ÇÖP' : 'RED', 'deny');
    if (res.reason === 'locked') lockWindow(res.secs);
    return;
  }
  current = res.ticket;
  $('codeIn').value = '';
  const t = current;
  if (t.type === 'K') {
    if (t.status === 'active') { type(say(t.prize ? 'scratchStart' : 'scratchResume', { price: money(t.price) }), () => openScratch(t)); }
    else finished(t, true);
  } else {
    if (t.status === 'active' && res.pickHorse) {
      type(say('pickHorse', { price: money(t.price) }));
      openPick(t);
    } else if (t.status === 'active') horseRegistered(t, true);
    else finished(t, true);
  }
}
function lockWindow(secs) {
  $('giveBtn').disabled = true;
  const end = Date.now() + secs * 1000;
  const iv = setInterval(() => {
    const left = Math.ceil((end - Date.now()) / 1000);
    $('giveBtn').textContent = left > 0 ? `Kapalı (${left})` : 'Fişi ver';
    if (left <= 0) { clearInterval(iv); $('giveBtn').disabled = false; }
  }, 500);
}

function hidePanels() { ['horsePick', 'scratchBox', 'stampDoc'].forEach(i => $(i).classList.add('hidden')); }

// ---------- BELGE + KAŞE ----------
function showDoc(kind, t, stampText, stampClass) {
  const body = $('docBody');
  body.innerHTML = '';
  const add = (k, v) => { const p = document.createElement('p'); const b = document.createElement('b'); b.textContent = k + ' '; p.append(b, v); body.append(p); };
  const h = document.createElement('h2');
  h.textContent = t ? (t.type === 'K' ? 'KAZI KAZAN BİLETİ' : 'AT YARIŞI BİLETİ') : 'RED KARARI';
  body.append(h);
  if (t) {
    add('Kod:', t.code); add('Sahibi:', t.owner || '—'); add('Bedel:', money(t.price));
    if (t.horse) add('At:', t.horse + '. ' + (horses[t.horse - 1] || ''));
    if (t.raceId && t.type === 'A') add('Yarış:', '#' + t.raceId);
    if (t.status === 'won' || t.status === 'paid') add('Kazanç:', money(t.payout));
    if (t.status === 'paid') add('Durum:', 'Ödendi');
  } else {
    const msg = { invalid: 'Kod sistemde yok.', void: 'Bilet iptal edilmiş.', owner: 'Fişteki isim bilet sahibiyle uyuşmuyor.', locked: 'Gişe geçici olarak kapalı.' };
    add('Sebep:', msg[kind] || 'Reddedildi.');
  }
  const st = $('stamp');
  st.textContent = stampText || '';
  st.className = 'stamp ' + (stampClass || '');
  st.style.display = stampText ? '' : 'none';
  $('stampDoc').classList.remove('hidden');
  void st.offsetWidth; st.classList.add('slam');
}

function finished(t, fromLookup) {
  if (t.status === 'won') { type(say(fromLookup ? 'alreadyWon' : 'horseWin', { amount: money(t.payout), horse: horses[t.horse - 1] })); showDoc('', t, 'KAZANDI', 'ok'); }
  else if (t.status === 'paid') { type(say('alreadyPaid')); showDoc('', t, 'ÖDENDİ', 'ok'); }
  else { type(say('alreadyLost')); showDoc('', t, 'KAYBETTİ', 'deny'); }
}

// ---------- AT SEÇİMİ ----------
function openPick(t) {
  $('horsePick').classList.remove('hidden');
  const box = $('horseBtns');
  box.innerHTML = '';
  horses.forEach((name, i) => {
    const b = document.createElement('button');
    const m = race && race.horses[i] ? ' x' + race.horses[i].multiplier : '';
    b.textContent = `${i + 1}. ${name}${m}`;
    b.onclick = () => socket.emit('pickHorse', { code: t.code, horse: i + 1 }, res => {
      if (res && res.ok) { current = res.ticket; hidePanels(); horseRegistered(res.ticket, false); }
    });
    box.append(b);
  });
}
function horseRegistered(t, resumed) {
  const vars = { n: t.horse, horse: horses[t.horse - 1], price: money(t.price), mult: t.multiplier, race: t.raceId };
  const key = resumed ? 'horseResume' : (race && t.raceId > race.id ? 'horseNextRace' : 'horseRegistered');
  type(say(key, vars));
  showDoc('', t, 'KAYITLI', 'ok');
  $('myBet').textContent = `OYNANAN: ${t.horse}. ${horses[t.horse - 1]} — ${money(t.price)} (#${t.raceId})`;
}

socket.on('ticket', t => {
  if (!current || t.code !== current.code) return;
  current = t;
  setTimeout(() => {
    if (t.status === 'won') { type(say('horseWin', { amount: money(t.payout), horse: horses[t.horse - 1] })); showDoc('', t, 'KAZANDI', 'ok'); }
    else if (t.status === 'lost') { type(say('horseLose', { horse: horses[t.horse - 1], price: money(t.price) })); showDoc('', t, 'KAYBETTİ', 'deny'); }
    else if (t.status === 'paid') showDoc('', t, 'ÖDENDİ', 'ok');
    else if (t.status === 'void') showDoc('', t, 'İPTAL', 'deny');
    if (t.status !== 'active') $('myBet').textContent = '';
  }, 1800);
});

// ---------- KAZI KAZAN ----------
const cv = $('scratchCanvas'), cx = cv.getContext('2d');
let scratching = false, cardDone = true;
function openScratch(t) {
  $('scratchBox').classList.remove('hidden');
  $('winText').textContent = t.prize.label === 'BOŞ' ? 'BOŞ' : t.prize.label;
  $('winText').className = t.prize.amount > 0 ? 'win' : 'lose';
  cv.style.opacity = 1;
  cx.globalCompositeOperation = 'source-over';
  const g = cx.createLinearGradient(0, 0, 320, 150);
  g.addColorStop(0, '#9a9a8c'); g.addColorStop(1, '#6f6f63');
  cx.fillStyle = g; cx.fillRect(0, 0, 320, 150);
  cx.fillStyle = '#2b2a24'; cx.textAlign = 'center';
  cx.font = '26px VT323, monospace'; cx.fillText('DAVIS LOTTO', 160, 48);
  cx.font = '18px VT323, monospace'; cx.fillText('KAZI', 160, 84); cx.fillText(t.code, 160, 128);
  cardDone = false;
}
function scratchAt(e) {
  const r = cv.getBoundingClientRect();
  cx.globalCompositeOperation = 'destination-out';
  cx.beginPath(); cx.arc((e.clientX - r.left) * (320 / r.width), (e.clientY - r.top) * (150 / r.height), 20, 0, 7); cx.fill();
}
cv.addEventListener('pointerdown', e => { if (cardDone) return; scratching = true; cv.setPointerCapture(e.pointerId); scratchAt(e); });
cv.addEventListener('pointermove', e => { if (scratching) scratchAt(e); });
cv.addEventListener('pointerup', () => { scratching = false; checkScratch(); });
function checkScratch() {
  if (cardDone) return;
  const d = cx.getImageData(0, 0, 320, 150).data;
  let clear = 0;
  for (let i = 3; i < d.length; i += 64) if (d[i] === 0) clear++;
  if (clear / (d.length / 64) < 0.5) return;
  cardDone = true;
  cv.style.opacity = 0;
  socket.emit('scratched', { code: current.code }, res => {
    if (!res) return;
    current = res.ticket;
    const t = res.ticket, amt = money(t.payout || 0);
    setTimeout(() => {
      if (t.status === 'won') {
        const refund = t.prize.label === 'AMORTİ';
        const big = t.payout >= t.price * 20;
        type(say(refund ? 'scratchRefund' : big ? 'scratchBigWin' : 'scratchWin', { amount: amt }));
        showDoc('', t, refund ? 'AMORTİ' : 'KAZANDI', 'ok');
      } else { type(say('scratchLose')); showDoc('', t, 'KAYBETTİ', 'deny'); }
    }, 700);
  });
}

// ---------- YARIŞ EKRANI ----------
function buildTrack() {
  const tr = $('track');
  tr.innerHTML = '';
  race.horses.forEach(h => {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.innerHTML = '<span class="lname"></span><div class="run"><span class="horse">🐎</span></div>';
    lane.querySelector('.lname').textContent = `${h.n}. ${h.name.split(' ')[0]} x${h.multiplier}`;
    tr.append(lane);
  });
}
function placeHorses(pos) {
  document.querySelectorAll('.horse').forEach((el, i) => {
    el.style.left = pos[i] + '%';
    el.style.transform = `translateX(-${pos[i]}%)`;
  });
}
socket.on('race', r => {
  const phaseBefore = race && race.phase, idBefore = race && race.id;
  race = r;
  offset = r.now - Date.now();
  horses = r.horses.map(h => h.name);
  if (!$('track').children.length || $('track').children.length !== r.horses.length) buildTrack();
  else document.querySelectorAll('.lname').forEach((el, i) => { el.textContent = `${r.horses[i].n}. ${r.horses[i].name.split(' ')[0]} x${r.horses[i].multiplier}`; });
  placeHorses(r.positions);
  document.querySelectorAll('.lane').forEach((el, i) => el.classList.toggle('winner', r.phase === 'results' && r.order && r.order[0] === i));
  if (r.phase === 'running' && phaseBefore !== 'running' && current && current.type === 'A' && current.status === 'active' && current.raceId === r.id) type(say('raceStart'));
  if (r.phase === 'betting' && idBefore !== r.id) { document.querySelectorAll('.horse').forEach(h => { h.style.left = '0%'; h.style.transform = 'none'; }); }
  updateClock();
});
socket.on('race:tick', pos => { if (race) { race.positions = pos; placeHorses(pos); } });

function updateClock() {
  if (!race) return;
  let txt, st;
  if (race.phase === 'running') { txt = `YARIŞ #${race.id} KOŞULUYOR`; st = 'YARIŞ BAŞLADI!'; }
  else if (race.phase === 'results') {
    const w = race.order ? race.horses[race.order[0]] : null;
    txt = `YARIŞ #${race.id} BİTTİ`; st = w ? `KAZANAN: ${w.n}. ${w.name.toUpperCase()}` : 'YARIŞ BİTTİ';
  } else if (!race.startsAt) { txt = 'Yarışlar durduruldu'; st = 'YARIŞLAR DURAKLATILDI'; }
  else {
    const left = Math.max(0, Math.round((race.startsAt - (Date.now() + offset)) / 1000));
    const closed = left < race.cutoffSec;
    txt = `Yarış #${race.id} — ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}${closed ? ' (bahis kapalı)' : ''}`;
    st = closed ? 'BAHİSLER KAPANDI' : `SONRAKİ YARIŞ #${race.id}  ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  }
  $('clock').textContent = txt;
  $('raceStatus').textContent = st;
}
setInterval(updateClock, 500);

// ---------- SİPARİŞ EKRANI ----------
let menuItems = [];
const cart = new Map();
const orderText = t => type(t, null, $('orderText'));

async function loadMenu() {
  try { menuItems = await (await fetch('/api/public/menu')).json(); } catch (e) { return; }
  for (const id of [...cart.keys()]) { const p = menuItems.find(x => x.id === id); if (!p || !p.inStock) cart.delete(id); }
  renderMenu(); renderCart();
}
function renderMenu() {
  const host = $('products');
  host.innerHTML = '';
  if (!menuItems.length) { host.textContent = 'Raflar şu an boş.'; return; }
  menuItems.forEach(p => {
    const card = document.createElement('div');
    card.className = 'prod' + (p.inStock ? '' : ' out');
    const pic = document.createElement('div');
    pic.className = 'pic';
    if (p.image) { const im = document.createElement('img'); im.src = p.image; im.alt = ''; im.loading = 'lazy'; pic.append(im); }
    else pic.textContent = '🍺';
    const nm = document.createElement('h3'); nm.textContent = p.name;
    const pr = document.createElement('p'); pr.className = 'price'; pr.textContent = money(p.price);
    const st = document.createElement('p'); st.className = 'stock ' + (p.inStock ? 'yes' : 'no'); st.textContent = p.inStock ? 'Stokta var' : 'Tükendi';
    const b = document.createElement('button');
    b.textContent = 'Sepete ekle'; b.disabled = !p.inStock;
    b.onclick = () => { cart.set(p.id, Math.min(10, (cart.get(p.id) || 0) + 1)); renderCart(); orderText(say('orderAdded')); };
    card.append(pic, nm, pr, st, b);
    host.append(card);
  });
}
function renderCart() {
  const ul = $('cartList');
  ul.innerHTML = '';
  let total = 0;
  cart.forEach((qty, id) => {
    const p = menuItems.find(x => x.id === id);
    if (!p) return;
    total += p.price * qty;
    const li = document.createElement('li');
    const nm = document.createElement('span'); nm.textContent = `${p.name} — ${money(p.price * qty)}`;
    const ctl = document.createElement('span');
    const mk = (txt, label, fn) => { const x = document.createElement('button'); x.type = 'button'; x.textContent = txt; x.setAttribute('aria-label', label + ' ' + p.name); x.onclick = fn; return x; };
    const q = document.createElement('b'); q.textContent = qty;
    ctl.append(mk('−', 'Azalt', () => { qty > 1 ? cart.set(id, qty - 1) : cart.delete(id); renderCart(); }), q, mk('+', 'Artır', () => { cart.set(id, Math.min(10, qty + 1)); renderCart(); }));
    li.append(nm, ctl);
    ul.append(li);
  });
  if (!ul.children.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Sepet boş.'; ul.append(li); }
  $('cartTotal').textContent = money(total);
}
$('orderBtn').onclick = () => {
  const name = $('orderName').value.trim();
  if (!name) return orderText(say('needName'));
  if (!cart.size) return orderText(say('orderEmpty'));
  localStorage.setItem('ld_name', name);
  $('orderBtn').disabled = true;
  socket.emit('order', { name, items: [...cart].map(([id, qty]) => ({ id, qty })) }, res => {
    $('orderBtn').disabled = false;
    if (res.ok) { cart.clear(); renderCart(); orderText(say('orderPlaced', { id: res.id, total: money(res.total) })); }
    else if (res.reason === 'stock') { orderText(say('orderSoldOut', { items: res.names })); loadMenu(); }
    else if (res.reason === 'fast') orderText(say('orderFast'));
    else orderText(say(res.reason === 'name' ? 'needName' : 'orderEmpty'));
  });
};
socket.on('menu', () => { if (!$('order').classList.contains('hidden')) loadMenu(); });
socket.on('orderUpdate', u => {
  const key = { ready: 'orderReady', done: 'orderDone', cancelled: 'orderCancelled' }[u.status];
  if (key) orderText(say(key));
});

// ---------- ÖVGÜ / ŞİKAYET DEFTERİ ----------
function openFeedback() {
  $('feedback').classList.remove('hidden');
  $('fbName').value = $('fbName').value || localStorage.getItem('ld_name') || '';
  type(say('feedbackOpen'), null, $('fbReply'));
  $('fbText').focus();
}
$('fbForm').addEventListener('submit', e => {
  e.preventDefault();
  const kind = document.querySelector('input[name=fbKind]:checked').value;
  $('fbBtn').disabled = true;
  socket.emit('feedback', { kind, name: $('fbName').value, text: $('fbText').value }, res => {
    $('fbBtn').disabled = false;
    if (res.ok) { $('fbText').value = ''; type(say(kind === 'praise' ? 'feedbackPraise' : 'feedbackComplaint'), null, $('fbReply')); }
    else type(say(res.reason === 'fast' ? 'feedbackFast' : 'feedbackShort'), null, $('fbReply'));
  });
});

// ---------- MENÜ KAMERASI VE CRT ----------
const camClock = () => { $('camTime').textContent = new Date().toLocaleString('en-GB', { hour12: false }).replace(',', ''); };
camClock(); setInterval(camClock, 1000);

function applyCrt(on) {
  document.body.classList.toggle('crt-on', on);
  $('crtToggle').textContent = 'CRT efekti: ' + (on ? 'açık' : 'kapalı');
}
$('crtToggle').onclick = () => { const on = !document.body.classList.contains('crt-on'); localStorage.setItem('ld_crt', on ? 'on' : 'off'); applyCrt(on); };
applyCrt(localStorage.getItem('ld_crt') !== 'off');
if (document.body.classList.contains('crt-on')) { document.body.classList.add('power-on'); setTimeout(() => document.body.classList.remove('power-on'), 1000); }
