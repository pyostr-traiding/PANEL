/* =============================================================================
   Render: отрисовка карточек, системных метрик и содержимого модалок
   ========================================================================== */
(function (w) {
  const { fmt, safe, dt, percent, clearNode, portsToStr, mountsToStr, statusPillHTML } = w.DockerUI.utils;
  const { els } = w.DockerUI.ui;
  const { state } = w.DockerUI.state;

  // Нормализация структуры system (поддержка обоих форматов)
  function normalizeSystem(sys) {
    return {
      cpu_percent: sys.cpu_percent ?? 0,
      memory: {
        total_mb: sys.memory?.total_mb ?? null,
        used_mb: sys.memory?.used_mb ?? sys.used_mem_mb ?? null,
        available_mb: sys.memory?.available_mb ?? sys.available_mem_mb ?? null,
        percent_used: sys.memory?.percent_used ?? sys.memory_percent ?? null
      },
      disk: sys.disk ?? null
    };
  }

  function renderSystem(sysRaw) {
    if (!sysRaw) return;
    const sys = normalizeSystem(sysRaw);
    const { cpu_percent, memory, disk } = sys;

    const memPercent = Number.isFinite(memory?.percent_used)
      ? memory.percent_used
      : (memory && memory.total_mb ? (memory.used_mb / memory.total_mb * 100) : 0);

    const diskPercent = Number.isFinite(disk?.percent_used)
      ? disk.percent_used
      : (disk && disk.total_gb ? (disk.used_gb / disk.total_gb * 100) : 0);

    const safeFixed = (v, d = 2) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d) : '—';
    const haveDisk = !!disk;

    els.systemCards.innerHTML = `
      <div class="card">
        <div class="card-top"><span>CPU</span><span class="pill">${percent(cpu_percent || 0)}</span></div>
        <div class="card-val">${percent(cpu_percent || 0)}</div>
        <div class="card-bar"><span style="width:${Math.min(100, cpu_percent || 0)}%"></span></div>
        <div class="card-foot">Загрузка процессора</div>
      </div>

      <div class="card">
        <div class="card-top"><span>Память</span><span class="pill">${fmt(Math.round(memory?.available_mb || 0))} МБ свободно</span></div>
        <div class="card-val">${percent(memPercent)}</div>
        <div class="card-bar"><span style="width:${Math.min(100, memPercent)}%"></span></div>
        <div class="card-foot">Использовано: ${fmt(Math.round(memory?.used_mb || 0))} МБ из ${fmt(Math.round(memory?.total_mb || 0))} МБ</div>
      </div>

      <div class="card">
        <div class="card-top"><span>Диск</span><span class="pill">${haveDisk ? safeFixed(disk?.free_gb) + ' ГБ свободно' : '—'}</span></div>
        <div class="card-val">${haveDisk ? percent(diskPercent) : '—'}</div>
        <div class="card-bar"><span style="width:${haveDisk ? Math.min(100, diskPercent) : 0}%"></span></div>
        <div class="card-foot">${haveDisk ? `Использовано: ${safeFixed(disk?.used_gb)} ГБ из ${safeFixed(disk?.total_gb)} ГБ` : 'Данные диска недоступны'}</div>
      </div>
    `;
  }

  function renderContainers(list) {
    if (!Array.isArray(list)) return;
    list.sort((a,b) => {
      const ar = (a.status||'').toLowerCase().startsWith('run') ? 0 : 1;
      const br = (b.status||'').toLowerCase().startsWith('run') ? 0 : 1;
      return ar - br || String(a.name||'').localeCompare(String(b.name||''));
    });

    els.cntLabel.textContent = `${list.length} шт.`;
    clearNode(els.grid);

    if (!list.length) {
      els.grid.innerHTML = `<div class="empty">Контейнеров нет</div>`;
      return;
    }

    list.forEach(c => {
      state.containers.set(c.id, c);
      const card = document.createElement('div');
      card.className = 'card' + (state.pendingOps.has(c.id) ? ' loading' : '');
      card.innerHTML = `
        <div class="card-top">
          <span class="ct-name">${safe(c.name)}</span>
          <span class="ct-status">${statusPillHTML(c.status)}</span>
        </div>
        <div class="ct-image">${(c.image||[]).join(', ')}</div>
        <div class="ct-row"><div class="ct-id">${safe(c.id)}</div></div>
        <div class="ct-row"><div class="ct-ports">${portsToStr(c.ports)}</div></div>
        <div class="ct-actions">
          <button class="btn primary" data-act="open" data-id="${c.id}">Открыть</button>
          <button class="btn" data-act="restart" data-id="${c.id}">Перезапуск</button>
          ${
            (c.status||'').toLowerCase().startsWith('run')
              ? `<button class="btn warn" data-act="stop" data-id="${c.id}">Стоп</button>`
              : `<button class="btn" data-act="start" data-id="${c.id}">Старт</button>`
          }
          <button class="btn ghost" data-act="logs" data-id="${c.id}">Логи</button>
          <button class="btn ghost" data-act="stream" data-id="${c.id}">Стрим</button>
        </div>
      `;
      els.grid.appendChild(card);
    });
  }

  function fillContainerModal(data) {
    const { mc } = els;
    mc.name.textContent = safe(data.name);
    mc.id.textContent = safe(data.id);
    mc.image.textContent = (data.image||[]).join(', ');
    mc.created.textContent = dt(data.created);
    mc.ports.textContent = portsToStr(data.ports);
    mc.mounts.textContent = mountsToStr(data.mounts);
    mc.statusPill.innerHTML = statusPillHTML(data.status);

    const running = String(data.status||'').toLowerCase().startsWith('run');
    mc.actions.start.disabled = running;
    mc.actions.stop.disabled = !running;
  }

  function renderLogsTail(pkt) {
    const { ml } = els;
    ml.status.textContent = '';
    if (pkt.container) ml.containerPill.textContent = pkt.container;
    const lines = Array.isArray(pkt.data) ? pkt.data : [];
    ml.pre.textContent = lines.join('\n');
  }

  w.DockerUI = w.DockerUI || {};
  w.DockerUI.render = { renderSystem, renderContainers, fillContainerModal, renderLogsTail };
})(window);
