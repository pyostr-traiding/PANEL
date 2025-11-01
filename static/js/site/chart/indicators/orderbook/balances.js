(() => {
  function renderBalances(msg) {
    const el = document.getElementById("balances-list");
    if (!el || !msg?.balances) return;

    el.innerHTML = msg.balances
      .map(
        (b) => `<div class="balance-item">
          <b style="color:${b.side === "buy" ? "var(--bid-color)" : "var(--ask-color)"}">${b.user}</b>
          — ${b.amount} ${b.symbol}
          <span style="opacity:0.7">(${b.side.toUpperCase()})</span>
        </div>`
      )
      .join("");
  }

  window.addEventListener("load", () => {
    WSManager.registerHandler("balances", renderBalances);
    document
      .querySelector('.tab-btn[data-tab="balances"]')
      .addEventListener("click", () => {
        WSManager.activateTab("balances");
      });
  });
})();
