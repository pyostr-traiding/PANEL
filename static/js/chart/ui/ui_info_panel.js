import { initBaseChart } from './core/chart_base.js';
import { initSocket } from './core/chart_ws.js';
import { initPositionsModule } from './indicators/indicator_positions.js';
import { initUIControls } from './ui/ui_controls.js';

(async () => {
  const ctx = await initBaseChart();
  initSocket(ctx);
  initUIControls(ctx);
  initPositionsModule(ctx);
})();
