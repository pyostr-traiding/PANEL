import { debounce, intervalToMs } from '../core/chart_utils.js';

export function initPositionsModule(ctx) {
  const { chart, candleSeries } = ctx;
  const checkbox = document.getElementById('show-positions');

  let markers = [];
  let markersByBarTime = new Map();

  // === Tooltip ===
  const tooltip = document.createElement('div');
  Object.assign(tooltip.style, {
    position: 'absolute',
    display: 'none',
    background: 'rgba(25,25,25,0.95)',
    color: '#fff',
    padding: '8px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    pointerEvents: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
    zIndex: 1000,
  });
  document.body.appendChild(tooltip);

  // Находим существующую свечу для позиции
  function findCandleForPosition(klineMs) {
    const tf = intervalToMs(ctx.currentInterval);
    const candleStart = klineMs - (klineMs % tf);
    const barSec = Math.floor(candleStart / 1000);
    return ctx.allCandles.find(c => c.time === barSec) || null;
  }

  async function loadPositions(startMs, endMs) {
    if (!checkbox.checked) {
      candleSeries.setMarkers([]);
      return;
    }

    const url = `/api/position/search?range.start_ms=${startMs}&range.end_ms=${endMs}&range.symbol=${ctx.currentSymbol}`;
    const res = await fetch(url);
    const json = await res.json();
    const data = json.results || [];

    markersByBarTime.clear();
    markers = [];

    for (const p of data) {
      const candle = findCandleForPosition(Number(p.kline_ms));
      if (!candle) continue;

      const barSec = candle.time;

      if (!markersByBarTime.has(barSec)) markersByBarTime.set(barSec, []);
      markersByBarTime.get(barSec).push(p);

      markers.push({
        time: barSec,
        position: 'aboveBar',
        color: p.side === 'buy' ? '#4CAF50' : '#F44336',
        shape: p.side === 'buy' ? 'arrowUp' : 'arrowDown',
        text: p.side === 'buy' ? 'BUY' : 'SELL',
      });
    }

    candleSeries.setMarkers(markers);
  }

  const debouncedLoad = debounce(loadPositions, 250);

  // === ГЛАВНОЕ ИСПРАВЛЕНИЕ ===
  // НЕ logicalRange — он ломает отображение маркеров.
  chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
    if (!range) return;
    const startMs = range.from * 1000;
    const endMs = range.to * 1000;
    debouncedLoad(startMs, endMs);
  });

  checkbox.addEventListener('change', async () => {
    const range = chart.timeScale().getVisibleRange();
    if (!range) return;
    await loadPositions(range.from * 1000, range.to * 1000);
  });

  // Tooltip
  chart.subscribeCrosshairMove((param) => {
    if (!param.point || !param.time) {
      tooltip.style.display = 'none';
      return;
    }

    const barSec = Math.floor(param.time);
    const posData = markersByBarTime.get(barSec);

    if (!posData || posData.length === 0) {
      tooltip.style.display = 'none';
      return;
    }

    const html = posData
      .map(
        (p) => `
          <div style="margin-bottom:6px;">
            <b>${p.symbol}</b> (${p.category})<br>
            <span style="color:${p.side === 'buy' ? '#4CAF50' : '#F44336'};font-weight:bold;">
              ${p.side.toUpperCase()}
            </span><br>
            Цена: ${p.price}<br>
            Кол-во: ${p.qty_tokens}<br>
            Статус: ${p.status}
          </div>`
      )
      .join('<hr style="border:none;border-top:1px solid #444;margin:4px 0;">');

    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.style.left = `${param.point.x + 15}px`;
    tooltip.style.top = `${param.point.y + 15}px`;
  });

  // Делаем доступным в ctx
  ctx.loadPositions = loadPositions;
}
