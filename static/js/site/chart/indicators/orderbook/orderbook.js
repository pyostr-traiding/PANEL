(() => {
  function handleOrderbookMessage(msg) {
    if (!msg?.data) return;
    const { b: bids, a: asks } = msg.data;
    const bidsBody = document.querySelector("#orderbook-bids tbody");
    const asksBody = document.querySelector("#orderbook-asks tbody");
    if (!bidsBody || !asksBody) return;

    bidsBody.innerHTML = "";
    asksBody.innerHTML = "";

    bids.slice(0, 15).forEach(([p, q]) => {
      bidsBody.innerHTML += `<tr><td class="bid">${Number(p).toFixed(2)}</td><td>${q}</td></tr>`;
    });
    asks.slice(0, 15).forEach(([p, q]) => {
      asksBody.innerHTML += `<tr><td class="ask">${Number(p).toFixed(2)}</td><td>${q}</td></tr>`;
    });
  }

  window.addEventListener("load", () => {
    // Регистрируем обработчик для вкладки
    WSManager.registerHandler("orderbook", handleOrderbookMessage);

    // Активируем вкладку по умолчанию после загрузки
    WSManager.activateTab("orderbook");

    // Обновляем при клике
    document
      .querySelector('.tab-btn[data-tab="orderbook"]')
      .addEventListener("click", () => {
        WSManager.activateTab("orderbook");
      });
  });
})();
