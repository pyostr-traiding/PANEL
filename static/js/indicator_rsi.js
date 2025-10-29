const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
const wsUrl = `${wsScheme}://${window.location.host}/ws/signals/`;

let ws;
let dataTimers = {}; // { "RSI-1": timeoutId, ... }
let lastDataTimestamps = {}; // { "RSI-1": timestamp, ... }

// === Подключение ===
function connectWS() {
  setStatus('yellow', 'Подключение...');
  ws = new WebSocket(wsUrl);

  ws.onopen = () => setStatus('green', 'Подключено');
  ws.onclose = () => setStatus('red', 'Отключено');
  ws.onerror = () => setStatus('red', 'Ошибка');

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };
}

function setStatus(color, text) {
  const statusEl = document.getElementById('ws-status');
  const textEl = document.getElementById('ws-status-text');
  statusEl.className = `status ${color}`;
  textEl.textContent = text;
}

// === Обработка входящих данных ===
function handleMessage(data) {
  if (!data.values || !Array.isArray(data.values)) return;

  // определяем тип
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

// === Отображение данных ===
function updateIntervalBlock(type, interval, valueData) {
  const block = document.querySelector(`.interval-block[data-type="${type}"][data-interval="${interval}"]`);
  if (!block) return;

  const value =
    type === 'RSI'
      ? valueData.value?.toFixed(2)
      : `${valueData.value_k?.toFixed(2)} / ${valueData.value_d?.toFixed(2)}`;

  block.innerHTML = `
    <b>Интервал:</b> ${interval} мин<br>
    <b>${type}</b><br>
    <b>Значение:</b> ${value}<br>
    <b>Сторона:</b> ${valueData.side}<br>
    <b>Цель:</b> ${valueData.target_rate.toFixed(2)}<br>
    <small>Обновлено: ${new Date().toLocaleTimeString()}</small>
  `;

  highlightBlock(block);
  resetTimer(type, interval);
}

// === Подсветка обновления ===
function highlightBlock(block) {
  block.classList.add('updated');
  setTimeout(() => block.classList.remove('updated'), 600);
}

// === Таймер удаления старых данных ===
function resetTimer(type, interval) {
  const key = `${type}-${interval}`;
  if (dataTimers[key]) clearTimeout(dataTimers[key]);

  dataTimers[key] = setTimeout(() => {
    const now = Date.now();
    if (now - lastDataTimestamps[key] > 5000) {
      clearIntervalBlock(type, interval);
    }
  }, 5500);
}

function clearIntervalBlock(type, interval) {
  const block = document.querySelector(`.interval-block[data-type="${type}"][data-interval="${interval}"]`);
  if (block) {
    block.innerHTML = `<b>Интервал:</b> ${interval} мин<br><i>Нет данных</i>`;
  }
}

// === Инициализация ===
window.addEventListener('load', connectWS);
window.addEventListener('beforeunload', () => ws && ws.close());
