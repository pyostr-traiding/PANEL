import { intervalToMs } from './chart_utils.js';

export async function initSocket(ctx) {
  const { chart, candleSeries } = ctx;
  const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${wsScheme}://${window.location.host}/ws/kline/`;

  let ws = null;
  let reconnectTimer = null;
  const reconnectDelay = 5000;
  let lastUpdateTime = 0;
  let manuallyClosed = false;
  let historyLoaded = false;

  // Ждём появления элементов статуса
  const waitForElement = (id, timeout = 2000) =>
    new Promise((resolve) => {
      const el = document.getElementById(id);
      if (el) return resolve(true);
      const observer = new MutationObserver(() => {
        if (document.getElementById(id)) {
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, timeout);
    });

  function setStatus(color, text) {
    const ids = [
      ['ws-status-kline', 'ws-status-kline-text'],
      ['ws-status', 'ws-status-text'],
    ];
    for (const [dotId, labelId] of ids) {
      const dot = document.getElementById(dotId);
      const label = document.getElementById(labelId);
      if (!dot || !label) continue;
      dot.className = dot.classList.contains('ws-dot')
        ? `ws-dot ${color}`
        : `status ${color}`;
      label.textContent = text;
    }
  }

  async function connect() {
    await waitForElement('ws-status-kline');
    const timeEl = document.getElementById('ws-kline-last-update');

    // закрываем старый сокет
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      manuallyClosed = true;
      try { ws.close(); } catch {}
      manuallyClosed = false;
    }

    clearTimeout(reconnectTimer);
    setStatus('yellow', 'Подключение...');
    ws = new WebSocket(url);
    ctx.ws = ws;

    ws.onopen = () => {
      console.log('[WS] Подключено');
      setStatus('green', 'Подключено');
      historyLoaded = false;
    };

    ws.onclose = ws.onerror = (e) => {
      if (!manuallyClosed) {
        console.warn('[WS] Потеряно соединение', e);
        setStatus('red', 'Отключено');
        tryReconnect();
      }
    };

    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type !== 'kline_update') return;

        const { symbol, interval, data } = msg.data;
        const currentInterval = String(ctx.currentInterval).trim();
        const incomingInterval = String(interval).trim();

        if (symbol !== ctx.currentSymbol || incomingInterval !== currentInterval) return;

        // 🔥 берём реальное время свечи напрямую (не выравниваем!)
        const tsNum = Number(data.ts ?? data.t ?? data.time);
        if (!tsNum) return;
        const timeSec = Math.floor(tsNum / 1000);

        const incoming = {
          time: timeSec,
          open: parseFloat(data.o),
          high: parseFloat(data.h),
          low: parseFloat(data.l),
          close: parseFloat(data.c),
        };
        if (Object.values(incoming).some((v) => !isFinite(v))) return;

        // === первая свеча — загружаем историю ===
        if (!historyLoaded) {
          historyLoaded = true;
          console.log('[WS] Первая свеча получена, загружаем историю...');
          await ctx.loadHistory(ctx.currentSymbol, ctx.currentInterval);
          if (ctx.allCandles?.length) {
            candleSeries.setData(ctx.allCandles);
            chart.timeScale().scrollToRealTime();
            console.log(`[WS] История загружена (${ctx.allCandles.length} свечей)`);
          } else {
            console.warn('[WS] История не загрузилась');
          }
        }

        const last = ctx.allCandles?.[ctx.allCandles.length - 1];
        if (!last) {
          ctx.allCandles = [incoming];
          candleSeries.setData([incoming]);
          return;
        }

        const diff = incoming.time - last.time;

        // 🔧 если свеча почти та же (допуск ±2 сек)
        if (Math.abs(diff) < 2) {
          const merged = {
            ...last,
            high: Math.max(last.high, incoming.high),
            low: Math.min(last.low, incoming.low),
            close: incoming.close,
          };
          ctx.allCandles[ctx.allCandles.length - 1] = merged;
          candleSeries.update(merged);
        }
        // 🔧 если новая свеча
        else if (diff > 0) {
          ctx.allCandles.push(incoming);
          candleSeries.update(incoming);
          chart.timeScale().scrollToRealTime();
        }
        // 🔧 если что-то отстало (например, reconnect)
        else if (diff < -2) {
          console.warn('[WS] Получена свеча старее последней:', incoming, last);
        }

        ctx._subscribers?.forEach((cb) => cb(ctx.allCandles.at(-1)));

        lastUpdateTime = Date.now();
        if (timeEl) {
          timeEl.textContent = new Date().toLocaleTimeString();
          timeEl.classList.remove('stale');
        }
      } catch (err) {
        console.error('[WS ERROR]', err);
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

  // Проверка “старения”
  setInterval(() => {
    const timeEl = document.getElementById('ws-kline-last-update');
    const now = Date.now();
    if (timeEl && lastUpdateTime && now - lastUpdateTime > 30000) {
      timeEl.classList.add('stale');
      setStatus('gray', 'Нет обновлений');
    }
  }, 5000);

  if (!ctx._subscribers) ctx._subscribers = [];
  ctx.subscribeToCandle = (callback) => {
    if (typeof callback === 'function') ctx._subscribers.push(callback);
  };

  await connect();
}
