  const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${wsScheme}://${window.location.host}/ws/signals/`;

  let ws;
  let dataTimers = {};            // { "RSI-1": timeoutId, ... }
  let countdownIntervals = {};    // { "RSI-1": intervalId, ... }
  let lastDataTimestamps = {};    // { "RSI-1": timestamp, ... }
  const DATA_LIFETIME = 5000;     // 5 секунд

  // === Подключение ===
  function connectWS() {
    setStatus('yellow', 'Подключение...');
    ws = new WebSocket(wsUrl);

    ws.onopen = () => setStatus('green', 'Подключено');
    ws.onclose = () => setStatus('red', 'Отключено');
    ws.onerror = () => setStatus('red', 'Ошибка');
    ws.onmessage = (event) => handleMessage(JSON.parse(event.data));
  }

  function setStatus(color, text) {
    document.getElementById('ws-status').className = `status ${color}`;
    document.getElementById('ws-status-text').textContent = text;
  }

  // === Обработка входящих данных ===
  function handleMessage(data) {
    if (!data.values || !Array.isArray(data.values)) return;

    let typeKey = null;
    if (data.type.includes('RSI') && !data.type.includes('STOCH')) {
      typeKey = 'RSI';
    } else if (data.type.includes('STOCH_RSI')) {
      typeKey = 'STOCH_RSI';
    } else {
      return;
    }

    data.values.forEach(v => {
      const interval = v.interval;
      const key = `${typeKey}-${interval}`;
      lastDataTimestamps[key] = Date.now();
      updateIntervalBlock(typeKey, interval, v);
    });
  }

  // === Обновление блока ===
  function updateIntervalBlock(type, interval, valueData) {
    const block = document.querySelector(`.interval-block[data-type="${type}"][data-interval="${interval}"]`);
    if (!block) return;

    const value =
      type === 'RSI'
        ? valueData.value?.toFixed(2)
        : `${valueData.value_k?.toFixed(2)} / ${valueData.value_d?.toFixed(2)}`;

    block.innerHTML = `
      <div class="update-indicator"></div>
      <div class="timer"></div>
      <b>Интервал:</b> ${interval} мин<br>
      <b>${type}</b><br>
      <b>Значение:</b> ${value}<br>
      <b>Сторона:</b> ${valueData.side}<br>
      <b>Цель:</b> ${valueData.target_rate.toFixed(2)}<br>
      <small>Обновлено: ${new Date().toLocaleTimeString()}</small>
    `;

    // BUY / SELL подсветка
    block.classList.remove('buy', 'sell');
    if (valueData.side?.toUpperCase() === 'BUY') block.classList.add('buy');
    else if (valueData.side?.toUpperCase() === 'SELL') block.classList.add('sell');

    // мигание кружочка
    highlightBlock(block);

    // запуск таймера обратного отсчета
    startCountdown(block, type, interval);

    // сброс удаления старых данных
    resetTimer(type, interval);
  }

  // === Мигание кружка ===
  function highlightBlock(block) {
    block.classList.add('updated');
    setTimeout(() => block.classList.remove('updated'), 600);
  }

  // === Таймер обратного отсчета ===
  function startCountdown(block, type, interval) {
    const key = `${type}-${interval}`;
    const timerEl = block.querySelector('.timer');
    if (!timerEl) return;

    if (countdownIntervals[key]) clearInterval(countdownIntervals[key]);

    let remaining = DATA_LIFETIME / 1000;
    timerEl.textContent = `${remaining}s`;

    countdownIntervals[key] = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownIntervals[key]);
        timerEl.textContent = `0s`;
      } else {
        timerEl.textContent = `${remaining}s`;
      }
    }, 1000);
  }

  // === Сброс и очистка старых данных ===
  function resetTimer(type, interval) {
    const key = `${type}-${interval}`;
    if (dataTimers[key]) clearTimeout(dataTimers[key]);

    dataTimers[key] = setTimeout(() => {
      const now = Date.now();
      if (now - lastDataTimestamps[key] > DATA_LIFETIME) {
        clearInterval(countdownIntervals[key]);
        clearIntervalBlock(type, interval);
      }
    }, DATA_LIFETIME + 500);
  }

  function clearIntervalBlock(type, interval) {
    const block = document.querySelector(`.interval-block[data-type="${type}"][data-interval="${interval}"]`);
    if (block) {
      block.innerHTML = `<b>Интервал:</b> ${interval} мин<br><i>Нет данных</i>`;
      block.classList.remove('buy', 'sell');
    }
  }

  // === Инициализация ===
  window.addEventListener('load', connectWS);
  window.addEventListener('beforeunload', () => ws && ws.close());
