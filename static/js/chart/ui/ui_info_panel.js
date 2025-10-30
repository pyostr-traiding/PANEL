export function initInfoPanel(ctx) {
  const { chart, candleSeries } = ctx;
  const infoPanel = document.getElementById('chart-info');
  if (!infoPanel) return;

  let isCrosshairActive = false;
  let lastCandle = null;
  let lastClosePrice = null;

  // === утилита для получения текущих CSS-переменных ===
  const getVar = (name, fallback) =>
    getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim() || fallback;

  const applyThemeStyles = () => {
    Object.assign(infoPanel.style, {
      color: getVar('--text-color', '#e0e0e0'),
      background: getVar('--panel-bg', 'rgba(0,0,0,0.45)'),
      border: `1px solid ${getVar('--border-color', '#444')}`,
    });
  };

  // === оформление (базовые стили) ===
  Object.assign(infoPanel.style, {
    position: 'absolute',
    top: '10px',
    left: '15px',
    fontFamily: 'monospace',
    fontSize: '13px',
    padding: '6px 10px',
    borderRadius: '6px',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: '10',
    transition: 'background-color 0.3s, color 0.3s, opacity 0.3s, border-color 0.3s',
  });

  // применяем цвета из текущей темы
  applyThemeStyles();

  // === слушаем смену темы ===
  window.addEventListener('themeChanged', applyThemeStyles);

  // === обновление содержимого ===
  function updateInfoPanel(candle) {
    if (!candle) return;

    const open = parseFloat(candle.open ?? candle.value ?? 0);
    const high = parseFloat(candle.high ?? candle.value ?? open);
    const low = parseFloat(candle.low ?? candle.value ?? open);
    const close = parseFloat(candle.close ?? candle.value ?? open);
    const volume = parseFloat(candle.volume ?? 0);
    const date = new Date(candle.time * 1000)
      .toISOString()
      .replace('T', ' ')
      .split('.')[0];

    const priceColor = close > open
      ? '#4CAF50'
      : close < open
        ? '#F44336'
        : getVar('--text-color', '#e0e0e0');

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

    // 🔥 фон с подсветкой, но адаптируем под тему
    const baseBg = getVar('--panel-bg', 'rgba(0,0,0,0.45)');
    infoPanel.style.background = highlight || baseBg;
    infoPanel.style.color = getVar('--text-color', '#e0e0e0');
    infoPanel.style.borderColor = getVar('--border-color', '#444');

    infoPanel.innerHTML = `
      <div><b>${ctx.currentSymbol}</b> (${ctx.currentInterval}m)</div>
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

  // === при получении свечи от WebSocket ===
  ctx.subscribeToCandle((candle) => {
    lastCandle = candle;
    if (!isCrosshairActive) updateInfoPanel(candle);
  });

  // === при наведении курсора ===
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

  // === при инициализации (первый рендер) ===
  if (ctx.allCandles?.length) {
    lastCandle = ctx.allCandles[ctx.allCandles.length - 1];
    updateInfoPanel(lastCandle);
  }
}
