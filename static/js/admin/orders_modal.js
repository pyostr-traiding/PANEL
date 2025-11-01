const STOP_STATUSES = ['Исполнен', 'Отменен', 'Закрыт|Мониторинг'];

function comparePrices(closePriceStr, priceStr, side) {
    const closePrice = parseFloat(closePriceStr);
    const price = parseFloat(priceStr);
    const diffPercent = ((closePrice - price) / price) * 100;

    if (parseFloat(closePrice.toFixed(10)) === parseFloat(price.toFixed(10))) {
        return 'black';
    }

    if (side === 'buy') {
        if (closePrice < price) return 'red';
        if (closePrice > price && diffPercent <= 0.05) return 'purple';
        if (closePrice > price) return 'green';
    } else if (side === 'sell') {
        if (closePrice > price) return 'red';
        if (closePrice < price && Math.abs(diffPercent) <= 0.08) return 'purple';
        if (closePrice < price) return 'green';
    }

    return 'black';
}

function calculatePnL(qtyStr, entryStr, currentStr, side) {
    const qty = parseFloat(qtyStr);
    const entry = parseFloat(entryStr);
    const current = parseFloat(currentStr);
    if (isNaN(qty) || isNaN(entry) || isNaN(current)) return null;

    const commissionRate = 0.0005;
    let profit = 0;

    if (side === 'buy') {
        // Купили по entry, продали по current
        const spent = entry * qty * (1 + commissionRate); // комиссия на вход
        const received = current * qty * (1 - commissionRate); // комиссия на выход
        profit = received - spent;
    } else if (side === 'sell') {
        // Продали по entry, откупили по current
        const received = entry * qty * (1 - commissionRate); // комиссия на вход
        const spent = current * qty * (1 + commissionRate); // комиссия на выход
        profit = received - spent;
    } else {
        return null;
    }

    return {
        pnl: profit,
        pnlFormatted: profit.toFixed(6),
    };
}


let latestClosePrice = null;
let modalOpen = false;
let currentModalData = null;

const modal = document.getElementById('rate-modal');
const modalContent = document.getElementById('modal-content');
const overlay = document.getElementById('modal-overlay');
const closeBtn = document.getElementById('modal-close-btn');

function updateTablePrices(closePrice) {
    document.querySelectorAll('.current-rate').forEach(span => {
        const status = span.getAttribute('data-status');
        if (STOP_STATUSES.includes(status)) return;

        const price = span.getAttribute('data-price');
        const qty = span.getAttribute('data-qty');
        const side = span.getAttribute('data-side');

        span.textContent = closePrice;

        // Определяем цвет ячейки
        let color = 'black';
        if (price && qty && side) {
            const result = calculatePnL(qty, price, closePrice, side);
            if (result) {
                color = result.pnl >= 0 ? 'green' : 'red';
            }
        }

        // fallback — если P&L не рассчитался, используем сравнение цен
        if (color === 'black') {
            color = comparePrices(closePrice, price, side);
        }

        span.style.color = color;
    });
}

function updateModalContent() {
    if (!modalOpen || !currentModalData) return;

    const { id, price, qty, status, side, close } = currentModalData;
    const isClosed = STOP_STATUSES.includes(status);
    const rateToShow = isClosed ? close : latestClosePrice;

    let pnlHTML = '';
    let rateLabel = isClosed ? "Курс закрытия" : "Текущий курс";
    let rateColor = 'black';

    if (rateToShow && rateToShow !== 'None' && price && side && qty) {
        rateColor = comparePrices(rateToShow, price, side);

        // рассчитываем PnL с учётом комиссии
        const result = calculatePnL(qty, price, rateToShow, side);
        if (result) {
            const pnlColor = result.pnl >= 0 ? 'green' : 'red';
            pnlHTML = `
                <p><strong>P&amp;L:</strong> <span style="color:${pnlColor}">${result.pnlFormatted}</span></p>
            `;
        }
    }

    modalContent.innerHTML = `
        <p><strong>ID позиции:</strong> ${id}</p>
        <p><strong>Цена входа:</strong> ${price}</p>
        <p><strong>Количество:</strong> ${qty}</p>
        <p><strong>Сторона:</strong> ${side}</p>
        <p><strong>Статус:</strong> ${status}</p>
        <p><strong>${rateLabel}:</strong> 
            <span style="color:${rateColor}">
                ${(rateToShow && rateToShow !== 'None') ? rateToShow : '<span style="color:var(--body-fg)">НЕ ЗАДАН</span>'}
            </span>
        </p>
        ${pnlHTML}
        <hr>
        <p class="modal-footer-note">P&amp;L отображен с вычетом комиссии</p>
    `;
}

const socket = new WebSocket('wss://panel.24trade.space/ws/redis/');

socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.type === "kline" && data.message) {
        try {
            const msg = JSON.parse(data.message);
            if (msg.data?.data?.length > 0) {
                latestClosePrice = msg.data.data[0].close;
                updateTablePrices(latestClosePrice);
                updateModalContent();
            }
        } catch (e) {
            console.error("Ошибка при парсинге сообщения сокета:", e);
        }
    }
};

socket.onopen = () => console.log('WS connected');
socket.onclose = () => console.log('WS disconnected');

document.body.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn-action')) {
        e.preventDefault();

        const btn = e.target;
        const row = btn.closest('tr');
        if (!row) return;

        const status = row.querySelector('[data-status]')?.getAttribute('data-status');
        const price = row.querySelector('[data-price]')?.getAttribute('data-price');
        const qty = row.querySelector('[data-qty]')?.getAttribute('data-qty');
        const side = row.querySelector('[data-side]')?.getAttribute('data-side');
        const close = row.querySelector('[data-close]')?.getAttribute('data-close');
        const id = btn.getAttribute('data-id');

        currentModalData = { id, price, qty, status, side, close };
        modalOpen = true;
        updateModalContent();

        modal.style.display = 'block';
        overlay.style.display = 'block';
    }
});

const closeModal = () => {
    modalOpen = false;
    modal.style.display = 'none';
    overlay.style.display = 'none';
};

closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);
