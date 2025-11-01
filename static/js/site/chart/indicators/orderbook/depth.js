(() => {
  const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${wsScheme}://${window.location.host}/ws/orderbook/`;
  let ws = null, depthChart = null, bidSeries, askSeries;

  // === Настройки режима ===
  let updateInterval = 1000; // обновление — 1 сек
  let depthLimit = 20; // уровни стакана
  let lastData = null;
  let updateTimer = null;
  let lastCTS = null; // для отображения времени

  /* === Обновление статуса сокета === */
  function setWSStatus(status) {
    const dot = document.getElementById("ws-status-depth");
    const text = document.getElementById("ws-text-depth");
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

  /* === Подключение к WebSocket === */
  function connectDepthWS() {
    setWSStatus("connecting");
    ws = new WebSocket(wsUrl);

    ws.onopen = () => setWSStatus("connected");
    ws.onclose = () => {
      setWSStatus("disconnected");
      setTimeout(connectDepthWS, 3000);
    };
    ws.onerror = () => setWSStatus("disconnected");
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (!msg?.data) return;
        lastData = msg.data;
        lastCTS = msg.cts || Date.now();
      } catch (err) {
        console.error("[DEPTH] parse error", err);
      }
    };
  }

  /* === Инициализация графика === */
  function initDepthChart() {
    const container = document.getElementById("depth-chart");
    if (!container) return;
    container.innerHTML = "";

    const chart = LightweightCharts.createChart(container, {
      layout: { background: { color: "transparent" }, textColor: "#aaa" },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: {
        visible: true,
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair: { mode: 0 },
    });

    bidSeries = chart.addAreaSeries({
      topColor: "rgba(30,180,90,0.35)",
      bottomColor: "rgba(30,180,90,0.1)",
      lineColor: "#2cc870",
      lineWidth: 2,
      priceLineVisible: false,
    });

    askSeries = chart.addAreaSeries({
      topColor: "rgba(230,70,70,0.35)",
      bottomColor: "rgba(230,70,70,0.1)",
      lineColor: "#f45b5b",
      lineWidth: 2,
      priceLineVisible: false,
    });

    depthChart = chart;

    const placeholder = document.createElement("div");
    placeholder.id = "depth-placeholder";
    placeholder.textContent = "⏳ Ожидание данных о глубине рынка...";
    placeholder.style.textAlign = "center";
    placeholder.style.color = "var(--text-secondary)";
    placeholder.style.fontSize = "12px";
    placeholder.style.marginTop = "10px";
    container.appendChild(placeholder);
  }

  /* === Отрисовка данных === */
  function renderDepth(bids, asks) {
    if (!bids || !asks) return;
    if (!depthChart) initDepthChart();

    const placeholder = document.getElementById("depth-placeholder");
    if (placeholder) placeholder.remove();

    const sortedBids = [...bids]
      .map(([p, q]) => [Number(p), Number(q)])
      .sort((a, b) => b[0] - a[0])
      .slice(0, depthLimit);

    const sortedAsks = [...asks]
      .map(([p, q]) => [Number(p), Number(q)])
      .sort((a, b) => a[0] - b[0])
      .slice(0, depthLimit);

    let cumBid = 0, cumAsk = 0;
    const bidData = sortedBids.map(([price, qty], i) => ({
      time: i,
      value: (cumBid += qty),
    }));

    const askData = sortedAsks.map(([price, qty], i) => ({
      time: i + bidData.length,
      value: (cumAsk += qty),
    }));

    bidSeries.setData(bidData);
    askSeries.setData(askData);

    // Форматирование оси X — показываем цены
    const all = [...sortedBids, ...sortedAsks];
    depthChart.timeScale().applyOptions({
      tickMarkFormatter: (time) => {
        const idx = Math.floor(time);
        const point = all[idx];
        return point ? point[0].toFixed(2) : "";
      },
    });

    depthChart.timeScale().fitContent();
  }

  /* === Анализ рыночной ситуации === */
  function analyzeMarket(bids, asks) {
    const marketInfo = ensureMarketInfo();
    if (!marketInfo) return;

    const totalBid = bids.slice(0, depthLimit).reduce((s, [_, q]) => s + parseFloat(q), 0);
    const totalAsk = asks.slice(0, depthLimit).reduce((s, [_, q]) => s + parseFloat(q), 0);
    const ratio = totalBid / (totalAsk || 1);
    const diff = ((ratio - 1) * 100).toFixed(1);

    let text = "", color = "";

    if (ratio > 1.15) {
      text = `🟢 Преобладают покупатели (+${diff}% объёма). Спрос превышает предложение — вероятна поддержка цены.`;
      color = "var(--bid-color)";
    } else if (ratio < 0.85) {
      text = `🔴 Продавцы доминируют (${diff}% дисбаланс). Предложение выше спроса — возможен спад цены.`;
      color = "var(--ask-color)";
    } else {
      text = `⚪ Баланс спроса и предложения. Рынок в равновесии.`;
      color = "var(--text-secondary)";
    }

    fadeText(marketInfo, text, color);

    // обновляем время
    updateTimestamp(lastCTS);
  }

  /* === Добавляем контролы и инфо === */
  function ensureMarketInfo() {
    let info = document.getElementById("market-depth-info");
    if (!info) {
      const tab = document.querySelector("#tab-depth");
      if (!tab) return null;

      const controls = document.createElement("div");
      controls.className = "depth-controls";
      controls.innerHTML = `
        <div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-bottom:6px;font-size:12px;">
          🔄 Обновление:
          <select id="depth-speed">
            <option value="100">Реальное время</option>
            <option value="1000" selected>1 сек</option>
            <option value="2000">2 сек</option>
            <option value="3000">3 сек</option>
          </select>
          📈 Глубина:
          <select id="depth-limit">
            <option value="10">10</option>
            <option value="20" selected>20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      `;

      info = document.createElement("div");
      info.id = "market-depth-info";
      info.style.textAlign = "center";
      info.style.fontSize = "13px";
      info.style.fontWeight = "500";
      info.style.opacity = "0";
      info.style.transition = "opacity 0.6s ease";

      const timeInfo = document.createElement("div");
      timeInfo.id = "market-depth-timestamp";
      timeInfo.style.textAlign = "center";
      timeInfo.style.fontSize = "11.5px";
      timeInfo.style.color = "var(--text-secondary)";
      timeInfo.style.marginTop = "4px";

      tab.appendChild(controls);
      tab.appendChild(info);
      tab.appendChild(timeInfo);

      document.getElementById("depth-speed").addEventListener("change", (e) => {
        updateInterval = parseInt(e.target.value);
        resetUpdater();
      });
      document.getElementById("depth-limit").addEventListener("change", (e) => {
        depthLimit = parseInt(e.target.value);
      });
    }
    return info;
  }

  /* === Анимация текста === */
  function fadeText(element, newText, color) {
    element.style.opacity = 0;
    setTimeout(() => {
      element.textContent = newText;
      element.style.color = color;
      element.style.opacity = 1;
    }, 300);
  }

  /* === Обновление времени === */
  function updateTimestamp(cts) {
    const el = document.getElementById("market-depth-timestamp");
    if (!el || !cts) return;
    const ts = new Date(cts);
    el.textContent = "⏱ Последнее обновление: " + ts.toLocaleTimeString();
  }

  /* === Периодическое обновление === */
  function startUpdater() {
    if (updateTimer) clearInterval(updateTimer);
    updateTimer = setInterval(() => {
      if (lastData) {
        renderDepth(lastData.b, lastData.a);
        analyzeMarket(lastData.b, lastData.a);
      }
    }, updateInterval);
  }

  function resetUpdater() {
    clearInterval(updateTimer);
    startUpdater();
  }

  /* === Инициализация === */
  window.addEventListener("load", () => {
    connectDepthWS();
    initDepthChart();
    ensureMarketInfo();
    startUpdater();

    document.addEventListener("click", (e) => {
      const tabBtn = e.target.closest('.tab-btn[data-tab="depth"]');
      if (tabBtn) {
        setTimeout(() => {
          if (!depthChart) initDepthChart();
          const el = document.getElementById("depth-chart");
          if (depthChart && el)
            depthChart.resize(el.clientWidth, el.clientHeight);
        }, 150);
      }
    });
  });
})();
