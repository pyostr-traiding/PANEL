(function () {

  const INDICATOR_RSI = "RSI";
  const INDICATOR_INTERVALS = "INTERVALS";

  document.addEventListener("DOMContentLoaded", () => {

    const menu = document.getElementById("settings-menu");
    const currentTitleEl = document.getElementById("settings-current-title");
    const currentSubtitleEl = document.getElementById("settings-current-subtitle");
    const globalToggle = document.getElementById("indicator-active");

    const rsiBlock = document.getElementById("settings-rsi-block");
    const intervalsBlock = document.getElementById("settings-intervals-block");

    let currentIndicator = INDICATOR_RSI;

    // -----------------------------
    // Переключение меню
    // -----------------------------
    if (menu) {
      menu.addEventListener("click", (e) => {
        const item = e.target.closest(".settings-menu-item");
        if (!item) return;

        const name = item.dataset.indicator;
        if (!name) return;

        menu.querySelectorAll(".settings-menu-item")
          .forEach(li => li.classList.toggle("active", li === item));

        currentIndicator = name;

        if (name === INDICATOR_RSI) {
          currentTitleEl.textContent = "RSI";
          currentSubtitleEl.textContent = "Настройки индикатора Relative Strength Index";

          rsiBlock.classList.remove("hidden");
          intervalsBlock.classList.add("hidden");

          globalToggle.parentElement.classList.remove("hidden");

          window.RSI_load();
        }
        else if (name === INDICATOR_INTERVALS) {
          currentTitleEl.textContent = "Интервалы";
          currentSubtitleEl.textContent = "Включение/выключение таймфреймов";

          rsiBlock.classList.add("hidden");
          intervalsBlock.classList.remove("hidden");

          globalToggle.parentElement.classList.add("hidden");

          window.INTERVALS_load();
        }
        else {
          currentTitleEl.textContent = name;
          currentSubtitleEl.textContent = "Раздел в разработке";

          rsiBlock.classList.add("hidden");
          intervalsBlock.classList.add("hidden");

          globalToggle.parentElement.classList.add("hidden");
        }
      });
    }

    // -----------------------------
    // Кнопка "Сохранить"
    // -----------------------------
    document.getElementById("settings-save-btn")?.addEventListener("click", () => {
      if (currentIndicator === INDICATOR_RSI) {
        window.RSI_save();
      }
      if (currentIndicator === INDICATOR_INTERVALS) {
        window.INTERVALS_save();
      }
    });

    // -----------------------------
    // Кнопка "Сбросить"
    // -----------------------------
    document.getElementById("settings-reset-btn")?.addEventListener("click", () => {
      if (currentIndicator === INDICATOR_RSI) window.RSI_load();
      if (currentIndicator === INDICATOR_INTERVALS) window.INTERVALS_load();
    });

    // -----------------------------
    // Запускаем по умолчанию
    // -----------------------------
    window.RSI_load();
  });

})();
