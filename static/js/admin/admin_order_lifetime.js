(function () {
  /**
   * Форматирует длительность в человекочитаемый формат: 1д 3ч 12м 5с
   */
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

  /**
   * Обновляет все элементы времени жизни (.js-lifetime)
   */
  function updateLifetime() {
    const now = new Date();

    document.querySelectorAll(".js-lifetime").forEach((el) => {
      const createdAtStr = el.dataset.createdAt;
      const closedAtStr = el.dataset.closedAt;
      const status = (el.dataset.status || "").toUpperCase();

      if (!createdAtStr) {
        el.textContent = "—";
        return;
      }

      const createdAt = new Date(createdAtStr);
      let endTime;

      // Если ордер исполнен или есть время закрытия — считаем до CloseAt
      if (status === "ИСПОЛНЕНО" || status === "COMPLETED" || closedAtStr) {
        endTime = closedAtStr ? new Date(closedAtStr) : now;
      } else {
        // Иначе — ордер активен, считаем до текущего времени
        endTime = now;
      }

      const diff = endTime - createdAt;
      if (diff < 0) {
        el.textContent = "—";
        return;
      }

      el.textContent = formatDuration(diff);
    });
  }

  /**
   * Если блок динамически обновлён и стал "Исполнен",
   * функция фиксирует время жизни (через close_at)
   */
  window.fixLifetimeForClosedOrder = function (block, closeAt) {
    const lifetimeEl = block.querySelector(".js-lifetime");
    if (!lifetimeEl) return;

    // фиксируем окончание и обновляем статус
    lifetimeEl.dataset.closedAt = closeAt || new Date().toISOString();
    lifetimeEl.dataset.status = "ИСПОЛНЕНО";

    // сразу пересчитать для наглядности
    updateLifetime();
  };

  document.addEventListener("DOMContentLoaded", () => {
    updateLifetime();
    setInterval(updateLifetime, 1000);
  });
})();
