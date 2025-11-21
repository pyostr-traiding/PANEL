// === ОТРИСОВКА ОРДЕРОВ НА ГРАФИКЕ ===

import { debounce } from "../core/chart_utils.js";

export function initOrdersModule(ctx) {
  const orders = [];
  let orderMarkers = [];

  let hoverMarkerTime = null;

  function candlesReady() {
    return Array.isArray(ctx.allCandles) && ctx.allCandles.length > 0;
  }

  async function fetchOrders(startMs, endMs) {
    const url = `/api/order/search?start_ms=${startMs}&end_ms=${endMs}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("Order API returned error:", res.status);
        return [];
      }
      const json = await res.json();
      return json.results || [];
    } catch (e) {
      console.error("Order fetch error:", e);
      return [];
    }
  }

  function findCandleByMs(ms) {
    return ctx.allCandles.find(c => Number(c.time) * 1000 === Number(ms));
  }

  function makeMarkers(list) {
    const markers = [];
    for (const order of list) {
      const openCandle = findCandleByMs(order.open_kline_ms);
      if (openCandle) {
        markers.push({
          time: openCandle.time,
          position: "aboveBar",
          color: order.side === "buy" ? "#00c853" : "#d50000",
          shape: "arrowUp",
          text: `ORDER OPEN\n${order.side.toUpperCase()}`
        });
      }
    }
    return markers;
  }

  const hoverCloseMarkers = [];

  function updateHoverMarkers(list) {
    hoverCloseMarkers.length = 0;
    for (const order of list) {
      if (!order.close_kline_ms) continue;
      const candle = findCandleByMs(order.close_kline_ms);
      if (!candle) continue;
      hoverCloseMarkers.push({
        candleTime: candle.time,
        text: "ORDER CLOSED"
      });
    }
  }

  function renderMarkers() {
    ctx.candleSeries.setMarkers(orderMarkers);
  }

  function extractTime(v) {
    if (typeof v === "number") return v;
    if (v && typeof v === "object" && "time" in v) return v.time;
    return null;
  }

  async function updateOrders(retry = true) {
    const chk = document.getElementById("show-orders");
    if (!chk || !chk.checked) return;

    if (!candlesReady()) {
      if (retry) setTimeout(() => updateOrders(false), 200);
      return;
    }

    const range = ctx.chart.timeScale().getVisibleLogicalRange();
    if (!range) {
      if (retry) setTimeout(() => updateOrders(false), 200);
      return;
    }

    const vis = ctx.candleSeries.barsInLogicalRange(range);
    if (!vis) {
      if (retry) setTimeout(() => updateOrders(false), 200);
      return;
    }

    const tFrom = extractTime(vis.from);
    const tTo = extractTime(vis.to);

    if (!tFrom || !tTo) {
      if (retry) setTimeout(() => updateOrders(false), 200);
      return;
    }

    const startMs = tFrom * 1000;
    const endMs = tTo * 1000;

    const list = await fetchOrders(startMs, endMs);

    orders.length = 0;
    orders.push(...list);

    orderMarkers = makeMarkers(list);
    updateHoverMarkers(list);

    renderMarkers();
  }

  const debouncedUpdateOrders = debounce(updateOrders, 300);

  ctx.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
    debouncedUpdateOrders();
  });

  document.getElementById("show-orders")?.addEventListener("change", async (e) => {
    if (e.target.checked) {
      await updateOrders();
    } else {
      orderMarkers = [];
      ctx.candleSeries.setMarkers([]);
    }
  });

  // === Tooltip для ордеров ===
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

  function showOrderTooltip(order, x, y) {
    tooltip.innerHTML = `
      <b>Order ID:</b> ${order.id || "-"}<br>
      <b>Side:</b> ${order.side}<br>
      <b>Price:</b> ${order.price || "-"}<br>
      <b>Open Time:</b> ${new Date(order.open_kline_ms).toLocaleString()}<br>
      <b>Close Time:</b> ${order.close_kline_ms ? new Date(order.close_kline_ms).toLocaleString() : "-"}
    `;
    tooltip.style.left = x + 10 + "px";
    tooltip.style.top = y + 10 + "px";
    tooltip.style.display = "block";
  }

  function hideOrderTooltip() {
    tooltip.style.display = "none";
  }

  // === Hover-синяя метка и tooltip ===
  ctx.chart.subscribeCrosshairMove(param => {
  const chk = document.getElementById("show-orders");
  if (!chk?.checked || !param.time) {
    hideOrderTooltip();
    return;
  }

  const hoveredOrder = orders.find(o => {
    const openCandle = findCandleByMs(o.open_kline_ms);
    return openCandle && openCandle.time === param.time;
  });

  if (!hoveredOrder) {
    hideOrderTooltip();
    if (hoverMarkerTime !== null) {
      hoverMarkerTime = null;
      ctx.candleSeries.setMarkers(orderMarkers);
    }
    return;
  }

  // Hover-синяя метка
  if (hoveredOrder.close_kline_ms) {
    const closeCandle = findCandleByMs(hoveredOrder.close_kline_ms);
    if (closeCandle && hoverMarkerTime !== closeCandle.time) {
      hoverMarkerTime = closeCandle.time;
      const newMarkers = [
        ...orderMarkers,
        {
          time: closeCandle.time,
          position: "aboveBar",
          color: "#2962ff",
          shape: "circle",
          text: "ORDER CLOSED"
        }
      ];
      ctx.candleSeries.setMarkers(newMarkers);
    }
  }

  // === Получаем координаты свечи ===
  const candle = findCandleByMs(hoveredOrder.open_kline_ms);
  if (!candle) return;

  const timeCoord = ctx.chart.timeScale().timeToCoordinate(candle.time);
  const priceCoord = ctx.candleSeries.priceToCoordinate(candle.close || candle.open);

  if (timeCoord === null || priceCoord === null) return;

  // Позиционируем tooltip рядом со свечой
  const chartRect = ctx.chart._internal_chartPane?.canvas?.getBoundingClientRect() || { left: 0, top: 0 };
  const x = timeCoord + chartRect.left;
  const y = priceCoord + chartRect.top - 20; // чуть выше свечи

  showOrderTooltip(hoveredOrder, x, y);
});


  ctx.loadOrders = async () => {
    await updateOrders();
  };

  ctx.clearOrders = () => {
    orderMarkers = [];
    hoverCloseMarkers.length = 0;
    hoverMarkerTime = null;
    ctx.candleSeries.setMarkers([]);
    hideOrderTooltip();
  };
}
