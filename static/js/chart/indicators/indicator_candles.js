const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
const wsUrl = `${wsScheme}://${window.location.host}/ws/kline/`;

let ws;
let candlesTimers = {};
let candlesLastUpdate = {};

function connectWS() {
  setStatus('yellow', 'Подключение...');
  ws = new WebSocket(wsUrl);

  ws.onopen = () => setStatus('green', 'Подключено');
  ws.onclose = () => setStatus('red', 'Отключено');
  ws.onerror = () => setStatus('red', 'Ошибка');
  ws.onmessage = (event) => handleMessage(JSON.parse(event.data));
}

function setStatus(color, text) {
  const statusEl = document.getElementById('ws-status');
  const textEl = document.getElementById('ws-status-text');
  statusEl.className = `status ${color}`;
  textEl.textContent = text;
}

function handleMessage(msg) {
  if (msg.type !== 'kline_update') return;

  const { interval, data } = msg.data;
  candlesLastUpdate[interval] = Date.now();

  ensureBlockExists(interval);
  updateBlock(interval, data);
  resetTimer(interval);
}

function ensureBlockExists(interval) {
  const container = document.getElementById('candles-blocks');
  let block = container.querySelector(`.interval-block[data-interval="${interval}"]`);
  if (!block) {
    block = document.createElement('div');
    block.classList.add('interval-block');
    block.dataset.interval = interval;
    container.appendChild(block);
  }
}
function highlightBlock(block) {
  block.classList.add('updated');
  setTimeout(() => block.classList.remove('updated'), 800);
}
function updateBlock(interval, data) {
  const block = document.querySelector(`.interval-block[data-interval="${interval}"]`);
  if (!block) return;

  const price = parseFloat(data.c).toFixed(2);
  const time = new Date().toLocaleTimeString();

  block.innerHTML = `
    <b>Интервал:</b> ${interval} мин<br>
    <b>Цена:</b> ${price}<br>
    <b>Время:</b> ${time}<br>
    <small>${data.dt}</small>
  `;

  highlightBlock(block);
}


function resetTimer(interval) {
  if (candlesTimers[interval]) clearTimeout(candlesTimers[interval]);
  candlesTimers[interval] = setTimeout(() => {
    const now = Date.now();
    if (now - candlesLastUpdate[interval] > 10000) {
      clearBlock(interval);
    }
  }, 11000);
}

function clearBlock(interval) {
  const block = document.querySelector(`.interval-block[data-interval="${interval}"]`);
  if (!block) return;

  // очищаем только, если это не базовый интервал
  const baseIntervals = [1, 5, 15, 30, 60];
  if (baseIntervals.includes(Number(interval))) {
    block.innerHTML = `<b>Интервал:</b> ${interval} мин<br><i>Нет данных</i>`;
  } else {
    block.remove();
  }
}

window.addEventListener('load', connectWS);
window.addEventListener('beforeunload', () => ws && ws.close());
