/* =============================================================================
   Toast system: всплывающие уведомления
   ========================================================================== */
(function (w) {
  const container = document.getElementById('toast-container') || (() => {
    const c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();

  function showToast(message, type = 'info', duration = 3500) {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;

    container.appendChild(t);
    setTimeout(() => t.classList.add('show'), 30);

    const remove = () => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    };

    t.addEventListener('click', remove);
    setTimeout(remove, duration);
  }

  w.DockerUI = w.DockerUI || {};
  w.DockerUI.toast = showToast;
})(window);
