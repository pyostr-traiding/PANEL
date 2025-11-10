/* =============================================================================
   State: конфигурация и текущее состояние приложения
   -----------------------------------------------------------------------------
   - Берём access_token из localStorage (устанавливается сервером при рендере)
   - Формируем WebSocket URL с этим токеном
   - Обрабатываем потерю авторизации
   ========================================================================== */
(function (w) {
  // ---- Token ----
  const token = localStorage.getItem('access_token');
  if (!token) {
    console.warn('⚠️ Нет access_token в localStorage — WebSocket подключение может быть отклонено.');
  }

  // ---- WS URL ----
  const WS_URL = `wss://docker.24trade.online/ws?token=${encodeURIComponent(token || '')}`;

  // ---- State ----
  const state = {
    ws: null,
    reconnectTimer: null,
    RECONNECT_MS: 5000,

    containers: new Map(),     // id -> brief
    currentContainerId: null,  // выбранный контейнер (модалка)
    streamingForId: null,      // id контейнера для live-логов
    pendingOps: new Set(),     // id контейнеров с активной операцией
  };

  // ---- WebSocket reconnect helper ----
  state.handleClose = (event) => {
    if (event.code === 1008) {
      console.warn("⛔ Неверный токен — требуется обновление");
      localStorage.removeItem('access_token');
      alert('Доступ запрещён. Токен устарел или неверный.\nСтраница будет обновлена.');
      location.reload();
      return;
    }
    console.log("🔌 Соединение закрыто, код:", event.code);
  };

  // ---- Export ----
  w.DockerUI = w.DockerUI || {};
  w.DockerUI.state = { WS_URL, state };
})(window);
