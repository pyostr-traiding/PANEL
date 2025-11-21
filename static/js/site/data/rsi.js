const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
const wsUrl = `${wsScheme}://${window.location.host}/ws/signals/`;

let ws;
let dataTimers = {};
let countdownIntervals = {};
let lastDataTimestamps = {};
let infoTimers = {}; // Для инфо-блоков
let lastInfoTimestamps = {};
const DATA_LIFETIME = 5000;

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
  if (data.type === "INFO") {
    handleInfoFormat(data);
    return;
  }

  if (data.values && Array.isArray(data.values)) {
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
    return;
  }
}

// === Обработка нового формата INFO ===
function handleInfoFormat(data) {
  if (data.RSI) updateIndicatorInfo("RSI", data.RSI);
  if (data.StochRSI) updateIndicatorInfo("STOCH_RSI", data.StochRSI);
}

// === Инфо-блок снизу ===
function updateIndicatorInfo(type, block) {
  const blockId = type === "RSI" ? "rsi-info-block" : "stochrsi-info-block";
  const el = document.getElementById(blockId);
  if (!el) return;

  if (!block) {
    el.innerHTML = "<i>Нет данных</i>";
    return;
  }

  // Пишем время обновления для этого блока
  lastInfoTimestamps[type] = Date.now();

  el.innerHTML = `
    <div><b>Активно:</b> ${block.is_active ? "Да" : "Нет"}</div>
    <div><b>Интервалы:</b> ${block.intervals?.join(", ") || "-"}</div>
    <div><b>BUY predict:</b> ${block.buy?.predict?.join(", ") || "-"}</div>
    <div><b>SELL predict:</b> ${block.sell?.predict?.join(", ") || "-"}</div>
    <div><b>Actives:</b> ${
      block.actives
        ? Object.entries(block.actives)
            .map(([k, v]) => `${k}: ${v ? "да" : "нет"}`)
            .join(', ')
        : "-"
    }</div>
    <div class="info-timer" id="${blockId}-timer">5s</div>
  `;

  // Сбрасываем таймер, если уже был
  if (infoTimers[type]) clearInterval(infoTimers[type]);

  let remaining = DATA_LIFETIME / 1000;
  const timerEl = document.getElementById(`${blockId}-timer`);
  if (timerEl) timerEl.textContent = `${remaining}s`;

  infoTimers[type] = setInterval(() => {
    remaining -= 1;
    if (timerEl) {
      timerEl.textContent = `${remaining > 0 ? remaining : 0}s`;
    }
    if (remaining <= 0) {
      clearInterval(infoTimers[type]);
      // Проверяем, не пришло ли новое обновление
      if (Date.now() - lastInfoTimestamps[type] >= DATA_LIFETIME) {
        clearInfoBlock(type);
      }
    }
  }, 1000);
}

function clearInfoBlock(type) {
  const blockId = type === "RSI" ? "rsi-info-block" : "stochrsi-info-block";
  const el = document.getElementById(blockId);
  if (el) el.innerHTML = "<i>Нет данных</i>";
  if (infoTimers[type]) clearInterval(infoTimers[type]);
}

// === Отрисовка блока с сигналом ===
function updateIntervalBlock(type, interval, valueData) {
  const block = document.querySelector(`.interval-block[data-type="${type}"][data-interval="${interval}"]`);
  if (!block) return;

  const value =
    type === 'RSI'
      ? (valueData.value !== undefined ? valueData.value.toFixed(2) : "—")
      : `${valueData.value_k !== undefined ? valueData.value_k.toFixed(2) : "—"} / ${valueData.value_d !== undefined ? valueData.value_d.toFixed(2) : "—"}`;

  block.innerHTML = `
    <div class="update-indicator"></div>
    <div class="timer"></div>
    <b>Интервал:</b> ${interval} мин<br>
    <b>${type}</b><br>
    <b>Значение:</b> ${value}<br>
    <b>Сторона:</b> ${valueData.side || "—"}<br>
    <b>Цель:</b> ${valueData.target_rate !== undefined ? valueData.target_rate.toFixed(2) : "—"}<br>
    <small>Обновлено: ${new Date().toLocaleTimeString()}</small>
  `;

  block.classList.remove('buy', 'sell');
  if (valueData.side?.toUpperCase() === 'BUY') block.classList.add('buy');
  else if (valueData.side?.toUpperCase() === 'SELL') block.classList.add('sell');

  highlightBlock(block);
  startCountdown(block, type, interval);
  resetTimer(type, interval);
}

// === Мигание кружка ===
function highlightBlock(block) {
  block.classList.add('updated');
  setTimeout(() => block.classList.remove('updated'), 600);
}

// === Таймер обратного отсчета для интервал-блоков ===
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
