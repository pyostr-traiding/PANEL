(() => {
  const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${wsScheme}://${window.location.host}/ws/orderbook/`;
  let ws = null;
  let currentTab = null;
  let reconnectTimer = null;

  const handlers = {
    orderbook: null,
    depth: null,
    balances: null,
  };

  /* === Статусы подключения === */
  function setWSStatus(tab, status) {
    const dot = document.getElementById(`ws-status-${tab}`);
    const text = document.getElementById(`ws-text-${tab}`);
    if (!dot || !text) return;

    dot.className = "ws-indicator";
    text.textContent =
      status === "connected"
        ? "Подключено"
        : status === "connecting"
        ? "Переподключение..."
        : "Отключено";

    dot.classList.add(
      status === "connected"
        ? "ws-connected"
        : status === "connecting"
        ? "ws-connecting"
        : "ws-disconnected"
    );
  }

  /* === Подключение WS === */
  function connectWS() {
    if (ws) ws.close();
    setAllStatuses("connecting");

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[WS] connected");
      setAllStatuses("connected");
    };

    ws.onclose = () => {
      console.warn("[WS] disconnected");
      setAllStatuses("disconnected");
      reconnectTimer = setTimeout(connectWS, 3000);
    };

    ws.onerror = (e) => {
      console.error("[WS] error", e);
      setAllStatuses("disconnected");
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (!msg?.data) return;
        if (currentTab && handlers[currentTab]) {
          handlers[currentTab](msg);
        }
      } catch (err) {
        console.error("[WS] parse error", err);
      }
    };
  }

  function setAllStatuses(status) {
    ["orderbook", "depth", "balances"].forEach((tab) =>
      setWSStatus(tab, status)
    );
  }

  /* === Управление вкладками === */
  function activateTab(tabName) {
    currentTab = tabName;
    console.log("[WS] активирована вкладка:", tabName);
  }

  function registerHandler(tabName, handler) {
    handlers[tabName] = handler;
  }

  window.WSManager = { connectWS, activateTab, registerHandler };
  window.addEventListener("load", connectWS);
})();
