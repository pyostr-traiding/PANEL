(function () {
  function formatDuration(ms) {
    let totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    totalSec %= 86400;
    const hours = Math.floor(totalSec / 3600);
    totalSec %= 3600;
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;

    const parts = [];
    if (days > 0) parts.push(days + "д");
    if (hours > 0 || days > 0) parts.push(hours + "ч");
    parts.push(minutes + "м");
    parts.push(seconds + "с");

    return parts.join(" ");
  }

  function updateLifetime() {
    const now = new Date();
    document.querySelectorAll(".js-lifetime").forEach((el) => {
      const createdAtStr = el.dataset.createdAt;
      if (!createdAtStr) return;

      const createdAt = new Date(createdAtStr);
      const diff = now - createdAt;
      if (diff < 0) {
        el.textContent = "—";
        return;
      }

      el.textContent = formatDuration(diff);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateLifetime();
    setInterval(updateLifetime, 1000);
  });
})();
