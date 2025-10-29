// === === === TRADINGVIEW LIGHTWEIGHT CHART: INDICATOR CHART === === ===

// Элементы
const chartEl = document.getElementById('chart-container');
const infoPanel = document.getElementById('chart-info');
const intervalSelect = document.getElementById('interval-select');
const pairSelect = document.getElementById('pair-select');
const showPositionsCheckbox = document.getElementById('show-positions'); // ✅ чекбокс

// === Настройки графика ===
const chart = LightweightCharts.createChart(chartEl, {
  layout: {
    background: {
      color:
        getComputedStyle(document.body).getPropertyValue('--panel-bg')?.trim() ||
        '#131722',
    },
    textColor:
      getComputedStyle(document.body).getPropertyValue('--text-color')?.trim() ||
      '#d1d4dc',
  },
  grid: {
    vertLines: { color: '#2B2B43' },
    horzLines: { color: '#2B2B43' },
  },
  crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#485c7b' },
  timeScale: {
    borderColor: '#485c7b',
    timeVisible: true,
    secondsVisible: false,
  },
});

const candleSeries = chart.addCandlestickSeries({
  upColor: '#26a69a',
  borderUpColor: '#26a69a',
  wickUpColor: '#26a69a',
  downColor: '#ef5350',
  borderDownColor: '#ef5350',
  wickDownColor: '#ef5350',
});

// === Стили инфо-панели ===
if (infoPanel) {
  infoPanel.style.position = 'absolute';
  infoPanel.style.top = '10px';
  infoPanel.style.left = '15px';
  infoPanel.style.color = '#e0e0e0';
  infoPanel.style.fontFamily = 'monospace';
  infoPanel.style.fontSize = '13px';
  infoPanel.style.background = 'rgba(0,0,0,0.45)';
  infoPanel.style.padding = '6px 10px';
  infoPanel.style.borderRadius = '6px';
  infoPanel.style.pointerEvents = 'none';
  infoPanel.style.userSelect = 'none';
  infoPanel.style.zIndex = '10';
  infoPanel.style.transition = 'background-color 0.3s, color 0.3s';
}

// === Tooltip для позиций (кастомный)
const posTooltip = document.createElement('div');
posTooltip.style.position = 'absolute';
posTooltip.style.background = 'rgba(20,20,20,0.95)';
posTooltip.style.color = '#e0e0e0';
posTooltip.style.font = '12px/1.3 monospace';
posTooltip.style.padding = '8px 10px';
posTooltip.style.border = '1px solid #333';
posTooltip.style.borderRadius = '6px';
posTooltip.style.pointerEvents = 'none';
posTooltip.style.zIndex = '20';
posTooltip.style.display = 'none';
posTooltip.style.maxWidth = '260px';
posTooltip.style.whiteSpace = 'pre-wrap';
posTooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
chartEl.parentElement.style.position = 'relative';
chartEl.parentElement.appendChild(posTooltip);

// === Глобальные переменные ===
let currentSymbol = 'BTCUSDT';
let currentInterval = '1';
let ws = null;
let earliestTime = null;
let isLoadingMore = false;
let noMoreHistory = false;
let allCandles = [];
let lastCandle = null;
let isCrosshairActive = false;
let lastClosePrice = null;

// позиции
let rawPositions = [];     // как пришли с бэка (client_ms)
let alignedMarkers = [];   // маркеры, выровненные под текущий интервал
let markersByBarTime = new Map(); // time(sec) -> массив позиций для tooltip

// === Конвертация интервала в миллисекунды ===
function intervalToMs(intervalStr) {
  const n = parseInt(intervalStr, 10);
  if (!Number.isNaN(n)) return n * 60 * 1000;
  if (intervalStr === 'D') return 24 * 60 * 60 * 1000;
  if (intervalStr === 'W') return 7 * 24 * 60 * 60 * 1000;
  if (intervalStr === 'M') return 30 * 24 * 60 * 60 * 1000;
  return 60 * 1000;
}

// === Выравнивание минутного client_ms в старт бара выбранного ТФ
function alignClientMsToIntervalBarStart(clientMs, intervalStr) {
  const tfMs = intervalToMs(intervalStr);
  return Math.floor(clientMs / tfMs) * tfMs; // бар начинается ровно тут
}

// === UI-индикатор статуса ===
function setStatus(color, text) {
  const statusEl = document.getElementById('ws-status');
  const textEl = document.getElementById('ws-status-text');
  if (!statusEl || !textEl) return;
  statusEl.className = `status ${color}`;
  textEl.textContent = text;
}

// === WebSocket соединение ===
function connectSocket() {
  if (ws) ws.close();

  const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${wsScheme}://${window.location.host}/ws/kline/`);

  setStatus('yellow', 'Подключение...');

  ws.onopen = () => setStatus('green', 'Подключено');
  ws.onclose = () => setStatus('red', 'Отключено');
  ws.onerror = () => setStatus('red', 'Ошибка');

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type !== 'kline_update') return;

      const { symbol, interval, data } = msg.data;
      if (symbol !== currentSymbol || String(interval) !== currentInterval)
        return;

      const candle = {
        time: data.ts / 1000,
        open: parseFloat(data.o),
        high: parseFloat(data.h),
        low: parseFloat(data.l),
        close: parseFloat(data.c),
        volume: parseFloat(data.v ?? 0),
      };

      lastCandle = candle;
      candleSeries.update(candle);

      const lastIndex = allCandles.findIndex((c) => c.time === candle.time);
      if (lastIndex >= 0) {
        allCandles[lastIndex] = candle;
      } else {
        allCandles.push(candle);
      }

      if (!isCrosshairActive) updateInfoPanel(candle);
    } catch (e) {
      console.error('WS parse error', e);
    }
  };
}

// === Загрузка истории свечей ===
async function loadHistory(symbol, interval) {
  setStatus('yellow', 'Загрузка данных...');
  noMoreHistory = false;

  const category = 'linear';
  const url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol}&interval=${interval}&limit=1000`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (!json.result || !json.result.list) {
      console.error('Ошибка загрузки свечей', json);
      return;
    }

    const candles = json.result.list
      .map((item) => ({
        time: parseInt(item[0]) / 1000,
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5] ?? 0),
      }))
      .reverse();

    if (candles.length === 0) {
      console.warn('Свечи не найдены.');
      return;
    }

    allCandles = candles;
    earliestTime = candles[0].time * 1000;
    candleSeries.setData(allCandles);
    lastCandle = candles[candles.length - 1];
    lastClosePrice = lastCandle.close;

    updateInfoPanel(lastCandle);
    setStatus('green', 'Подключено');
  } catch (err) {
    console.error('Ошибка загрузки истории:', err);
  }
}

// === Подгрузка старых свечей ===
async function loadMoreHistory() {
  if (isLoadingMore || !earliestTime || noMoreHistory) return;
  isLoadingMore = true;

  const category = 'linear';
  const endMs = earliestTime - intervalToMs(currentInterval) - 1;

  const url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${currentSymbol}&interval=${currentInterval}&end=${endMs}&limit=1000`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (!json.result || !json.result.list || json.result.list.length === 0) {
      console.warn('Больше нет данных.');
      noMoreHistory = true;
      isLoadingMore = false;
      return;
    }

    const candles = json.result.list
      .map((item) => ({
        time: parseInt(item[0]) / 1000,
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5] ?? 0),
      }))
      .reverse();

    earliestTime = candles[0].time * 1000;
    allCandles = [...candles, ...allCandles];
    candleSeries.setData(allCandles);

    console.log(`Добавлено ${candles.length} свечей, всего: ${allCandles.length}`);
  } catch (err) {
    console.error('Ошибка подгрузки истории:', err);
  }

  isLoadingMore = false;
}

// === Загрузка позиций по видимому диапазону ===
const loadPositionsDebounced = debounce(loadPositions, 250);

async function loadPositions(startMs, endMs) {
  if (!showPositionsCheckbox || !showPositionsCheckbox.checked) {
    clearPositionMarkers();
    return;
  }
  if (!currentSymbol) return;

  const url = `/api/position/search?start_ms=${startMs}&end_ms=${endMs}&symbol=${encodeURIComponent(currentSymbol)}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    rawPositions = Array.isArray(json.results) ? json.results : [];

    // Преобразуем в маркеры под текущий ТФ
    alignedMarkers = [];
    markersByBarTime.clear();

    for (const p of rawPositions) {
      const clientMs = Number(p.kline_ms);      // 1m time
      const barStartMs = alignClientMsToIntervalBarStart(clientMs, currentInterval);
      const barTimeSec = Math.floor(barStartMs / 1000);

      const marker = {
        time: barTimeSec,
        position: 'aboveBar',
        color: p.side === 'buy' ? '#4CAF50' : '#F44336',
        shape: p.side === 'buy' ? 'arrowUp' : 'arrowDown',
        text: `POS`, // короткий текст над свечой
      };
      alignedMarkers.push(marker);

      // для tooltip собираем список по времени бара
      if (!markersByBarTime.has(barTimeSec)) markersByBarTime.set(barTimeSec, []);
      markersByBarTime.get(barTimeSec).push(p);
    }

    candleSeries.setMarkers(alignedMarkers);
  } catch (err) {
    console.error('Ошибка загрузки позиций:', err);
  }
}

function clearPositionMarkers() {
  alignedMarkers = [];
  markersByBarTime.clear();
  candleSeries.setMarkers([]);
  hidePosTooltip();
}

// === Tooltip по позициям ===
function showPosTooltip(html, x, y) {
  posTooltip.innerHTML = html;
  posTooltip.style.left = Math.max(8, x - posTooltip.offsetWidth / 2) + 'px';
  posTooltip.style.top = Math.max(8, y - posTooltip.offsetHeight - 8) + 'px';
  posTooltip.style.display = 'block';
}

function hidePosTooltip() {
  posTooltip.style.display = 'none';
}

// === Обновление инфо-панели ===
function updateInfoPanel(candle) {
  if (!infoPanel || !candle) return;

  const open = parseFloat(candle.open ?? candle.value ?? 0);
  const high = parseFloat(candle.high ?? candle.value ?? open);
  const low = parseFloat(candle.low ?? candle.value ?? open);
  const close = parseFloat(candle.close ?? candle.value ?? open);
  const volume = parseFloat(candle.volume ?? 0);

  const date =
    candle.time && !isNaN(candle.time)
      ? new Date(candle.time * 1000).toISOString().replace('T', ' ').split('.')[0]
      : '-';

  const priceColor =
    close > open ? '#4CAF50' : close < open ? '#F44336' : '#e0e0e0';

  // стрелка + фон при апдейте
  let arrow = '';
  let highlight = '';
  if (lastClosePrice !== null) {
    if (close > lastClosePrice) { arrow = '▲'; highlight = 'rgba(76,175,80,0.15)'; }
    else if (close < lastClosePrice) { arrow = '▼'; highlight = 'rgba(244,67,54,0.15)'; }
  }
  infoPanel.style.background = highlight || 'rgba(0,0,0,0.45)';
  infoPanel.style.transition = 'background 0.5s ease';
  infoPanel.style.opacity = isCrosshairActive ? '0.9' : '1';

  infoPanel.innerHTML = `
    <div><b>${currentSymbol}</b> (${currentInterval}m)</div>
    <div>${date} UTC</div>
    <div>
      O: ${open.toFixed(2)} &nbsp;
      H: ${high.toFixed(2)} &nbsp;
      L: ${low.toFixed(2)} &nbsp;
      C: <span style="color:${priceColor}">${close.toFixed(2)} ${arrow}</span> &nbsp;
      V: ${volume.toFixed(2)}
    </div>
  `;

  lastClosePrice = close;
}

// === Наведение курсора (OHLC + позиции) ===
chart.subscribeCrosshairMove((param) => {
  if (!param || !param.time || !param.seriesData.size) {
    isCrosshairActive = false;
    updateInfoPanel(lastCandle);
    hidePosTooltip();
    return;
  }

  isCrosshairActive = true;
  const data = param.seriesData.get(candleSeries);
  if (data) updateInfoPanel(data);

  // показываем tooltip по позициям, если есть в этот бар
  const barTimeSec = Number(param.time);
  const barPositions = markersByBarTime.get(barTimeSec);
  if (barPositions && barPositions.length > 0) {
    const html = buildPositionsTooltip(barPositions);
    // позиционируем у курсора
    if (param.point) {
      const rect = chartEl.getBoundingClientRect();
      const x = rect.left + window.scrollX + param.point.x;
      const y = rect.top + window.scrollY + param.point.y;
      showPosTooltip(html, x, y);
    } else {
      hidePosTooltip();
    }
  } else {
    hidePosTooltip();
  }
});

// === Tooltip HTML
function buildPositionsTooltip(items) {
  // несколько позиций в одной свече — покажем списком
  const rows = items.map((p) => {
    const sideClr = p.side === 'buy' ? '#4CAF50' : '#F44336';
    const time = new Date(Number(p.kline_ms)).toISOString().replace('T',' ').split('.')[0];
    return `
      <div style="margin-bottom:6px;">
        <div><b style="color:${sideClr}">${p.side.toUpperCase()}</b> ${p.symbol}</div>
        <div>Price: ${p.price}</div>
        <div>Qty: ${p.qty_tokens}</div>
        <div>Time: ${time} UTC</div>
        <div>Status: ${p.status}</div>
        <div style="font-size:11px;color:#9aa;">UUID: ${p.uuid}</div>
      </div>
    `;
  }).join('<hr style="border:none;border-top:1px solid #333;margin:6px 0;">');

  return `<div style="min-width:180px;">${rows}</div>`;
}

// === Скролл/зум: подгрузка истории и позиций ===
chart.timeScale().subscribeVisibleLogicalRangeChange(async (range) => {
  if (!range) return;

  // подгрузка старых свечей
  if (!isLoadingMore && !noMoreHistory && range.from < 10) {
    loadMoreHistory();
  }

  // диапазон баров -> миллисекунды
  const vis = candleSeries.barsInLogicalRange(range);
  if (!vis || !vis.from || !vis.to) return;

  const startMs = Number(vis.from.time) * 1000;
  const endMs = Number(vis.to.time) * 1000;

  // подгружаем позиции с дебаунсом
  loadPositionsDebounced(startMs, endMs);
});

// === Чекбокс "Показывать позиции" ===
if (showPositionsCheckbox) {
  showPositionsCheckbox.addEventListener('change', () => {
    if (!showPositionsCheckbox.checked) {
      clearPositionMarkers();
      return;
    }
    // загрузим по текущему видимому диапазону
    const range = chart.timeScale().getVisibleLogicalRange();
    const vis = range ? candleSeries.barsInLogicalRange(range) : null;
    if (vis && vis.from && vis.to) {
      loadPositions(Number(vis.from.time) * 1000, Number(vis.to.time) * 1000);
    }
  });
}

// === Смена пары/интервала ===
intervalSelect.addEventListener('change', async (e) => {
  currentInterval = e.target.value;
  noMoreHistory = false;
  allCandles = [];
  earliestTime = null;
  candleSeries.setData([]);
  clearPositionMarkers();
  if (ws) ws.close();
  await loadHistory(currentSymbol, currentInterval);
  connectSocket();

  // если чекбокс включён — перезагрузить позиции
  if (showPositionsCheckbox?.checked) {
    const range = chart.timeScale().getVisibleLogicalRange();
    const vis = range ? candleSeries.barsInLogicalRange(range) : null;
    if (vis && vis.from && vis.to) {
      loadPositions(Number(vis.from.time) * 1000, Number(vis.to.time) * 1000);
    }
  }
});

pairSelect.addEventListener('change', async (e) => {
  currentSymbol = e.target.value;
  noMoreHistory = false;
  allCandles = [];
  earliestTime = null;
  candleSeries.setData([]);
  clearPositionMarkers();
  if (ws) ws.close();
  await loadHistory(currentSymbol, currentInterval);
  connectSocket();

  if (showPositionsCheckbox?.checked) {
    const range = chart.timeScale().getVisibleLogicalRange();
    const vis = range ? candleSeries.barsInLogicalRange(range) : null;
    if (vis && vis.from && vis.to) {
      loadPositions(Number(vis.from.time) * 1000, Number(vis.to.time) * 1000);
    }
  }
});

// === Инициализация ===
(async () => {
  await loadHistory(currentSymbol, currentInterval);
  connectSocket();

  // при старте — если включены позиции, подгрузить по видимому диапазону
  if (showPositionsCheckbox?.checked) {
    const range = chart.timeScale().getVisibleLogicalRange();
    const vis = range ? candleSeries.barsInLogicalRange(range) : null;
    if (vis && vis.from && vis.to) {
      loadPositions(Number(vis.from.time) * 1000, Number(vis.to.time) * 1000);
    }
  }
})();

// === Очистка при закрытии ===
window.addEventListener('beforeunload', () => {
  if (ws) ws.close();
});

// === Хелперы ===
function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
