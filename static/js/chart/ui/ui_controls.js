export function initUIControls(ctx) {
  const intervalSelect = document.getElementById('interval-select');
  const pairSelect = document.getElementById('pair-select');

  intervalSelect.addEventListener('change', async (e) => {
    ctx.currentInterval = e.target.value;
    location.reload(); // пока просто перезагрузка страницы, потом можно будет оптимизировать
  });

  pairSelect.addEventListener('change', async (e) => {
    ctx.currentSymbol = e.target.value;
    location.reload();
  });
}
