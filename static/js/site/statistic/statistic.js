document.getElementById("apply_filters").addEventListener("click", loadStats);

// Установка быстрых диапазонов
function setQuickRange(type) {
  const from = document.getElementById("date_from");
  const to = document.getElementById("date_to");

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (type === "today") {
    from.value = todayStr;
    to.value = todayStr;
  }

  if (type === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    from.value = weekAgo.toISOString().slice(0, 10);
    to.value = todayStr;
  }

  if (type === "month") {
    const monthAgo = new Date(now);
    monthAgo.setMonth(now.getMonth() - 1);
    from.value = monthAgo.toISOString().slice(0, 10);
    to.value = todayStr;
  }

  loadStats();
}

// Ставит сегодня по умолчанию
function setDefaultToday() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  document.getElementById("date_from").value = today;
  document.getElementById("date_to").value = today;
}

async function loadStats() {
  const date_from = document.getElementById("date_from").value;
  const date_to = document.getElementById("date_to").value;
  const status = document.getElementById("status").value;


  const payload = {
    date_from,
    date_to,
    statuses: status || null,
  };


  try {
    const res = await fetch("/api/order/statistic/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    });

    if (res.status === 404) {
      showToast('Ничего не найдено', 'info')
    }
    if (!res.ok) {
    console.error(`Ошибка запроса: ${res.status} ${res.statusText}`);
    return;
  }

    const data = await res.json();


    renderCard("card-buy", data.buy, "BUY", "#4caf50");
    renderCard("card-sell", data.sell, "SELL", "#f44336");
    renderCard("card-other", data.other, "OTHER", "#888");


    renderCharts(data);
  } catch (err) {
    showToast("Произошла ",);
  }
}

function renderCard(id, obj, title, color) {
  const el = document.getElementById(id);
  el.innerHTML = `
    <div style="font-weight:600;font-size:16px;color:${color}">${title}</div>
    <div>Кол-во: <b>${obj.count}</b></div>
    <div>Цена: <b>${obj.sum_price}</b></div>
    <div>Токены: <b>${obj.sum_qty}</b></div>
    <div>Фандинг: <b>${obj.sum_funding}</b></div>
    <div>PNL: <b>${obj.pnl}</b></div>
    <div>NET: <b>${obj.net}</b></div>
  `;
}

let chartPNL = null;
let chartNET = null;

function renderCharts(data) {
  const pnlData = [
    parseFloat(data.buy.pnl),
    parseFloat(data.sell.pnl),
    parseFloat(data.other.pnl)
  ];

  const netData = [
    parseFloat(data.buy.net),
    parseFloat(data.sell.net),
    parseFloat(data.other.net)
  ];

  if (chartPNL) chartPNL.destroy();
  if (chartNET) chartNET.destroy();

  chartPNL = new Chart(document.getElementById("chart-pnl"), {
    type: "bar",
    data: {
      labels: ["BUY", "SELL", "OTHER"],
      datasets: [{ label: "PNL", data: pnlData }]
    }
  });

  chartNET = new Chart(document.getElementById("chart-net"), {
    type: "bar",
    data: {
      labels: ["BUY", "SELL", "OTHER"],
      datasets: [{ label: "NET", data: netData }]
    }
  });
}

// Ставим дату и грузим статистику при загрузке страницы
setDefaultToday();
loadStats();
