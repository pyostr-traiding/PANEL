export function initUIControls(ctx) {
  const intervalSelect = document.getElementById('interval-select');
  const pairSelect = document.getElementById('pair-select');

  // === Смена интервала ===
  intervalSelect.addEventListener('change', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const newInterval = e.target.value;
    if (ctx.currentInterval === newInterval) return;

    ctx.currentInterval = newInterval;
    ctx.noMoreHistory = false;
    ctx.allCandles = [];
    ctx.earliestTime = null;
    ctx.candleSeries.setData([]);

    if (ctx.ws) ctx.ws.close();
    await ctx.loadHistory(ctx.currentSymbol, ctx.currentInterval);
    ctx.connectSocket();

    const positionsCheckbox = document.getElementById('show-positions');
    if (positionsCheckbox?.checked && ctx.loadPositions) {
      const range = ctx.chart.timeScale().getVisibleLogicalRange();
      const vis = range ? ctx.candleSeries.barsInLogicalRange(range) : null;
      if (vis && vis.from && vis.to) {
        ctx.loadPositions(Number(vis.from.time) * 1000, Number(vis.to.time) * 1000);
      }
    }

    saveUserSettings();
  });

  // === Смена пары ===
  pairSelect.addEventListener('change', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const newSymbol = e.target.value;
    if (ctx.currentSymbol === newSymbol) return;

    ctx.currentSymbol = newSymbol;
    ctx.noMoreHistory = false;
    ctx.allCandles = [];
    ctx.earliestTime = null;
    ctx.candleSeries.setData([]);

    if (ctx.ws) ctx.ws.close();
    await ctx.loadHistory(ctx.currentSymbol, ctx.currentInterval);
    ctx.connectSocket();

    const positionsCheckbox = document.getElementById('show-positions');
    if (positionsCheckbox?.checked && ctx.loadPositions) {
      const range = ctx.chart.timeScale().getVisibleLogicalRange();
      const vis = range ? ctx.candleSeries.barsInLogicalRange(range) : null;
      if (vis && vis.from && vis.to) {
        ctx.loadPositions(Number(vis.from.time) * 1000, Number(vis.to.time) * 1000);
      }
    }

    saveUserSettings();
  });

  // === Сохранение пользовательских настроек ===
  function saveUserSettings() {
    const settings = {
      symbol: ctx.currentSymbol,
      interval: ctx.currentInterval,
      showPositions: document.getElementById('show-positions')?.checked ?? false,
    };
    localStorage.setItem('chartSettings', JSON.stringify(settings));
  }

  // === Загрузка пользовательских настроек ===
  async function loadUserSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('chartSettings'));
      if (!saved) return;

      let needReload = false;

      if (saved.symbol) {
        const pairSelect = document.getElementById('pair-select');
        if (pairSelect) {
          pairSelect.value = saved.symbol;
          if (ctx.currentSymbol !== saved.symbol) {
            ctx.currentSymbol = saved.symbol;
            needReload = true;
          }
        }
      }

      if (saved.interval) {
        const intervalSelect = document.getElementById('interval-select');
        if (intervalSelect) {
          intervalSelect.value = saved.interval;
          if (ctx.currentInterval !== saved.interval) {
            ctx.currentInterval = saved.interval;
            needReload = true;
          }
        }
      }

      const showPositionsCheckbox = document.getElementById('show-positions');
      if (showPositionsCheckbox) {
        showPositionsCheckbox.checked = !!saved.showPositions;
      }

      // если нужно — перезагрузим график
      if (needReload) {
        if (ctx.ws) ctx.ws.close();
        await ctx.loadHistory(ctx.currentSymbol, ctx.currentInterval);
        ctx.connectSocket();

        const showPositions = document.getElementById('show-positions');
        if (showPositions?.checked && ctx.loadPositions) {
          const vis = ctx.chart.timeScale().getVisibleLogicalRange();
          const range = ctx.candleSeries.barsInLogicalRange(vis);
          if (range && range.from && range.to) {
            ctx.loadPositions(Number(range.from.time) * 1000, Number(range.to.time) * 1000);
          }
        }
      }
    } catch (err) {
      console.warn('Ошибка загрузки настроек:', err);
    }
  }

  // === Полный сброс всех настроек ===
 function setupResetButton() {
  const resetBtn = document.getElementById('reset-settings');
  if (!resetBtn) return;

  resetBtn.addEventListener('click', async () => {
    // 1️⃣ Очистка localStorage
    localStorage.clear();

    // 2️⃣ Сбрасываем все чекбоксы (в модалке и на панели)
    document.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.checked = false;
    });

    // 3️⃣ Устанавливаем дефолты
    const defaultSymbol = 'BTCUSDT';
    const defaultInterval = '1';

    ctx.currentSymbol = defaultSymbol;
    ctx.currentInterval = defaultInterval;
    ctx.noMoreHistory = false;
    ctx.allCandles = [];
    ctx.earliestTime = null;
    ctx.candleSeries.setData([]);

    // 4️⃣ Очищаем индикаторы и сигналы (если есть методы)
    if (ctx.removeAllIndicators) {
      ctx.removeAllIndicators(); // твой метод удаления индикаторов
    }
    if (ctx.removeAllSignals) {
      ctx.removeAllSignals(); // твой метод удаления сигналов
    }

    // 5️⃣ Обновляем выпадающие селекты
    const pairSelect = document.getElementById('pair-select');
    const intervalSelect = document.getElementById('interval-select');
    if (pairSelect) pairSelect.value = defaultSymbol;
    if (intervalSelect) intervalSelect.value = defaultInterval;

    // 6️⃣ Перезапускаем график
    if (ctx.ws) ctx.ws.close();
    await ctx.loadHistory(ctx.currentSymbol, ctx.currentInterval);
    ctx.connectSocket();

    // 7️⃣ Закрываем модальное окно (если открыто)
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
  });
}


  // === Инициализация ===
  loadUserSettings();
  setupResetButton();

  // Подписки
  document.getElementById('show-positions')?.addEventListener('change', saveUserSettings);
}
