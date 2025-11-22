// === ОТРИСОВКА ПОЗИЦИЙ НА ГРАФИКЕ ===
import { debounce } from "../core/chart_utils.js";

export function initPositionsModule(ctx) {
  const positions = [];
  let positionMarkers = [];

  function candlesReady() {
    return Array.isArray(ctx.allCandles) && ctx.allCandles.length > 0;
  }

  async function fetchPositions(startMs, endMs) {
    const url = `/api/position/search?start_ms=${startMs}&end_ms=${endMs}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("Positions API returned error:", res.status);
        return [];
      }
      const json = await res.json();
      return json.results || [];
    } catch (e) {
      console.error("Position fetch error:", e);
      return [];
    }
  }

  function findCandleByMs(ms) {
  // ищем свечу с допуском ±1 сек
  return ctx.allCandles.find(c => Math.abs(Number(c.time) * 1000 - Number(ms)) < 1000);
}

 function makeMarkers(list) {
  const markers = [];
  for (const pos of list) {
    const candle = findCandleByMs(pos.kline_ms);
    if (!candle) continue;

    markers.push({
      time: candle.time,
      position: "aboveBar",
      color: pos.side === "buy" ? "#00c853" : "#d50000",
      shape: "arrowUp",
      text: `${pos.side.toUpperCase()}` // убрали \n
    });
  }
  return markers;
}



  function renderMarkers() {
  // форсированно обновляем, чтобы не пропадали при zoom/scroll
  ctx.candleSeries.setMarkers([]);
  ctx.candleSeries.setMarkers(positionMarkers);
}


  function extractTime(v) {
    if (typeof v === "number") return v;
    if (v && typeof v === "object" && "time" in v) return v.time;
    return null;
  }

  async function updatePositions(retry = true) {
  const chk = document.getElementById("show-positions");
  if (!chk || !chk.checked) return;

  if (!candlesReady()) {
    if (retry) setTimeout(() => updatePositions(false), 200);
    return;
  }

  const range = ctx.chart.timeScale().getVisibleLogicalRange();
  if (!range) {
    if (retry) setTimeout(() => updatePositions(false), 200);
    return;
  }

  const vis = ctx.candleSeries.barsInLogicalRange(range);
  if (!vis) {
    if (retry) setTimeout(() => updatePositions(false), 200);
    return;
  }

  const tFrom = extractTime(vis.from);
  const tTo = extractTime(vis.to);
  if (!tFrom || !tTo) {
    if (retry) setTimeout(() => updatePositions(false), 200);
    return;
  }

  const startMs = tFrom * 1000;
  const endMs = tTo * 1000;

  const list = await fetchPositions(startMs, endMs);

  positions.length = 0;
  positions.push(...list);

  positionMarkers = makeMarkers(list);

  // лог для проверки
  console.log('[Positions] markers:', positionMarkers);

  renderMarkers();
}

  const debouncedUpdatePositions = debounce(updatePositions, 300);

  ctx.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
    debouncedUpdatePositions();
  });

  document.getElementById("show-positions")?.addEventListener("change", async (e) => {
    if (e.target.checked) {
      await updatePositions();
    } else {
      positionMarkers = [];
      ctx.candleSeries.setMarkers([]);
    }
  });

  // === Tooltip для позиций ===
  const tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.pointerEvents = "none";
  tooltip.style.background = "rgba(0,0,0,0.8)";
  tooltip.style.color = "#fff";
  tooltip.style.padding = "6px 10px";
  tooltip.style.borderRadius = "4px";
  tooltip.style.fontSize = "12px";
  tooltip.style.display = "none";
  tooltip.style.zIndex = "1000";
  document.body.appendChild(tooltip);

  function showPositionTooltip(pos, x, y) {
    tooltip.innerHTML = `
      <b>UUID:</b> ${pos.uuid || "-"}<br>
      <b>Side:</b> ${pos.side}<br>
      <b>Price:</b> ${pos.price || "-"}<br>
      <b>Qty:</b> ${pos.qty_tokens || "-"}<br>
      <b>Time:</b> ${new Date(pos.kline_ms).toLocaleString()}<br>
      <b>Status:</b> ${pos.status || "-"}
    `;
    tooltip.style.left = x + 10 + "px";
    tooltip.style.top = y + 10 + "px";
    tooltip.style.display = "block";
  }

  function hidePositionTooltip() {
    tooltip.style.display = "none";
  }

  // Hover по позициям
 ctx.chart.subscribeCrosshairMove(param => {
  const chk = document.getElementById("show-positions");
  if (!chk?.checked || !param.time || !param.point) {
    hidePositionTooltip();
    return;
  }

  const hoveredPos = positions.find(p => {
    const candle = findCandleByMs(p.kline_ms);
    return candle && candle.time === param.time;
  });

  if (!hoveredPos) {
    hidePositionTooltip();
    return;
  }

  // Берём канвас графика через DOM
  const canvas = ctx.chart._internal_chartPane?.canvas || document.querySelector(".tv-lightweight-charts");
  if (!canvas) return;
  const canvasRect = canvas.getBoundingClientRect();

  const x = canvasRect.left + param.point.x - 20;
  const y = canvasRect.top + param.point.y - 20;

  showPositionTooltip(hoveredPos, x, y);
});



  ctx.loadPositions = async () => {
    await updatePositions();
  };

  ctx.clearPositions = () => {
    positionMarkers = [];
    positions.length = 0;
    ctx.candleSeries.setMarkers([]);
    hidePositionTooltip();
  };
}
