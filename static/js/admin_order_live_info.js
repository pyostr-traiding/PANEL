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

      if (statusEl)
        statusEl.textContent = (data.status_title || data.status).toUpperCase();

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
