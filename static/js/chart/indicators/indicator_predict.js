import { intervalToMs } from '../core/chart_utils.js';

export async function initPredictIndicators(ctx) {
  const candleSeries = ctx.candleSeries || ctx.series || ctx.candle;
  const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${wsScheme}://${window.location.host}/ws/signals/`;

  let ws = null;
  let reconnectTimer = null;
  const reconnectDelay = 5000;
  let lastUpdateTime = 0;

  const showRSI = document.getElementById('show-rsi');
  const showStochRSI = document.getElementById('show-stochrsi');

  // Храним линии по типу и направлению:  Map<key, { line, timeout }>
  // key = `${type}_${side}`  (пример: PREDICT.RSI_buy)
  const indicatorLines = new Map();

  function setStatus(color, text) {
    const dot = document.getElementById('ws-status-signals');
    const label = document.getElementById('ws-status-signals-text');
    if (!dot || !label) return;
    dot.className = `ws-dot ${color}`;
    label.textContent = text;
  }

  // === 🧠 Обновление линии (RSI или STOCH) ===
  function upsertIndicatorLine(type, side, targets, intervals) {
    if (!candleSeries || !targets.length) return;

    const key = `${type}_${side}`;
    const avg =
      targets.reduce((s, v) => s + (Number(v) || 0), 0) / targets.length;

    const isRSI = type === 'PREDICT.RSI';
    const color =
      side.toLowerCase() === 'buy'
        ? isRSI ? '#00cc66' : '#00bcd4'
        : isRSI ? '#ff3333' : '#ff9900';

    const labelBase = isRSI ? 'RSI' : 'StochRSI';
    const title = `${labelBase} ${side.toUpperCase()} (${intervals
      .sort((a, b) => a - b)
      .map((i) => `${i}m`)
      .join(', ')})`;

    // Удаляем старую линию
    if (indicatorLines.has(key)) {
      const old = indicatorLines.get(key);
      candleSeries.removePriceLine(old.line);
      clearTimeout(old.timeout);
      indicatorLines.delete(key);
    }

    const line = candleSeries.createPriceLine({
      price: avg,
      color,
      lineWidth: 2,
      lineStyle: 2, // пунктир
      axisLabelVisible: true,
      title,
    });

    const timeout = setTimeout(() => {
      if (indicatorLines.has(key)) {
        candleSeries.removePriceLine(line);
        indicatorLines.delete(key);
      }
    }, 5000);

    indicatorLines.set(key, { line, timeout });
  }

  // === 📡 Обработка сигналов ===
  function handleSignal(msg) {
    const { type, values } = msg;
    if (!values?.length) return;

    const isRSI = type === 'PREDICT.RSI';
    const isStoch = type === 'PREDICT.STOCH_RSI';

    if ((isRSI && !showRSI?.checked) || (isStoch && !showStochRSI?.checked))
      return;

    // группируем по side (buy/sell)
    const grouped = {};
    for (const v of values) {
      const side = (v.side || '').toLowerCase();
      if (!side) continue;
      const price = Number(v.target_rate);
      const interval = Number(v.interval || v.tf || v.i || v.timeframe || 1);
      if (!isFinite(price)) continue;

      if (!grouped[side]) grouped[side] = { targets: [], intervals: new Set() };
      grouped[side].targets.push(price);
      grouped[side].intervals.add(interval);
    }

    // обновляем или создаём линии для каждой стороны
    for (const [side, data] of Object.entries(grouped)) {
      upsertIndicatorLine(
        type,
        side,
        data.targets,
        Array.from(data.intervals)
      );
    }
  }

  // === 💾 чекбоксы + localStorage ===
  function bindToggles() {
    const savedRSI = localStorage.getItem('showRSI');
    const savedStoch = localStorage.getItem('showStochRSI');
    if (showRSI && savedRSI !== null) showRSI.checked = savedRSI === 'true';
    if (showStochRSI && savedStoch !== null)
      showStochRSI.checked = savedStoch === 'true';

    if (showRSI) {
      showRSI.addEventListener('change', () => {
        localStorage.setItem('showRSI', showRSI.checked);
        if (!showRSI.checked)
          for (const [key, { line, timeout }] of indicatorLines)
            if (key.startsWith('PREDICT.RSI')) {
              candleSeries.removePriceLine(line);
              clearTimeout(timeout);
              indicatorLines.delete(key);
            }
      });
    }

    if (showStochRSI) {
      showStochRSI.addEventListener('change', () => {
        localStorage.setItem('showStochRSI', showStochRSI.checked);
        if (!showStochRSI.checked)
          for (const [key, { line, timeout }] of indicatorLines)
            if (key.startsWith('PREDICT.STOCH_RSI')) {
              candleSeries.removePriceLine(line);
              clearTimeout(timeout);
              indicatorLines.delete(key);
            }
      });
    }
  }

  // === 🔌 WebSocket ===
  async function connect() {
    const timeEl = document.getElementById('ws-signals-last-update');
    clearTimeout(reconnectTimer);
    setStatus('yellow', 'Подключение...');
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[SIGNALS] Подключено');
      setStatus('green', 'Подключено');
    };

    ws.onerror = ws.onclose = () => {
      setStatus('red', 'Отключено');
      tryReconnect();
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        handleSignal(msg);
        lastUpdateTime = Date.now();
        if (timeEl) {
          timeEl.textContent = new Date().toLocaleTimeString();
          timeEl.classList.remove('stale');
        }
      } catch (err) {
        console.error('Ошибка сигналов:', err);
      }
    };
  }

  function tryReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      setStatus('yellow', 'Переподключение...');
      connect();
    }, reconnectDelay);
  }

  // === ⏱️ Проверка "старения" ===
  setInterval(() => {
    const timeEl = document.getElementById('ws-signals-last-update');
    const now = Date.now();
    if (timeEl && lastUpdateTime && now - lastUpdateTime > 30000) {
      timeEl.classList.add('stale');
      setStatus('gray', 'Нет обновлений');
    }
  }, 5000);

  bindToggles();
  await connect();
  ctx.wsPredict = ws;
}
