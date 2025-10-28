(function () {
  const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${wsScheme}://${window.location.host}/ws/kline/`;

  let socket = null;
  let currentPrice = null;
  let priceNodes = [];
  let pnlNodes = [];
  let reconnectTimer = null;

  // === Индикаторы WebSocket активности ===
  const indicators = {};
  const INACTIVE_TIMEOUT = 5000; // мс

  function setIndicatorState(id, state) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.backgroundColor = state === "ok" ? "limegreen" : "red";
  }

  function markSocketActive() {
    const now = Date.now();
    Object.entries(indicators).forEach(([id, obj]) => {
      obj.lastUpdate = now;
      setIndicatorState(id, "ok");
    });
  }

  function checkIndicators() {
    const now = Date.now();
    Object.entries(indicators).forEach(([id, obj]) => {
      if (now - obj.lastUpdate > INACTIVE_TIMEOUT) {
        setIndicatorState(id, "red");
      }
    });
  }

  // === Работа с DOM ===
  function collectNodes() {
    priceNodes = Array.from(document.querySelectorAll(".js-current-price"));
    pnlNodes = Array.from(document.querySelectorAll(".js-pnl"));

    document.querySelectorAll(".js-socket-indicator").forEach((el) => {
      indicators[el.id] = { lastUpdate: 0 };
      setIndicatorState(el.id, "red");
    });
  }

  // === Подключение WebSocket ===
  function connect() {
    if (socket) socket.close();

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("[WebSocket] Connected to", wsUrl);
      collectNodes();
      markSocketActive();
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === "kline_update" && msg?.data?.interval === 1) {
          const c = parseFloat(msg.data.data.c);
          if (!Number.isNaN(c)) {
            currentPrice = c;
            markSocketActive();
            window.requestAnimationFrame(updateAll);
          }
        }
      } catch (e) {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      console.log("[WebSocket] Disconnected, retry in 5s");
      Object.keys(indicators).forEach((id) =>
        setIndicatorState(id, "red")
      );
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 5000);
    };

    socket.onerror = () => {
      console.warn("[WebSocket] Error");
      try {
        socket.close();
      } catch {}
    };
  }

  // === Обновление отображения ===
  function updateAll() {
    if (currentPrice == null) return;

    for (const node of priceNodes) node.textContent = currentPrice;

    for (const node of pnlNodes) {
      const entry = parseFloat(node.dataset.entryPrice);
      const qty = parseFloat(node.dataset.qty);
      const funding = parseFloat(node.dataset.funding);
      const side = (node.dataset.side || "buy").toLowerCase();
      if (!Number.isFinite(entry) || !Number.isFinite(qty)) continue;

      let pnl =
        side === "buy"
          ? (currentPrice - entry) * qty - funding
          : (entry - currentPrice) * qty - funding;

      const rounded = Math.round(pnl * 1000) / 1000;
      node.style.color =
        rounded > 0 ? "green" : rounded < 0 ? "red" : "gray";
      node.textContent = rounded.toFixed(3);
    }
  }

  // === Инициализация ===
  document.addEventListener("DOMContentLoaded", () => {
    collectNodes();
    connect();
    setInterval(checkIndicators, 1000);
  });

  // Для AJAX пагинации в админке
  document.addEventListener("click", (e) => {
    if (e.target.closest(".paginator") || e.target.closest(".actions")) {
      setTimeout(collectNodes, 1000);
    }
  });
})();
