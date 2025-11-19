(function () {

  const INDICATOR = "STOCH_RSI";
  const INTERVALS = [1, 5, 15, 30, 60];

  function getCookie(name) {
    const cookies = document.cookie.split(";");
    for (let c of cookies) {
      c = c.trim();
      if (c.startsWith(name + "="))
        return decodeURIComponent(c.slice(name.length + 1));
    }
    return null;
  }

  function showStatus(text, isError) {
    const el = document.getElementById("settings-save-status");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "#ff6b6b" : "var(--text-secondary)";
  }

  function parseRange(str) {
    if (!str) return { from: "", to: "" };
    const [a, b] = String(str).split("-");
    return { from: a?.trim() || "", to: b?.trim() || "" };
  }

  // ----------------------------------------
  // LOAD
  // ----------------------------------------
  window.STOCH_RSI_load = function () {
    showStatus("Загрузка...", false);

    fetch(`/api/settings/indicator/?name=${INDICATOR}`)
      .then(r => r.json())
      .then(data => {
        applySettings(data.json || {});
        showStatus("Загружено", false);
      })
      .catch(() => showStatus("Ошибка загрузки", true));
  };

  function applySettings(settings) {
    const root = document.querySelector('[data-indicator="StochRSI"]');
    const globalToggle = document.getElementById("indicator-active");

    if (!root) return;

    const isActive = settings.is_active === true;
    globalToggle.checked = isActive;

    root.classList.toggle("is-inactive", !isActive);

    const enabled = settings.intervals || [];

    resetForm(root);

    INTERVALS.forEach(itv => {
      const toggles = root.querySelectorAll(`.interval-enabled[data-interval-header="${itv}"]`);
      const active = enabled.includes(itv);

      toggles.forEach(t => {
        t.checked = active;
        t.closest(".interval-card").classList.toggle("interval-disabled", !active);
      });
    });

    ["buy", "sell"].forEach(side => {
      const sideValues = settings[side]?.values || [];
      const sidePred = settings[side]?.predict || [];

      enabled.forEach(itv => {
        const idx = enabled.indexOf(itv);
        const card = root.querySelector(`.interval-card[data-side="${side}"][data-interval="${itv}"]`);
        if (!card) return;

        const { from, to } = parseRange(sideValues[idx] || "");
        card.querySelector(`[data-field="from"]`).value = from;
        card.querySelector(`[data-field="to"]`).value = to;

        const pred = sidePred[idx];
        if (typeof pred === "number") {
          let perc = (pred * 100).toFixed(2).replace(/\.00$/, "");
          card.querySelector(`[data-field="predict"]`).value = perc;
        }
      });
    });
  }

  function resetForm(root) {
    root.querySelectorAll(".field-input").forEach(i => i.value = "");
    root.querySelectorAll(".interval-enabled").forEach(t => {
      t.checked = false;
      t.closest(".interval-card").classList.add("interval-disabled");
    });
  }

  function getEnabled(root) {
    const enabled = new Set();
    INTERVALS.forEach(itv => {
      root.querySelectorAll(`.interval-enabled[data-interval-header="${itv}"]`)
        .forEach(t => {
          if (t.checked) enabled.add(itv);
        });
    });
    return [...enabled];
  }

  // ----------------------------------------
  // SAVE
  // ----------------------------------------
  window.STOCH_RSI_save = function () {
    const root = document.querySelector('[data-indicator="StochRSI"]');
    const globalToggle = document.getElementById("indicator-active");

    if (!root) return;

    showStatus("Сохранение...", false);

    const enabled = getEnabled(root);
    const active = globalToggle.checked;

    function makeSide(side) {
      const values = [];
      const predict = [];

      enabled.forEach(itv => {
        const card = root.querySelector(`.interval-card[data-side="${side}"][data-interval="${itv}"]`);
        const f = card.querySelector(`[data-field="from"]`).value || "0";
        const t = card.querySelector(`[data-field="to"]`).value || "0";

        const pRaw = card.querySelector(`[data-field="predict"]`).value || "0";
        const p = parseFloat(pRaw.replace(",", ".")) / 100 || 0;

        values.push(`${f}-${t}`);
        predict.push(p);
      });

      return { values, predict };
    }

    const payload = {
      name: INDICATOR,
      json: {
        intervals: enabled,
        is_active: active,
        buy: makeSide("buy"),
        sell: makeSide("sell")
      }
    };

    const csrftoken = getCookie("csrftoken");

    fetch("/api/settings/indicator/", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(csrftoken ? { "X-CSRFToken": csrftoken } : {})
      },
      body: JSON.stringify(payload)
    })
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json().catch(() => ({}));
      })
      .then(() => showStatus("Сохранено", false))
      .catch(() => showStatus("Ошибка сохранения", true));
  };

  // ----------------------------------------
  // Live переключение карточек
  // ----------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const root = document.querySelector('[data-indicator="StochRSI"]');
    if (!root) return;

    root.querySelectorAll(".interval-enabled").forEach(input => {
      input.addEventListener("change", () => {
        const card = input.closest(".interval-card");
        card.classList.toggle("interval-disabled", !input.checked);
      });
    });
  });

})();
