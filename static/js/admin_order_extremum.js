(function () {
  const REFRESH_INTERVAL = 5; // секунд
  let blocks = [];

  function collectBlocks() {
    blocks = Array.from(document.querySelectorAll(".js-extremum-block"));
  }

  async function fetchExtremums(block) {
    const url = block.dataset.url;
    if (!url) return;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();

      const maxValue = data[0]?.value ?? "—";
      const maxDt = data[0]?.dt ?? "—";
      const minValue = data[1]?.value ?? "—";
      const minDt = data[1]?.dt ?? "—";

      block.querySelector(".js-ext-max").textContent = maxValue;
      block.querySelector(".js-ext-max-dt").textContent = maxDt;
      block.querySelector(".js-ext-min").textContent = minValue;
      block.querySelector(".js-ext-min-dt").textContent = minDt;

      block.style.transition = "background-color 0.3s";
      block.style.backgroundColor = "rgba(0,255,0,0.05)";
      setTimeout(() => (block.style.backgroundColor = ""), 400);
    } catch (err) {
      console.warn("Ошибка обновления экстремумов:", err);
    }
  }

  function startCountdown(block) {
    let counterEl = block.querySelector(".js-ext-counter");
    let value = REFRESH_INTERVAL;

    const tick = async () => {
      value -= 1;
      if (value <= 0) {
        value = REFRESH_INTERVAL;
        await fetchExtremums(block);
      }
      counterEl.textContent = value;
    };

    fetchExtremums(block);
    setInterval(tick, 1000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    collectBlocks();
    blocks.forEach(startCountdown);
  });
})();
