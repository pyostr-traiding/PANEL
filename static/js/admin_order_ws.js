(function () {
  const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${wsScheme}://${window.location.host}/ws/kline/`;

  let socket = null;
  let currentPrice = null;
  let priceNodes = [];
  let pnlNodes = [];
  let reconnectTimer = null;
  let reconnectCountdownTimer = null;
  const RECONNECT_DELAY = 5; // сек
  const INACTIVE_TIMEOUT = 5000; // мс
  let lastMessageTime = 0;

  // ==== Элементы UI ====
  function setIndicator(state, countdown = null) {
    const el = document.getElementById("global-socket-indicator");
    const textEl = document.getElementById("global-socket-status");
    if (!el) return;

    switch (state) {
      case "ok":
        el.style.backgroundColor = "limegreen";
        if (textEl) {
          textEl.textContent = "Подключено";
          textEl.style.color = "green";
        }
        break;
      case "reconnecting":
        el.style.backgroundColor = "orange";
        if (textEl) {
          textEl.textContent = countdown
            ? `Переподключение через ${countdown}…`
            : "Переподключение…";
          textEl.style.color = "orange";
        }
        break;
      default: // "red"
        el.style.backgroundColor = "red";
        if (textEl) {
          textEl.textContent = "Нет соединения";
          textEl.style.color = "red";
        }
    }
  }

  // ==== DOM ====
  function collectNodes() {
    const allPrice = Array.from(document.querySelectorAll(".js-current-price"));
    const allPnl = Array.from(document.querySelectorAll(".js-pnl"));

    priceNodes = allPrice.filter((el) => {
      const block = el.closest(".js-live-block");
      const isClosed = block?.dataset.closed === "true"; // <-- ключевое
      return !isClosed;
    });

    pnlNodes = allPnl.filter((el) => {
      const block = el.closest(".js-live-block");
      const isClosed = block?.dataset.closed === "true";
      return !isClosed;
    });
  }

  // ==== WebSocket ====
  function connect() {
    if (socket) socket.close();

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("[WebSocket] Connected to", wsUrl);
      collectNodes();
      setIndicator("ok");
      lastMessageTime = Date.now();
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === "kline_update" && msg?.data?.interval === 1) {
          const c = parseFloat(msg.data.data.c);
          if (!Number.isNaN(c)) {
            currentPrice = c;
            lastMessageTime = Date.now();
            setIndicator("ok");
            window.requestAnimationFrame(updateAll);
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      console.log("[WebSocket] Disconnected, retry in 5s");
      handleReconnect();
    };

    socket.onerror = () => {
      console.warn("[WebSocket] Error");
      try { socket.close(); } catch {}
    };
  }

  function handleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (reconnectCountdownTimer) clearInterval(reconnectCountdownTimer);

    let countdown = RECONNECT_DELAY;
    setIndicator("reconnecting", countdown);

    reconnectCountdownTimer = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        clearInterval(reconnectCountdownTimer);
      } else {
        setIndicator("reconnecting", countdown);
      }
    }, 1000);

    reconnectTimer = setTimeout(connect, RECONNECT_DELAY * 1000);
  }

  function checkAlive() {
    const now = Date.now();
    if (now - lastMessageTime > INACTIVE_TIMEOUT) {
      setIndicator("red");
    }
  }

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

  document.addEventListener("DOMContentLoaded", () => {
    collectNodes();
    connect();
    setInterval(checkAlive, 1000);
  });
})();
