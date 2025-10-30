import { initBaseChart } from './core/chart_base.js';
import { initSocket } from './core/chart_ws.js';
import { initPositionsModule } from './indicators/indicator_positions.js';
import { initUIControls } from './ui/ui_controls.js';
import { initInfoPanel } from './ui/ui_info_panel.js';
import { initPredictIndicators } from "./indicators/indicator_predict.js";

(async () => {
  const ctx = await initBaseChart();

  ctx.connectSocket = () => initSocket(ctx);
  ctx.ws = null;

  // UI можно инициализировать до сокета
  initUIControls(ctx);
  initPositionsModule(ctx);

  // 💡 подключаем сокет ДО info panel
  await initSocket(ctx);

  // теперь можно безопасно обращаться к subscribeToCandle
  initInfoPanel(ctx);
  initPredictIndicators(ctx);
})();
