import { intervalToMs } from './chart_utils.js';

export async function initBaseChart() {
  const chartEl = document.getElementById('chart-container');
  const chart = LightweightCharts.createChart(chartEl, {
    layout: {
      background: { color: '#131722' },
      textColor: '#d1d4dc',
    },
    grid: {
      vertLines: { color: '#2B2B43' },
      horzLines: { color: '#2B2B43' },
    },
    rightPriceScale: { borderColor: '#485c7b' },
    timeScale: { borderColor: '#485c7b', timeVisible: true },
  });

  const candleSeries = chart.addCandlestickSeries({
    upColor: '#26a69a',
    borderUpColor: '#26a69a',
    wickUpColor: '#26a69a',
    downColor: '#ef5350',
    borderDownColor: '#ef5350',
    wickDownColor: '#ef5350',
  });

  let currentSymbol = 'BTCUSDT';
  let currentInterval = '1';
  let earliestTime = null;
  let allCandles = [];
  let noMoreHistory = false;
  let isLoadingMore = false;

  async function loadHistory() {
    const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${currentSymbol}&interval=${currentInterval}&limit=1000`;
    const res = await fetch(url);
    const json = await res.json();
    const list = json.result.list.reverse();

    const candles = list.map((i) => ({
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
  }

  async function loadMoreHistory() {
    if (isLoadingMore || noMoreHistory) return;
    isLoadingMore = true;
    const endMs = earliestTime - intervalToMs(currentInterval) - 1;
    const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${currentSymbol}&interval=${currentInterval}&end=${endMs}&limit=1000`;
    const res = await fetch(url);
    const json = await res.json();
    const list = json.result.list.reverse();
    if (!list.length) { noMoreHistory = true; return; }

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
    isLoadingMore = false;
  }

  await loadHistory();

  return {
    chart,
    candleSeries,
    currentSymbol,
    currentInterval,
    allCandles,
    getVisibleRange: (range) => {
      const vis = candleSeries.barsInLogicalRange(range);
      return { startMs: vis.from.time * 1000, endMs: vis.to.time * 1000 };
    },
    loadMoreHistory,
  };
}
