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

  // NEW: данные открытого модального окна
  modal: {
    open: false,
    kind: null,
    id: null,     // id ордера/позиции
    item: null,   // объект, как был при открытии
  },
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

function calcPnlUSD(kind, item) {
  const side = (item.side || '').toLowerCase();
  const qty = Number(item.qty_tokens || 0);
  const entryPrice = Number(item.price || 0);
  const closeRate = Number(item.close_rate || 0);
  const accumulatedFunding = Number(item.accumulated_funding || 0);
  const fees = entryPrice * qty * (state.makerFee + state.takerFee);

  // завершённый ордер → считаем по close_rate
  if (kind === 'orders' && item.status === 'completed') {
    if (!qty || !entryPrice || !closeRate) return null;
    const gross =
      side === 'sell'
        ? (entryPrice - closeRate) * qty
        : (closeRate - entryPrice) * qty;
    return gross - accumulatedFunding;
  }

  // иначе считаем по текущей цене
  if (state.price == null || !entryPrice || !qty) return null;
  const px = Number(state.price);
  const gross =
    side === 'sell'
      ? (entryPrice - px) * qty
      : (px - entryPrice) * qty;

  return gross - fees;
}

const pnlClass = (v) =>
  v == null ? '' : v >= 0 ? 'positive' : 'negative';

function makeRow(kind, item) {
  const qty = item.qty_tokens ? Number(item.qty_tokens) : null;
  const price = item.price ? Number(item.price) : null;
  const side = (item.side || '').toLowerCase();
  const pnl = calcPnlUSD(kind, item);

  const row = document.createElement('div');
  row.className = 'item-row table-grid';

  row.innerHTML = `
    <div class="col">
      <button class="btn btn-primary btn-more" data-id="${item.id}" data-kind="${kind}">
        Подробнее
      </button>
    </div>

    <div class="col">
      <div class="top">${fmtNum(qty)} ${item.symbol_name || state.symbol}</div>
      <div class="bottom">${fmtUSDT(qty * price)} USDT</div>
    </div>

    <div class="col">
      <span class="side-badge ${side === 'buy' ? 'side-buy' : 'side-sell'}">
        ${side.toUpperCase()}
      </span>
    </div>

    <div class="col">
      <div class="pnl ${pnlClass(pnl)}">
        ${pnl == null ? '—' : (pnl >= 0 ? '+' : '') + fmtUSDT(pnl)}
      </div>
    </div>

    <div class="col">
      <div class="top mono">${item.uuid || '—'}</div>
      <div class="bottom">${fmtDate(item.created_at)}</div>
    </div>

    <div class="col actions">
      <span class="bottom">${(item.status_title || '—').toUpperCase()}</span>
    </div>
  `;

  row.querySelector('.btn-more').onclick = () => openModal(kind, item);
  return row;
}

function renderList(kind, items) {
  const box = qs(kind === 'positions' ? '#positions-list' : '#orders-list');
  box.innerHTML = '';

  if (!items?.length) {
    box.innerHTML = `
      <div class="item-row"><div class="col"><span>Нет данных</span></div></div>
    `;
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
    const res = await fetch(
      `${API_POS}?${buildParams({
        limit: state.pos.limit,
        offset: state.pos.offset,
      })}`
    );

    if (res.status === 404) {
      const json = await res.json();
      console.log(json.msg);

      showToast(json.msg || 'Ошибка 404: данные не найдены');
      return;
    }

    if (!res.ok) {
      showToast(`Ошибка загрузки позиций: HTTP ${res.status}`);
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    state.pos.list = json.positions || [];
    state.pos.total = Number(json.count_db || state.pos.list.length || 0);

    renderList('positions', state.pos.list);
    updatePager('positions');
  } catch (e) {
    console.error('Ошибка загрузки позиций:', e);
    showToast('Ошибка при загрузке позиций');
  }
}


async function loadOrders() {
  try {
    const res = await fetch(
      `${API_ORD}?${buildParams({
        limit: state.ord.limit,
        offset: state.ord.offset,
      })}`
    );

    if (res.status === 404) {
      const json = await res.json();
      console.log(json.msg);

      showToast(json.msg || 'Ошибка 404: данные не найдены');
      return;
    }

    if (!res.ok) {
      showToast(`Ошибка загрузки ордеров: HTTP ${res.status}`);
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    state.ord.list = json.orders || [];
    state.ord.total = Number(json.count_db || state.ord.list.length || 0);

    renderList('orders', state.ord.list);
    updatePager('orders');
  } catch (e) {
    console.error('loadOrders error:', e);
    showToast('Ошибка при загрузке ордеров');
  }
}


async function loadExchangeSettings() {
  const res = await fetch(API_EXCH);
  const j = await res.json();

  state.makerFee = Number(j.maker_fee || 0);
  state.takerFee = Number(j.taker_fee || 0);

  qs('#fees-value').textContent = `maker ${(state.makerFee * 100).toFixed(
    3
  )}% · taker ${(state.takerFee * 100).toFixed(3)}%`;
}

function switchTab(tab) {
  state.activeTab = tab;

  const btns = qsa('.trade-tab-btn');
  const panels = qsa('.trade-panel');

  btns.forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  panels.forEach((p) =>
    p.classList.toggle('active', p.id === `tab-${tab}`)
  );

  if (tab === 'orders') renderList('orders', state.ord.list);
  else renderList('positions', state.pos.list);
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

/* ================================
      МОДАЛКА — ОТКРЫТИЕ
================================ */
function openModal(kind, item) {
  state.modal.open = true;
  state.modal.kind = kind;
  state.modal.id = item.id;
  state.modal.item = JSON.parse(JSON.stringify(item)); // глубокая копия

  qs('#md-type').textContent = kind === 'orders' ? 'Ордер' : 'Позиция';
  qs('#md-uuid').textContent = item.uuid || '—';
  qs('#md-symbol').textContent = item.symbol_name || '—';
  let sideLabel = '—';
  let sideClass = '';
  if (item.side) {
    if (item.side.toLowerCase() === 'buy') {
      sideLabel = 'LONG';
      sideClass = 'side-buy';
    } else if (item.side.toLowerCase() === 'sell') {
      sideLabel = 'SHORT';
      sideClass = 'side-sell';
    }
  }
  const mdSide = qs('#md-side');
  mdSide.textContent = sideLabel;
  mdSide.classList.remove('side-buy', 'side-sell');
  if (sideClass) mdSide.classList.add(sideClass);
  qs('#md-status').textContent = item.status_title || '—';
  qs('#md-qty').textContent = item.qty_tokens || '—';
  qs('#md-price').textContent = item.price || '—';
  qs('#md-created').textContent = fmtDate(item.created_at);
    qs('#md-close').textContent = item.close_rate || '—';


  const pnl = calcPnlUSD(kind, item);
  const mdPnl = qs('#md-pnl');
  mdPnl.textContent =
    pnl == null ? '—' : (pnl >= 0 ? '+' : '') + fmtUSDT(pnl);

  mdPnl.classList.remove('positive', 'negative');
  if (pnl != null) {
    mdPnl.classList.add(pnl >= 0 ? 'positive' : 'negative');
  }



  qs('#trade-modal').classList.add('show');

  const btn = qs('#md-close-order-btn');

  // Кнопка показывается только для ордеров
  if (kind === 'orders') {
    btn.style.display = 'block';

    // Активность по статусу
    if (String(item.status).toLowerCase() === 'monitoring') {
      btn.disabled = false;
    } else {
      btn.disabled = true;
    }
  } else {
    btn.style.display = 'none';
  }

  // обработчик
  btn.onclick = () => {
    if (btn.disabled) return;
    console.log(`[TRADE] Закрыть ордер: ${item.uuid}`);
  };
  qs('#md-show-json').onclick = () => {
  const json = JSON.stringify(item, null, 2);
  qs('#json-modal-content').textContent = json;
  qs('#json-modal').classList.add('show');
};
qs('#md-show-json').onclick = () => {
  const json = JSON.stringify(item, null, 2);
  qs('#json-modal-content').textContent = json;
  qs('#json-modal').classList.add('show');
};

}

function bindModal() {
  const tradeModal = qs('#trade-modal');
  const jsonModal = qs('#json-modal');
  const tradeDialog = qs('#trade-modal .modal-dialog');
  const jsonDialog = qs('#json-modal .modal-dialog');

  // ---- Основная модалка ----
  qs('#modal-close').onclick = () => {
    tradeModal.classList.remove('show');
    state.modal.open = false;
  };

  tradeModal.addEventListener('click', (e) => {
    // клик вне окна => закрыть
    if (!tradeDialog.contains(e.target)) {
      tradeModal.classList.remove('show');
      state.modal.open = false;
    }
  });

  // ---- JSON модалка ----
  qs('#json-modal-close').onclick = () => {
    jsonModal.classList.remove('show');
  };

  jsonModal.addEventListener('click', (e) => {
    if (!jsonDialog.contains(e.target)) {
      jsonModal.classList.remove('show');
    }
  });
}


/* ========================================
        WS — ПОДКЛЮЧЕНИЕ
======================================== */
function connectTradeWS() {
  setTradeWSStatus('yellow', 'Подключение...');

  const ws = new WebSocket(WS_TRADE_URL);

  ws.onopen = () => setTradeWSStatus('green', 'Подключено');
  ws.onclose = ws.onerror = () => setTradeWSStatus('red', 'Отключено');

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);

      if (msg.method === 'order_update' && msg.data)
        handleIncoming('orders', msg.data);

      if (msg.method === 'position_update' && msg.data)
        handleIncoming('positions', msg.data);

    } catch (err) {
      console.error('WS parse error:', err);
    }
  };

  state.wsTrade = ws;
}

/* ========================================
        ОБРАБОТКА ВХОДЯЩИХ ДАННЫХ
======================================== */
function handleIncoming(kind, item) {
  const list = kind === 'orders' ? state.ord.list : state.pos.list;
  const idx = list.findIndex((x) => String(x.id) === String(item.id));

  if (idx >= 0) list[idx] = { ...list[idx], ...item };
  else list.unshift(item);

  renderList(kind, list);

  // модалка?
  if (state.modal.open && state.modal.kind === kind && String(state.modal.id) === String(item.id)) {
    state.modal.item = { ...state.modal.item, ...item };
    updateModalLive();
  }
}
/* ========================================
        LIVE-ОБНОВЛЕНИЕ МОДАЛКИ
======================================== */
function updateModalLive() {
  const { kind, item } = state.modal;
  if (!item) return;

  qs('#md-status').textContent = item.status_title || '—';
  qs('#md-price').textContent = item.price || '—';
  qs('#md-qty').textContent = item.qty_tokens || '—';

  // LIVE цена
  qs('#md-live-price').textContent =
    state.price == null ? '—' : fmtUSDT(state.price, 2);

  const pnl = calcPnlUSD(kind, item);

  const mdPnl = qs('#md-pnl');
  mdPnl.textContent =
    pnl == null ? '—' : (pnl >= 0 ? '+' : '') + fmtUSDT(pnl);

  mdPnl.classList.remove('positive', 'negative');
  if (pnl != null) {
    mdPnl.classList.add(pnl >= 0 ? 'positive' : 'negative');
  }


  // Кнопка закрытия
  const btn = qs('#md-close-order-btn');
  if (kind === 'orders') {
    btn.style.display = 'block';
    btn.disabled = String(item.status).toLowerCase() !== 'monitoring';
  } else {
    btn.style.display = 'none';
  }
  const jsonModal = qs('#json-modal');
if (jsonModal.classList.contains('show')) {
  qs('#json-modal-content').textContent = JSON.stringify(item, null, 2);
}

}


/* ========================================
        ПОДКЛЮЧЕНИЕ LIVE-ЦЕНЫ ОТ ЧАРТА
======================================== */
async function attachChartPrice() {
  const chartCtx = window.chartCtx;
  if (!chartCtx) return console.warn('[TRADE] chartCtx отсутствует');

  const applyLivePrice = (close) => {
    state.price = Number(close);
    qs('#live-price').textContent = fmtUSDT(state.price, 2);

    if (state.activeTab === 'orders') renderList('orders', state.ord.list);
    if (state.activeTab === 'positions') renderList('positions', state.pos.list);

    if (state.modal.open) {
      updateModalLive();
    }
  };

  if (chartCtx?.allCandles?.length) {
    const last = chartCtx.allCandles.at(-1);
    if (last?.close) applyLivePrice(last.close);
  }

  const trySub = () => {
    if (chartCtx.subscribeToCandle) {
      chartCtx.subscribeToCandle((c) => {
        if (c?.close) applyLivePrice(c.close);
      });
      console.log('[TRADE] Live-candle подписка активна');
      return true;
    }
    return false;
  };

  if (!trySub()) {
    let attempts = 0;
    const timer = setInterval(() => {
      if (trySub() || ++attempts > 12) clearInterval(timer);
    }, 1000);
  }
}

/* ========================================
         BOOTSTRAP
======================================== */
async function bootstrap() {
  bindTabs();
  bindModal();
  bindPager();
  bindFilters();

  await loadExchangeSettings();
  await loadOrders();

  switchTab('orders');
  connectTradeWS();

  if (window.chartCtx) {
    attachChartPrice();
  } else {
    window.addEventListener('chartReady', attachChartPrice, { once: true });
  }
}

/* ========================================
        ПАГИНАЦИЯ
======================================== */
function updatePager(kind) {
  const obj = kind === 'orders' ? state.ord : state.pos;

  const page = Math.floor(obj.offset / obj.limit) + 1;
  const pages = Math.max(1, Math.ceil(obj.total / obj.limit));

  const prefix = kind === 'orders' ? 'ord' : 'pos';

  qs(`#${prefix}-page`).textContent = page;
  qs(`#${prefix}-pages`).textContent = pages;
  qs(`#${prefix}-total`).textContent = obj.total;

  qs(`#${prefix}-prev`).disabled = page <= 1;
  qs(`#${prefix}-next`).disabled = page >= pages;
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
  qs('#ord-prev').onclick = () => goPage('orders', -1);
  qs('#ord-next').onclick = () => goPage('orders', 1);

  qs('#pos-prev').onclick = () => goPage('positions', -1);
  qs('#pos-next').onclick = () => goPage('positions', 1);
}

/* ========================================
        ФИЛЬТРЫ
======================================== */
function bindFilters() {
  const btnApply = qs('#apply-filter');
  const btnReset = qs('#reset-filter');

  const fUuid = qs('#filter-uuid');
  const fSide = qs('#filter-side');
  const fStatus = qs('#filter-status');

  btnApply.onclick = async () => {
  try {
    state.filters.uuid = fUuid.value.trim();
    state.filters.side = fSide.value;
    state.filters.status = fStatus.value;

    state.ord.offset = 0;
    state.pos.offset = 0;

    if (state.activeTab === 'orders') await loadOrders();
    else await loadPositions();
  } catch {
    showToast('Ошибка применения фильтра');
  }
};


  btnReset.onclick = async () => {
  try {
    fUuid.value = '';
    fSide.value = '';
    fStatus.value = '';

    state.filters = { uuid: '', side: '', status: '' };
    state.ord.offset = 0;
    state.pos.offset = 0;

    if (state.activeTab === 'orders') await loadOrders();
    else await loadPositions();
  } catch {
    showToast('Ошибка сброса фильтра');
  }
};

}

/* ========================================
        FINISH INIT
======================================== */
window.addEventListener('load', bootstrap);
