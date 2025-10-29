// === === === TRADINGVIEW LIGHTWEIGHT CHART: INDICATOR CHART === === ===

// Элементы
const chartEl = document.getElementById('chart-container');
const infoPanel = document.getElementById('chart-info');
const intervalSelect = document.getElementById('interval-select');
const pairSelect = document.getElementById('pair-select');

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
let lastClosePrice = null; // 👈 для отслеживания изменений цены

// === Конвертация интервала в миллисекунды ===
function intervalToMs(intervalStr) {
  const n = parseInt(intervalStr, 10);
  if (!Number.isNaN(n)) return n * 60 * 1000;
  if (intervalStr === 'D') return 24 * 60 * 60 * 1000;
  if (intervalStr === 'W') return 7 * 24 * 60 * 60 * 1000;
  if (intervalStr === 'M') return 30 * 24 * 60 * 60 * 1000;
  return 60 * 1000;
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

  // === Добавляем стрелку и анимацию ===
  let arrow = '';
  let highlight = '';

  if (lastClosePrice !== null) {
    if (close > lastClosePrice) {
      arrow = '▲';
      highlight = 'rgba(76,175,80,0.15)';
    } else if (close < lastClosePrice) {
      arrow = '▼';
      highlight = 'rgba(244,67,54,0.15)';
    }
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

// === Наведение курсора ===
chart.subscribeCrosshairMove((param) => {
  if (!param || !param.time || !param.seriesData.size) {
    isCrosshairActive = false;
    updateInfoPanel(lastCandle);
    return;
  }

  isCrosshairActive = true;
  const data = param.seriesData.get(candleSeries);
  if (data) updateInfoPanel(data);
});

// === Скролл влево ===
chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
  if (!range || isLoadingMore || noMoreHistory) return;
  if (range.from < 10) {
    console.log('Подгружаем предыдущие свечи...');
    loadMoreHistory();
  }
});

// === Смена пары/интервала ===
intervalSelect.addEventListener('change', async (e) => {
  currentInterval = e.target.value;
  noMoreHistory = false;
  allCandles = [];
  earliestTime = null;
  candleSeries.setData([]);
  if (ws) ws.close();
  await loadHistory(currentSymbol, currentInterval);
  connectSocket();
});

pairSelect.addEventListener('change', async (e) => {
  currentSymbol = e.target.value;
  noMoreHistory = false;
  allCandles = [];
  earliestTime = null;
  candleSeries.setData([]);
  if (ws) ws.close();
  await loadHistory(currentSymbol, currentInterval);
  connectSocket();
});

// === Инициализация ===
(async () => {
  await loadHistory(currentSymbol, currentInterval);
  connectSocket();
})();

// === Очистка при закрытии ===
window.addEventListener('beforeunload', () => {
  if (ws) ws.close();
});
