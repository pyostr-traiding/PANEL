import { debounce, alignClientMsToIntervalBarStart } from '../core/chart_utils.js';

export function initPositionsModule(ctx) {
  const { chart, candleSeries, currentSymbol, currentInterval, getVisibleRange } = ctx;
  const checkbox = document.getElementById('show-positions');
  let markers = [];
  let markersByBarTime = new Map();

  // === создаем всплывающее окно ===
  const tooltip = document.createElement('div');
  tooltip.style.position = 'absolute';
  tooltip.style.display = 'none';
  tooltip.style.background = 'rgba(25, 25, 25, 0.95)';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '8px 10px';
  tooltip.style.borderRadius = '8px';
  tooltip.style.fontSize = '12px';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
  tooltip.style.zIndex = 1000;
  document.body.appendChild(tooltip);

  async function loadPositions(startMs, endMs) {
    if (!checkbox.checked) {
      candleSeries.setMarkers([]);
      return;
    }

    const url = `/api/position/search?range.start_ms=${startMs}&range.end_ms=${endMs}&range.symbol=${currentSymbol}`;
    const res = await fetch(url);
    const json = await res.json();
    const data = json.results || [];

    markersByBarTime.clear();

    markers = data.map((p) => {
      const barMs = alignClientMsToIntervalBarStart(Number(p.kline_ms), currentInterval);
      const barSec = Math.floor(barMs / 1000);
      if (!markersByBarTime.has(barSec)) markersByBarTime.set(barSec, []);
      markersByBarTime.get(barSec).push(p);
      return {
        time: barSec,
        position: 'aboveBar',
        color: p.side === 'buy' ? '#4CAF50' : '#F44336',
        shape: p.side === 'buy' ? 'arrowUp' : 'arrowDown',
        text: p.side === 'buy' ? 'BUY' : 'SELL',
      };
    });

    candleSeries.setMarkers(markers);
  }

  const debouncedLoad = debounce(loadPositions, 250);

  chart.timeScale().subscribeVisibleLogicalRangeChange(async (range) => {
    const vis = getVisibleRange(range);
    debouncedLoad(vis.startMs, vis.endMs);
  });

  checkbox.addEventListener('change', async () => {
    const vis = getVisibleRange(chart.timeScale().getVisibleLogicalRange());
    await loadPositions(vis.startMs, vis.endMs);
  });

  // === Обработка наведения курсора ===
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

    // Формируем красивый HTML
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
}
