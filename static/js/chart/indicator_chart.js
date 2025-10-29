import { initBaseChart } from './core/chart_base.js';
import { initSocket } from './core/chart_ws.js';
import { initPositionsModule } from './indicators/indicator_positions.js';
import { initUIControls } from './ui/ui_controls.js';
import { initInfoPanel } from './ui/ui_info_panel.js';

(async () => {
  // Инициализируем базу
  const ctx = await initBaseChart();

  // Привязываем WebSocket и функции управления
  ctx.connectSocket = () => initSocket(ctx); // ✅ теперь доступно из ui_controls
  ctx.ws = null; // просто для хранения ссылки, если нужно закрывать

  // Модули
  initSocket(ctx);
  initUIControls(ctx);
  initPositionsModule(ctx);
  initInfoPanel(ctx);
})();
