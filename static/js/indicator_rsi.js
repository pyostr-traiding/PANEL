const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
const wsUrl = `${wsScheme}://${window.location.host}/ws/kline/`;

let ws;
let dataTimers = {}; // {interval: timeoutId}
let lastDataTimestamps = {}; // {interval: timestamp}

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
  data.values.forEach(v => {
    const interval = v.interval;
    lastDataTimestamps[interval] = Date.now();
    updateIntervalBlock(interval, data.type, v);
  });
}

// === Отображение данных ===
function updateIntervalBlock(interval, type, valueData) {
  const block = document.querySelector(`.interval-block[data-interval="${interval}"]`);
  if (!block) return;

  block.innerHTML = `
    <b>Интервал: ${interval} мин</b><br>
    <b>Тип:</b> ${type}<br>
    <b>Значение:</b> ${valueData.value ?? `${valueData.value_k} / ${valueData.value_d}`}<br>
    <b>Сторона:</b> ${valueData.side}<br>
    <b>Обновлено:</b> ${new Date().toLocaleTimeString()}
  `;

  resetTimer(interval);
}

// === Таймер удаления старых данных ===
function resetTimer(interval) {
  if (dataTimers[interval]) clearTimeout(dataTimers[interval]);

  dataTimers[interval] = setTimeout(() => {
    const now = Date.now();
    if (now - lastDataTimestamps[interval] > 5000) {
      clearIntervalBlock(interval);
    }
  }, 5500);
}

function clearIntervalBlock(interval) {
  const block = document.querySelector(`.interval-block[data-interval="${interval}"]`);
  if (block) block.innerHTML = '';
}

// === Инициализация ===
window.addEventListener('load', connectWS);
window.addEventListener('beforeunload', () => {
  if (ws) ws.close();
});
