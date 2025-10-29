import { debounce, alignClientMsToIntervalBarStart } from '../core/chart_utils.js';

export function initPositionsModule(ctx) {
  const { chart, candleSeries, currentSymbol, currentInterval, getVisibleRange } = ctx;
  const checkbox = document.getElementById('show-positions');
  let markers = [];
  let markersByBarTime = new Map();

  async function loadPositions(startMs, endMs) {
    if (!checkbox.checked) {
      candleSeries.setMarkers([]);
      return;
    }
    const url = `/api/position/search?range.start_ms=${startMs}&range.end_ms=${endMs}&range.symbol=${currentSymbol}`;
    const res = await fetch(url);
    const json = await res.json();
    const data = json.results || [];

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
        text: 'POS',
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
}
