import { initBaseChart } from './core/chart_base.js';
import { initSocket as initChartWS } from './core/chart_ws.js';
import './core/chart_utils.js';

const API_POS = '/api/position/filter';
const API_ORD = '/api/order/filter';
const API_EXCH = '/api/settings/exchange?name=bybit';
const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
const WS_TRADE_URL = `${wsScheme}://${window.location.host}/ws/trade_update/`;

const state = {
  makerFee: 0,
  takerFee: 0,
  price: null,
  symbol: 'BTCUSDT',
  filters: { status: '', side: '', uuid: '' },
  pos: { limit: 20, offset: 0, total: 0, list: [] },
  ord: { limit: 20, offset: 0, total: 0, list: [] },
  activeTab: 'orders',
  wsTrade: null,
};

const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

function setTradeWSStatus(color, text) {
  const dot = qs('#ws-status-trade');
  const label = qs('#ws-status-trade-text');
  if (dot) dot.className = `ws-dot ${color}`;
  if (label) label.textContent = text;
}

function fmtNum(x, dp = 6) {
  if (x == null || isNaN(x)) return '—';
  const n = Number(x);
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: dp });
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}
function fmtUSDT(x, dp = 2) {
  if (x == null || isNaN(x)) return '—';
  return Number(x).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function calcPnlUSD(side, qty, entryPrice) {
  if (state.price == null || entryPrice == null || qty == null) return null;
  const px = Number(state.price);
  const ent = Number(entryPrice);
  const q = Number(qty);
  const gross = side === 'sell' ? (ent - px) * q : (px - ent) * q;
  const fees = px * q * (state.makerFee + state.takerFee);
  return gross - fees;
}
const pnlClass = (v) => (v == null ? '' : v >= 0 ? 'positive' : 'negative');

function makeRow(kind, item) {
  const qty = item.qty_tokens ? Number(item.qty_tokens) : null;
  const price = item.price ? Number(item.price) : null;
  const side = (item.side || '').toLowerCase();
  const pnl = calcPnlUSD(side, qty, price);

  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <div class="col"><button class="btn btn-primary btn-more" data-id="${item.id}" data-kind="${kind}">Подробнее</button></div>
    <div class="col">
      <div class="top">${fmtNum(qty)} ${item.symbol_name || state.symbol}</div>
      <div class="bottom">${fmtUSDT(qty * price)} USDT</div>
    </div>
    <div class="col"><span class="side-badge ${side === 'buy' ? 'side-buy' : 'side-sell'}">${side.toUpperCase()}</span></div>
    <div class="col"><div class="pnl ${pnlClass(pnl)}">${pnl == null ? '—' : (pnl >= 0 ? '+' : '') + fmtUSDT(pnl)}</div></div>
    <div class="col"><div class="top mono">${item.uuid || '—'}</div><div class="bottom">${fmtDate(item.created_at)}</div></div>
    <div class="col actions"><span class="bottom">${(item.status || '—').toUpperCase()}</span></div>`;
  row.querySelector('.btn-more').onclick = () => openModal(kind, item);
  return row;
}

function renderList(kind, items) {
  const box = qs(kind === 'positions' ? '#positions-list' : '#orders-list');
  box.innerHTML = '';
  if (!items?.length) {
    box.innerHTML = `<div class="item-row"><div class="col"><span>Нет данных</span></div></div>`;
    return;
  }
  for (const i of items) box.appendChild(makeRow(kind, i));
}

function buildParams(extra = {}) {
  const f = state.filters;
  const p = new URLSearchParams();
  if (f.status) p.set('status', f.status);
  if (f.side) p.set('side', f.side);
  if (f.uuid) p.set('uuid', f.uuid);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

async function loadPositions() {
  try {
    const res = await fetch(`${API_POS}?${buildParams({ limit: state.pos.limit, offset: state.pos.offset })}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    state.pos.list = json.positions || [];
    state.pos.total = Number(json.count_db || state.pos.list.length || 0);
    renderList('positions', state.pos.list);
    updatePager('positions');
  } catch (e) { console.error('Ошибка загрузки позиций:', e); }
}

async function loadOrders() {
  try {
    const res = await fetch(`${API_ORD}?${buildParams({ limit: state.ord.limit, offset: state.ord.offset })}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    state.ord.list = json.orders || [];
    state.ord.total = Number(json.count_db || state.ord.list.length || 0);
    renderList('orders', state.ord.list);
    updatePager('orders');
  } catch (e) { console.error('Ошибка загрузки ордеров:', e); }
}
async function loadExchangeSettings() {
  const res = await fetch(API_EXCH);
  const j = await res.json();
  state.makerFee = Number(j.maker_fee || 0);
  state.takerFee = Number(j.taker_fee || 0);
  qs('#fees-value').textContent = `maker ${(state.makerFee * 100).toFixed(3)}% · taker ${(state.takerFee * 100).toFixed(3)}%`;
}

function switchTab(tab) {
  state.activeTab = tab;
  const btns = qsa('.trade-tab-btn');
  const panels = qsa('.trade-panel');
  btns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  panels.forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
}

function bindTabs() {
  const root = qs('.trade-tabs');
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.trade-tab-btn');
    if (!btn) return;
    switchTab(btn.dataset.tab);
    if (btn.dataset.tab === 'positions') loadPositions();
    if (btn.dataset.tab === 'orders') loadOrders();
  });
}

function openModal(kind, item) {
  qs('#md-type').textContent = kind === 'orders' ? 'Ордер' : 'Позиция';
  qs('#md-uuid').textContent = item.uuid || '—';
  qs('#md-symbol').textContent = item.symbol_name || '—';
  qs('#md-side').textContent = item.side || '—';
  qs('#md-status').textContent = item.status || '—';
  qs('#md-qty').textContent = item.qty_tokens || '—';
  qs('#md-price').textContent = item.price || '—';
  qs('#md-created').textContent = fmtDate(item.created_at);
  qs('#md-json').textContent = JSON.stringify(item, null, 2);
  qs('#trade-modal').classList.add('show');
}

function bindModal() {
  qs('#modal-close').onclick = () => qs('#trade-modal').classList.remove('show');
  qs('#trade-modal').onclick = (e) => { if (e.target === qs('#trade-modal')) qs('#trade-modal').classList.remove('show'); };
}

function connectTradeWS() {
  setTradeWSStatus('yellow', 'Подключение...');
  const ws = new WebSocket(WS_TRADE_URL);
  ws.onopen = () => setTradeWSStatus('green', 'Подключено');
  ws.onclose = ws.onerror = () => setTradeWSStatus('red', 'Отключено');
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.method === 'order_update' && msg.data) handleIncoming('orders', msg.data);
      if (msg.method === 'position_update' && msg.data) handleIncoming('positions', msg.data);
    } catch (err) { console.error('WS parse error:', err); }
  };
  state.wsTrade = ws;
}

function handleIncoming(kind, item) {
  const list = kind === 'orders' ? state.ord.list : state.pos.list;
  const idx = list.findIndex((x) => String(x.id) === String(item.id));
  if (idx >= 0) list[idx] = { ...list[idx], ...item };
  else list.unshift(item);
  renderList(kind, list);
}

async function attachChartPrice() {
  const ctx = await initBaseChart();
  await initChartWS(ctx);
  const setLive = (close) => {
    state.price = Number(close);
    qs('#live-price').textContent = fmtUSDT(state.price, 2);
    if (state.activeTab === 'orders') renderList('orders', state.ord.list);
    if (state.activeTab === 'positions') renderList('positions', state.pos.list);
  };
  if (ctx?.allCandles?.length) {
    const last = ctx.allCandles.at(-1);
    if (last?.close) setLive(last.close);
  }
  if (ctx.subscribeToCandle) ctx.subscribeToCandle((c) => c?.close && setLive(c.close));
}

async function bootstrap() {
  bindTabs();
  bindModal();
  bindPager(); // ✅ вот это
  await loadExchangeSettings();
  await loadOrders();
  switchTab('orders');
  connectTradeWS();
  attachChartPrice();
}
function updatePager(kind) {
  const obj = kind === 'orders' ? state.ord : state.pos;
  const page = Math.floor(obj.offset / obj.limit) + 1;
  const pages = Math.max(1, Math.ceil(obj.total / obj.limit));

  qs(`#${kind === 'orders' ? 'ord' : 'pos'}-page`).textContent = page;
  qs(`#${kind === 'orders' ? 'ord' : 'pos'}-pages`).textContent = pages;
  qs(`#${kind === 'orders' ? 'ord' : 'pos'}-total`).textContent = obj.total;

  qs(`#${kind === 'orders' ? 'ord' : 'pos'}-prev`).disabled = page <= 1;
  qs(`#${kind === 'orders' ? 'ord' : 'pos'}-next`).disabled = page >= pages;
}

async function goPage(kind, dir) {
  const obj = kind === 'orders' ? state.ord : state.pos;
  const newOffset = obj.offset + dir * obj.limit;
  if (newOffset < 0) return;
  if (newOffset >= obj.total) return;
  obj.offset = newOffset;
  if (kind === 'orders') await loadOrders();
  else await loadPositions();
  updatePager(kind);
}

function bindPager() {
  // ордера
  qs('#ord-prev').onclick = () => goPage('orders', -1);
  qs('#ord-next').onclick = () => goPage('orders', 1);
  // позиции
  qs('#pos-prev').onclick = () => goPage('positions', -1);
  qs('#pos-next').onclick = () => goPage('positions', 1);
}

window.addEventListener('load', bootstrap);
