// chart_ws.js — анти-разрывная версия
import { alignClientMsToIntervalBarStart, intervalToMs } from './chart_utils.js';

export function initSocket(ctx) {
  const { chart, candleSeries } = ctx;
  const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${wsScheme}://${window.location.host}/ws/kline/`);

  // === UI-индикатор состояния соединения ===
  function setStatus(color, text) {
    const statusEl = document.getElementById('ws-status');
    const textEl = document.getElementById('ws-status-text');
    if (!statusEl || !textEl) return;
    statusEl.className = `status ${color}`;
    textEl.textContent = text;
  }

  setStatus('yellow', 'Подключение...');
  ws.onopen = () => setStatus('green', 'Подключено');
  ws.onclose = () => setStatus('red', 'Отключено');
  ws.onerror = () => setStatus('red', 'Ошибка');

  // === Подписки на внешние слушатели ===
  ctx._subscribers = ctx._subscribers || new Set();
  ctx.subscribeToCandle = (cb) => ctx._subscribers.add(cb);
  ctx.unsubscribeFromCandle = (cb) => ctx._subscribers.delete(cb);

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type !== 'kline_update') return;

      const { symbol, interval, data } = msg.data;
      // Важно: сравниваем с ТЕКУЩИМИ ctx-значениями (а не со снятым снимком)
      if (symbol !== ctx.currentSymbol || String(interval) !== ctx.currentInterval) return;

      // 1) Забираем метку времени из WS
      let tsRaw = data.ts ?? data.t ?? data.time;
      if (typeof tsRaw === 'object') tsRaw = Object.values(tsRaw)[0];
      const tsNum = Number(tsRaw);
      if (!tsNum || isNaN(tsNum)) return;

      // 2) Выравниваем к началу бара
      const tfMs = intervalToMs(ctx.currentInterval);
      let alignedMs = alignClientMsToIntervalBarStart(tsNum, ctx.currentInterval);
      let timeSec = Math.floor(alignedMs / 1000);

      // 3) «Прищёлкивание» к последнему бару
      // Если апдейт пришёл с меткой внутри ТЕКУЩЕГО бара (±дрожь),
      // но из-за округления у нас получился другой слот — исправляем на последний бар.
      const last = ctx.allCandles?.[ctx.allCandles.length - 1];
      if (last) {
        const lastStartMs = last.time * 1000;
        const nextStartMs = lastStartMs + tfMs;

        // Если выравнивание дало след.бар, но реальное ts всё ещё < nextStartMs — это всё ещё текущий бар.
        if (alignedMs === nextStartMs && tsNum < nextStartMs) {
          alignedMs = lastStartMs;
          timeSec = Math.floor(alignedMs / 1000);
        }

        // Если по какой-то причине выравнивание дало старый бар, а реальный ts уже >= nextStartMs — это новый бар.
        if (alignedMs === lastStartMs && tsNum >= nextStartMs) {
          alignedMs = nextStartMs;
          timeSec = Math.floor(alignedMs / 1000);
        }
      }

      // 4) Формируем свечу (без объёма, как просил)
      const incoming = {
        time: timeSec,
        open: parseFloat(data.o),
        high: parseFloat(data.h),
        low: parseFloat(data.l),
        close: parseFloat(data.c),
        // volume исключаем из логики, не учитываем
      };
      if (
        !isFinite(incoming.open) ||
        !isFinite(incoming.high) ||
        !isFinite(incoming.low) ||
        !isFinite(incoming.close)
      ) {
        return; // защита от мусорных значений
      }

      // 5) Обновляем/добавляем
      if (!last) {
        ctx.allCandles = [incoming];
        candleSeries.setData([incoming]); // только один раз, когда данных ещё нет
      } else if (timeSec === last.time) {
        // Текущий бар: экстремумы только расширяем, close — текущее значение
        const merged = {
          ...last,
          high: Math.max(last.high, incoming.high),
          low: Math.min(last.low, incoming.low),
          close: incoming.close,
        };
        ctx.allCandles[ctx.allCandles.length - 1] = merged;
        candleSeries.update(merged);
      } else if (timeSec > last.time) {
        // Новый бар: добавляем
        ctx.allCandles.push(incoming);
        candleSeries.update(incoming);
        chart.timeScale().scrollToRealTime();
      } else {
        // Старый бар — игнор
        return;
      }

      // 6) Уведомляем подписчиков (инфо-панель и т.п.)
      ctx._subscribers.forEach((cb) => cb(ctx.allCandles[ctx.allCandles.length - 1]));
    } catch (err) {
      console.error('WS parse error', err);
    }
  };

  ctx.ws = ws;
  return ws;
}
