// Fix for missing Grappelli grp object
if (typeof window.grp === "undefined") {
  window.grp = {};
}

(function () {
  const REFRESH_INTERVAL = 5; // секунд
  let blocks = [];

  function collectBlocks() {
    blocks = Array.from(document.querySelectorAll(".js-live-block"));
  }

  async function fetchLiveData(block) {
    const url = block.dataset.url;
    if (!url) return;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();

      // обновляем комиссии и статус
      const fundingEl = block.querySelector(".js-funding");
      const statusEl = block.querySelector(".js-status");

      if (fundingEl)
        fundingEl.textContent = parseFloat(data.accumulated_funding).toFixed(3);

      if (statusEl) {
        const newStatus = (data.status_title || data.status).toUpperCase();
        statusEl.textContent = newStatus;

        // если статус стал Исполнен — превращаем блок в статичный
        if (newStatus === "ИСПОЛНЕНО" || newStatus === "COMPLETED") {
          convertBlockToClosed(block, data);
          console.log(newStatus)
          return; // выходим, чтобы не подсвечивать как обновление
        }
      }

      // лёгкая подсветка при обновлении
      block.style.transition = "background-color 0.3s";
      block.style.backgroundColor = "rgba(0,255,0,0.05)";
      setTimeout(() => (block.style.backgroundColor = ""), 400);
    } catch (err) {
      console.warn("Ошибка обновления данных:", err);
    }
  }

  function startCountdown(block) {
    let counterEl = block.querySelector(".js-refresh-counter");
    let counter = REFRESH_INTERVAL;

    const tick = async () => {
      counter -= 1;
      if (counter <= 0) {
        counter = REFRESH_INTERVAL;
        await fetchLiveData(block);
      }
      if (counterEl) counterEl.textContent = counter + "с";
    };

    fetchLiveData(block); // первый запуск сразу
    setInterval(tick, 1000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    collectBlocks();
    blocks.forEach(startCountdown);
  });
})();

function convertBlockToClosed(block, data) {
  // убираем обновления
  block.classList.remove("js-live-block");
  block.removeAttribute("data-url");
  block.removeAttribute("data-symbol");

  const counter = block.querySelector(".js-refresh-counter");
  if (counter) counter.remove();

  // ищем источник данных (лучше брать с .js-pnl, если есть)
  const pnlEl = block.querySelector(".js-pnl");
  const statusEl = block.querySelector(".js-status");

  const entry = parseFloat(pnlEl?.dataset.entryPrice ?? statusEl?.dataset.entryPrice ?? 0);
  const qty = parseFloat(pnlEl?.dataset.qty ?? statusEl?.dataset.qty ?? 0);
  const funding = parseFloat(pnlEl?.dataset.funding ?? statusEl?.dataset.funding ?? 0);
  const side = (pnlEl?.dataset.side ?? statusEl?.dataset.side ?? "buy").toLowerCase();
  const closeRate = parseFloat(data.close_rate || pnlEl?.dataset.closeRate || 0);
  const targetRate = pnlEl?.dataset.targetRate || statusEl?.dataset.targetRate || "—";


  let pnl =
    side === "buy"
      ? (closeRate - entry) * qty - funding
      : (entry - closeRate) * qty - funding;

  pnl = Math.round(pnl * 1000) / 1000;
  const color = pnl > 0 ? "green" : pnl < 0 ? "red" : "gray";

  const html = `
    <table style="border-collapse: collapse; width: 100%; border: none;">
      <tr><td>Сборы USDT:</td><td>${funding.toFixed(3)}</td></tr>
      <tr><td>Цель для 1$:</td><td>${targetRate}</td></tr>
      <tr><td>Статус:</td><td>${(data.status_title || data.status).toUpperCase()}</td></tr>
      <tr><td>Курс закрытия:</td><td>${closeRate.toFixed(3)}</td></tr>
      <tr><td>P&L:</td><td><span style="color:${color};">${pnl.toFixed(3)}</span></td></tr>
    </table>
  `;

  block.innerHTML = html;

  // мягкая подсветка перехода
  block.style.transition = "background-color 0.6s";
  block.style.backgroundColor = "rgba(255,215,0,0.15)";
  setTimeout(() => (block.style.backgroundColor = ""), 1000);
}
