import { initBaseChart } from './core/chart_base.js';
import { initSocket } from './core/chart_ws.js';
import { initPositionsModule } from './indicators/indicator_positions.js';
import { initUIControls } from './ui/ui_controls.js';
import { initInfoPanel } from './ui/ui_info_panel.js';
import { initPredictIndicators } from "./indicators/indicator_predict.js";

(async () => {
  const ctx = await initBaseChart();
  window.chartCtx = ctx;                      // 💾 делаем глобально доступным
  window.dispatchEvent(new CustomEvent('chartReady', { detail: ctx })); // 📢 сигнал

  ctx.connectSocket = () => initSocket(ctx);
  ctx.ws = null;

  initUIControls(ctx);
  initPositionsModule(ctx);
  await initSocket(ctx);
  initInfoPanel(ctx);
  await initPredictIndicators(ctx);
})();
