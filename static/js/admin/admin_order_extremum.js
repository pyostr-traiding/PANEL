// static/js/admin/admin_order_extremum.js

(function () {
  const REFRESH_INTERVAL = 5;

  let allBlocks = [];
  let activeBlocks = [];
  let allUuids = [];
  let activeUuids = [];

  let globalCounter = REFRESH_INTERVAL;
  let counterEl = null;

  function collectAllBlocks() {
    allBlocks = Array.from(document.querySelectorAll(".js-extremum-block"));
    allUuids = allBlocks.map(block => block.id.replace("extremum-", ""));
  }

  function collectActiveBlocks() {
    activeBlocks = Array.from(document.querySelectorAll(".js-extremum-block"))
      .filter(block => {
        const status = block.dataset.status?.toUpperCase() || "";
        return !(status === "ИСПОЛНЕНО" || status === "COMPLETED");
      });

    activeUuids = activeBlocks.map(block => block.id.replace("extremum-", ""));
  }

  async function fetchBatch(uuids, blocks) {
    if (uuids.length === 0) return;

    try {
      const resp = await fetch(`/api/order/extremum/batch?uuids=${uuids.join(",")}`);
      if (!resp.ok) throw new Error("HTTP " + resp.status);

      const data = await resp.json();

      for (const block of blocks) {
        const uuid = block.id.replace("extremum-", "");
        const ext = data[uuid];
        if (!ext) continue;

        block.querySelector(".js-ext-max").textContent = ext.max?.value ?? "—";
        block.querySelector(".js-ext-max-dt").textContent = ext.max?.dt ?? "—";
        block.querySelector(".js-ext-min").textContent = ext.min?.value ?? "—";
        block.querySelector(".js-ext-min-dt").textContent = ext.min?.dt ?? "—";
      }
    } catch (err) {
      console.warn("Ошибка batch экстремумов:", err);
    }
  }

  function startGlobalTimer() {
    const tick = async () => {
      globalCounter -= 1;

      if (globalCounter <= 0) {
        globalCounter = REFRESH_INTERVAL;
        collectActiveBlocks();
        await fetchBatch(activeUuids, activeBlocks);
      }

      if (counterEl) {
        counterEl.textContent = `${globalCounter}с`;
      }
    };

    collectAllBlocks();
    fetchBatch(allUuids, allBlocks);

    setInterval(tick, 1000);
  }

  // --- ВОТ ЭТО ИСПРАВЛЕНИЕ ---
  // ждем появления индикатора перед запуском
  function waitForIndicator() {
    counterEl = document.getElementById("extremum-update-counter");
    if (counterEl) {
      startGlobalTimer();
    } else {
      setTimeout(waitForIndicator, 200); // пробуем снова через 200мс
    }
  }

  document.addEventListener("DOMContentLoaded", waitForIndicator);
})();
