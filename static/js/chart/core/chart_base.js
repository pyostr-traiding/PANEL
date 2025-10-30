import { intervalToMs } from './chart_utils.js';

export async function initBaseChart() {
  const chartEl = document.getElementById('chart-container');

  // 🔥 Берём цвета из CSS-переменных
  const getColor = (name, fallback) =>
    getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim() || fallback;

  const chart = LightweightCharts.createChart(chartEl, {
    layout: {
      background: { color: getColor('--panel-bg', '#ffffff') },
      textColor: getColor('--text-color', '#111'),
    },
    grid: {
      vertLines: { color: getColor('--border-color', '#dcdcdc') },
      horzLines: { color: getColor('--border-color', '#dcdcdc') },
    },
    rightPriceScale: { borderColor: getColor('--border-color', '#dcdcdc') },
    timeScale: { borderColor: getColor('--border-color', '#dcdcdc'), timeVisible: true },
  });

  chart.timeScale().applyOptions({
    rightOffset: 5,
    barSpacing: 6,
    rightBarStaysOnScroll: true,
  });

  chart.timeScale().scrollToRealTime();

  const candleSeries = chart.addCandlestickSeries({
    upColor: '#26a69a',
    borderUpColor: '#26a69a',
    wickUpColor: '#26a69a',
    downColor: '#ef5350',
    borderDownColor: '#ef5350',
    wickDownColor: '#ef5350',
  });

  // === 💡 Реагируем на смену темы ===
  window.addEventListener('themeChanged', () => {
    chart.applyOptions({
      layout: {
        background: { color: getColor('--panel-bg', '#ffffff') },
        textColor: getColor('--text-color', '#111'),
      },
      grid: {
        vertLines: { color: getColor('--border-color', '#dcdcdc') },
        horzLines: { color: getColor('--border-color', '#dcdcdc') },
      },
      rightPriceScale: { borderColor: getColor('--border-color', '#dcdcdc') },
      timeScale: { borderColor: getColor('--border-color', '#dcdcdc') },
    });
  });

  // === Состояние ===
  let currentSymbol = 'BTCUSDT';
  let currentInterval = '1';
  let earliestTime = null;
  let allCandles = [];
  let noMoreHistory = false;
  let isLoadingMore = false;

  async function loadHistory(symbol = currentSymbol, interval = currentInterval) {
    const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=1000`;
    const res = await fetch(url);
    const json = await res.json();

    if (!json.result?.list?.length) {
      console.warn('Свечи не найдены', json);
      return [];
    }

    const candles = json.result.list
      .reverse()
      .map((i) => ({
        time: parseInt(i[0]) / 1000,
        open: parseFloat(i[1]),
        high: parseFloat(i[2]),
        low: parseFloat(i[3]),
        close: parseFloat(i[4]),
        volume: parseFloat(i[5]),
      }));

    allCandles = candles;
    earliestTime = candles[0].time * 1000;
    candleSeries.setData(candles);
    chart.timeScale().scrollToRealTime();
    return candles;
  }

  async function loadMoreHistory() {
    if (isLoadingMore || noMoreHistory || !earliestTime) return;
    isLoadingMore = true;

    const endMs = earliestTime - intervalToMs(currentInterval) - 1;
    const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${currentSymbol}&interval=${currentInterval}&end=${endMs}&limit=1000`;

    try {
      const res = await fetch(url);
      const json = await res.json();
      const list = json.result?.list?.reverse() ?? [];
      if (!list.length) {
        noMoreHistory = true;
        isLoadingMore = false;
        return;
      }

      const candles = list.map((i) => ({
        time: parseInt(i[0]) / 1000,
        open: parseFloat(i[1]),
        high: parseFloat(i[2]),
        low: parseFloat(i[3]),
        close: parseFloat(i[4]),
        volume: parseFloat(i[5]),
      }));

      earliestTime = candles[0].time * 1000;
      allCandles = [...candles, ...allCandles];
      candleSeries.setData(allCandles);
    } catch (err) {
      console.error('Ошибка подгрузки истории:', err);
    }

    isLoadingMore = false;
  }

  function getVisibleRange(range) {
    if (!range) return { startMs: 0, endMs: 0 };
    const vis = candleSeries.barsInLogicalRange(range);
    if (!vis || !vis.from || !vis.to) return { startMs: 0, endMs: 0 };
    return {
      startMs: Number(vis.from.time) * 1000,
      endMs: Number(vis.to.time) * 1000,
    };
  }

  await loadHistory();

  return {
    chart,
    candleSeries,
    getVisibleRange,
    loadHistory,
    loadMoreHistory,
    get currentSymbol() {
      return currentSymbol;
    },
    set currentSymbol(val) {
      currentSymbol = val;
    },
    get currentInterval() {
      return currentInterval;
    },
    set currentInterval(val) {
      currentInterval = val;
    },
    get allCandles() {
      return allCandles;
    },
    set allCandles(v) {
      allCandles = v;
    },
  };
}
