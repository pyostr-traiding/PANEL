const API_URL = "/api/front/monitoring/";
const wsScheme = location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${wsScheme}://${location.host}/ws/monitoring/`;

let ws;
let reconnectTimer = null;
let currentModal = null; // { type, id }

const positionsEl = document.getElementById("positions");
const ordersEl = document.getElementById("orders");

const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");
document.getElementById("modal-close").onclick = () => modal.style.display = "none";


function showNoData(container) {
    container.innerHTML = `
        <div class="no-data" id="no-data-block">
            <b>404</b><br>
            Данные не найдены.
        </div>
    `;
}

function hideNoData(container) {
    const nd = container.querySelector("#no-data-block");
    if (nd) nd.remove();
}

/* ============================================================
   СТАТУС СОКЕТА
============================================================ */
function setStatus(color, text) {
    document.getElementById("ws-status").className = `status ${color}`;
    document.getElementById("ws-status-text").textContent = text;
}

/* ============================================================
   Подключение к WebSocket
============================================================ */
function connectWS() {
    setStatus("yellow", "Подключение...");
    ws = new WebSocket(WS_URL);

    ws.onopen = () => setStatus("green", "Подключено");
    ws.onclose = () => {
        setStatus("red", "Отключено");
        attemptReconnect();
    };
    ws.onerror = () => {
        setStatus("red", "Ошибка");
        ws.close();
    };

    ws.onmessage = (e) => handleWS(JSON.parse(e.data));
}

function attemptReconnect() {
    if (reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWS();
    }, 2000);
}

/* ============================================================
   Обработка сообщений WebSocket
============================================================ */
function handleWS(msg) {
    const { id, type, method, data } = msg;

    if (method === "set") {
        renderItem(type, id, data);
    }
    else if (method === "delete") {
        removeItem(type, id);
    }
}

/* ============================================================
   API-загрузка
============================================================ */
async function loadInitial(key, container) {
    const url = `${API_URL}?key=${key}`;

    container.innerHTML = ""; // очистка

    try {
        const resp = await fetch(url);

       if (resp.status === 404) {
            showNoData(container);
            return;
        }


        if (!resp.ok) {
            container.innerHTML = `
                <div class="no-data">
                    <b>${resp.status}</b><br>
                    Ошибка загрузки данных.
                </div>
            `;
            return;
        }

        const arr = await resp.json();

        arr.forEach(item => {
            const id = item.key.split(":")[1];
            const data = JSON.parse(item.value);
            renderItem(key, id, data);
        });

    } catch (err) {
        container.innerHTML = `
            <div class="no-data">
                <b>Ошибка</b><br>
                Не удалось получить данные.
            </div>
        `;
    }
}

/* ============================================================
   Рендер блока
============================================================ */
function renderItem(type, id, data) {
    const container = type === "position" ? positionsEl : ordersEl;

    // Удаляем 404 если есть
    hideNoData(container);

    const blockId = `${type}-${id}`;
    let block = document.getElementById(blockId);

    if (!block) {
        block = document.createElement("div");
        block.id = blockId;
        block.className = "item";
        container.appendChild(block);
    }

    const sideCls = data.side.toLowerCase() === "buy" ? "buy" : "sell";

    block.innerHTML = `
        <div class="symbol">${data.symbol}</div>
        <div class="side ${sideCls}">${data.side.toUpperCase()}</div>
        <div><b>UUID:</b> ${data.uuid}</div>
        <div><b>Курс входа:</b> ${data.price_entry}</div>
        <div><b>Макс:</b> ${data.max_price}</div>
        <div><b>Мин:</b> ${data.min_price}</div>
        <div><b>Дата:</b> ${data.dt || "-"}</div>
        <button onclick="openModal('${type}', '${id}')">Подробности</button>
    `;
}


/* ============================================================
   Удаление
============================================================ */
function removeItem(type, id) {
    const block = document.getElementById(`${type}-${id}`);
    if (block) block.remove();

    const container = type === "position" ? positionsEl : ordersEl;

    // Если больше нет элементов — показываем 404
    const hasItems = container.querySelector(".item");

    if (!hasItems) {
        showNoData(container);
    }
}


/* ============================================================
   Модалка
============================================================ */
function openModal(type, id) {
    const block = document.getElementById(`${type}-${id}`);
    if (!block) return;

    currentModal = { type, id };

    let html = "";

    block.querySelectorAll("div").forEach(row => {
        html += `<div>${row.innerHTML}</div>`;
    });

    modalBody.innerHTML = html;
    modal.style.display = "flex";
}


/* ============================================================
   Переключение вкладок
============================================================ */
document.querySelectorAll(".monitoring-tabs a").forEach(btn => {
    btn.addEventListener("click", e => {
        e.preventDefault();

        document.querySelector(".monitoring-tabs a.active")
            .classList.remove("active");
        btn.classList.add("active");

        const tab = btn.dataset.tab;

        // сохраняем вкладку
        localStorage.setItem("monitoringTab", tab);

        document.querySelectorAll(".tab-block")
            .forEach(t => t.classList.remove("active"));

        document.getElementById(tab).classList.add("active");

        if (tab === "positions") loadInitial("position", positionsEl);
        else loadInitial("order", ordersEl);
    });
});


/* ============================================================
   Закрытие модалки по фону
============================================================ */
window.addEventListener("click", (e) => {
    const content = document.getElementById("modal-content");
    if (e.target === modal) {
        modal.style.display = "none";
    }
});
document.getElementById("modal-close").onclick = () => {
    modal.style.display = "none";
};

/* ============================================================
   Удаление
============================================================ */
document.getElementById("modal-delete").onclick = async () => {
    if (!currentModal) return;

    const { type, id } = currentModal;
    const key = `${type}:${id}`;

    await fetch(`/api/front/monitoring/delete?key=${key}`, {
        method: "DELETE"
    });

    removeItem(type, id);
    modal.style.display = "none";
};

/* ============================================================
   Старт
============================================================ */

window.addEventListener("load", () => {
    const savedTab = localStorage.getItem("monitoringTab") || "positions";

    // 1. Сбрасываем активные вкладки
    document.querySelectorAll(".monitoring-tabs a")
        .forEach(a => a.classList.remove("active"));

    // 2. Сбрасываем активные контейнеры табов
    document.querySelectorAll(".tab-block")
        .forEach(block => block.classList.remove("active"));

    // 3. Активируем сохранённую вкладку
    document.querySelector(`.monitoring-tabs a[data-tab="${savedTab}"]`)
        .classList.add("active");

    // 4. Показываем нужный контейнер
    document.getElementById(savedTab).classList.add("active");

    // 5. Загружаем данные
    if (savedTab === "positions") loadInitial("position", positionsEl);
    else loadInitial("order", ordersEl);

    connectWS();
});


window.addEventListener("beforeunload", () => ws && ws.close());
