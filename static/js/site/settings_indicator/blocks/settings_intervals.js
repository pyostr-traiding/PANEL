(function () {

  const INDICATOR_INTERVALS = "INTERVALS";
  const ALL_INTERVALS = [1, 5, 15, 30, 60, 120];

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
    if (el) {
      el.textContent = text;
      el.style.color = isError ? "#ff6b6b" : "var(--text-secondary)";
    }
  }

  window.INTERVALS_load = function () {
    showStatus("Загрузка...", false);

    fetch(`/api/settings/indicator/?name=${INDICATOR_INTERVALS}`)
      .then(r => r.json())
      .then(data => {
        apply(data.json || {});
        showStatus("Загружено", false);
      })
      .catch(() => showStatus("Ошибка загрузки", true));
  };

  function apply(settings) {
    const root = document.getElementById("settings-intervals-block");
    ALL_INTERVALS.forEach(itv => {
      const sw = root.querySelector(`.interval-switch[data-interval="${itv}"]`);
      if (sw) sw.checked = settings[itv] === true;
    });
  }

  window.INTERVALS_save = function () {
    showStatus("Сохранение...", false);

    const root = document.getElementById("settings-intervals-block");

    const result = {};
    ALL_INTERVALS.forEach(itv => {
      const sw = root.querySelector(`.interval-switch[data-interval="${itv}"]`);
      result[itv] = sw?.checked || false;
    });

    const payload = {
      name: INDICATOR_INTERVALS,
      json: result
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

})();
