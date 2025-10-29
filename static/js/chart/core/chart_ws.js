export function initSocket({ chart, candleSeries, currentSymbol, currentInterval }) {
  const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${wsScheme}://${window.location.host}/ws/kline/`);

  ws.onopen = () => console.log('✅ WebSocket подключен');
  ws.onclose = () => console.warn('❌ WebSocket закрыт');
  ws.onerror = () => console.error('⚠️ WebSocket ошибка');

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type !== 'kline_update') return;
      const { symbol, interval, data } = msg.data;
      if (symbol !== currentSymbol || String(interval) !== currentInterval) return;
      const candle = {
        time: data.ts / 1000,
        open: parseFloat(data.o),
        high: parseFloat(data.h),
        low: parseFloat(data.l),
        close: parseFloat(data.c),
      };
      candleSeries.update(candle);
    } catch (err) {
      console.error('WS parse error', err);
    }
  };
}
