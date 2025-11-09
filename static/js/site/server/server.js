// ===============================
// Docker Services Dashboard (WS)
// ===============================
(() => {
  // ---- WS URL ----
  const WS_URL = (location.protocol === 'https:' ? 'wss' : 'ws') + '://localhost:8014/ws';

  // ---- DOM ----
  const wsDot = document.getElementById('ws-dot');
  const wsStatus = document.getElementById('ws-status');

  const systemCardsEl = document.getElementById('system-cards');
  const gridEl = document.getElementById('containers-grid');
  const btnRefresh = document.getElementById('btn-refresh');
  const cntLabel = document.getElementById('containers-count');

  // Modals
  const modalContainer = document.getElementById('modal-container');
  const modalLogs = document.getElementById('modal-logs');
  const modalStream = document.getElementById('modal-stream');

  // Container modal elements
  const mc = {
    name: document.getElementById('mc-name'),
    id: document.getElementById('mc-id'),
    image: document.getElementById('mc-image'),
    created: document.getElementById('mc-created'),
    ports: document.getElementById('mc-ports'),
    mounts: document.getElementById('mc-mounts'),
    statusPill: document.getElementById('modal-container-status'),
    actions: {
      start: document.getElementById('act-start'),
      stop: document.getElementById('act-stop'),
      restart: document.getElementById('act-restart'),
      remove: document.getElementById('act-remove'),
      logs: document.getElementById('act-logs'),
      stream: document.getElementById('act-stream'),
    }
  };

  // Logs modal elements
  const ml = {
    title: document.getElementById('modal-logs-title'),
    containerPill: document.getElementById('ml-container'),
    tailInput: document.getElementById('ml-tail'),
    refresh: document.getElementById('ml-refresh'),
    status: document.getElementById('ml-status'),
    pre: document.getElementById('logs-pre'),
  };

  // Stream modal elements
  const ms = {
    title: document.getElementById('modal-stream-title'),
    containerPill: document.getElementById('ms-container'),
    status: document.getElementById('ms-status'),
    pre: document.getElementById('stream-pre'),
    stop: document.getElementById('ms-stop'),
    clear: document.getElementById('ms-clear'),
  };

  // ---- State ----
  let ws = null;
  let reconnectTimer = null;
  const RECONNECT_MS = 5000;

  let containers = new Map(); // id -> container brief
  let currentContainerId = null; // for modal actions
  let streamingForId = null;
  const pendingOps = new Set(); // контейнеры с активной операцией

  // ---- Utils ----
  const setWs = (color, text) => {
    wsDot.classList.remove('green','yellow','red');
    wsDot.classList.add(color);
    wsStatus.textContent = text;
  };
  const fmt = (n) => new Intl.NumberFormat().format(n);
  const safe = (s) => String(s ?? '');
  const dt = (s) => {
    try { return new Date(s).toLocaleString(); } catch { return s; }
  };
  const percent = (v, digits=1) => `${(Number.isFinite(v) ? v : 0).toFixed(digits)}%`;

  function portsToStr(ports) {
    if (!ports || typeof ports !== 'object') return '—';
    const list = [];
    Object.entries(ports).forEach(([p, arr]) => {
      if (Array.isArray(arr)) {
        arr.forEach(m => list.push(`${m.HostIp}:${m.HostPort}→${p}`));
      }
    });
    return list.length ? list.join(', ') : '—';
  }
  const mountsToStr = (mounts) => Array.isArray(mounts) && mounts.length
    ? mounts.map(m => `${m.Source||''}:${m.Destination||''}`).join(', ')
    : '—';

  function statusPill(status){
    const st = (status||'').toLowerCase();
    if (st.startsWith('run') || st === 'running') return `<span class="pill pill-dot green">running</span>`;
    if (st.startsWith('exited') || st === 'exited') return `<span class="pill pill-dot red">exited</span>`;
    return `<span class="pill pill-dot yellow">${safe(status)}</span>`;
  }

  function setModalVisible(modal, visible){
    modal.classList.toggle('hidden', !visible);
    modal.setAttribute('aria-hidden', String(!visible));
  }

  function clearNode(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  function scrollToBottom(preEl){ preEl.scrollTop = preEl.scrollHeight; }

  // ---- Loading indicators ----
  function setLoading(id, isLoading) {
    if (!id) return;
    const cardBtn = gridEl.querySelector(`.card button[data-id="${id}"]`);
    const card = cardBtn ? cardBtn.closest('.card') : null;
    if (card) card.classList.toggle('loading', isLoading);
    if (isLoading) pendingOps.add(id); else pendingOps.delete(id);
  }
  function setModalLoading(isLoading) {
    modalContainer && modalContainer.classList.toggle('loading', isLoading);
  }

  // ---- Rendering ----
  // Нормализация структуры system: поддерживаем оба формата (update и system_resources)
  function normalizeSystem(sys) {
    const out = {
      cpu_percent: sys.cpu_percent ?? 0,
      memory: {
        total_mb: sys.memory?.total_mb ?? null,
        used_mb: sys.memory?.used_mb ?? sys.used_mem_mb ?? null,
        available_mb: sys.memory?.available_mb ?? sys.available_mem_mb ?? null,
        percent_used: sys.memory?.percent_used ?? sys.memory_percent ?? null
      },
      disk: sys.disk ?? null
    };
    return out;
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

    systemCardsEl.innerHTML = `
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
    // running вверх
    list.sort((a,b) => {
      const ar = (a.status||'').toLowerCase().startsWith('run') ? 0 : 1;
      const br = (b.status||'').toLowerCase().startsWith('run') ? 0 : 1;
      return ar - br || safe(a.name).localeCompare(safe(b.name));
    });

    cntLabel.textContent = `${list.length} шт.`;
    clearNode(gridEl);

    if (!list.length) {
      gridEl.innerHTML = `<div class="empty">Контейнеров нет</div>`;
      return;
    }

    list.forEach(c => {
      containers.set(c.id, c);
      const card = document.createElement('div');
      card.className = 'card' + (pendingOps.has(c.id) ? ' loading' : '');
      card.innerHTML = `
        <div class="card-top">
          <span class="ct-name">${safe(c.name)}</span>
          <span class="ct-status">${statusPill(c.status)}</span>
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
      gridEl.appendChild(card);
    });
  }

  // ---- WS talk ----
  function wsSend(obj){
    try {
      ws?.send(JSON.stringify(obj));
    } catch (e) {
      console.error('WS send error', e);
    }
  }

  // actions
  const api = {
    list: () => wsSend({ action: 'list_containers' }),
    get: (id) => wsSend({ action: 'get_container', data: { id } }),
    start: (id) => { setLoading(id, true); setModalLoading(true); wsSend({ action: 'start', data: { id } }); },
    stop: (id) => { setLoading(id, true); setModalLoading(true); wsSend({ action: 'stop', data: { id } }); },
    restart: (id) => { setLoading(id, true); setModalLoading(true); wsSend({ action: 'restart', data: { id } }); },
    remove: (id) => { setLoading(id, true); setModalLoading(true); wsSend({ action: 'remove', data: { id } }); },
    system: () => wsSend({ action: 'system_resources' }),
    logs: (id, tail=200) => wsSend({ action: 'logs', data: { id, tail:Number(tail)||200 } }),
    streamLogs: (id) => wsSend({ action: 'stream_logs', data: { id } }),
    stopStream: () => wsSend({ action: 'stop_stream' }),
    subscribe: (interval=1) => wsSend({ action: 'subscribe', data: { interval } }),
  };

  // ---- WS lifecycle ----
  function connect() {
    clearTimeout(reconnectTimer);
    setWs('yellow','Подключение…');
    try { ws?.close(); } catch {}
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setWs('green','Подключено');
      api.list();
      api.system();
    };

    ws.onmessage = (ev) => {
      let pkt;
      try { pkt = JSON.parse(ev.data); } catch { return; }

      // автоматические апдейты
      if (pkt.type === 'update') {
        if (pkt.system) renderSystem(pkt.system);
        if (Array.isArray(pkt.containers)) renderContainers(pkt.containers);
        return;
      }

      if (pkt.type === 'status') {
        const id = pkt.data?.id;
        const action = pkt.data?.status || pkt.data?.action;
        if (id) setLoading(id, true);
        if (action) toast(`Операция: ${action}…`);
        return;
      }

      if (pkt.type === 'containers') {
        renderContainers(pkt.data || []);
        return;
      }

      if (pkt.type === 'container_info') {
        fillContainerModal(pkt.data);
        return;
      }

      if (pkt.type === 'system') {
        renderSystem(pkt.data);
        return;
      }

      if (pkt.type === 'logs') {
        renderLogsTail(pkt);
        return;
      }

      if (pkt.type === 'log_line') {
        if (pkt.container && pkt.data && streamingForId) {
          ms.pre.textContent += (ms.pre.textContent ? '\n' : '') + String(pkt.data);
          scrollToBottom(ms.pre);
        }
        return;
      }

      if (pkt.message) {
        toast(pkt.message);
        // сброс индикаторов
        const doneId = pkt.data?.id ?? currentContainerId;
        if (doneId) setLoading(doneId, false);
        setModalLoading(false);
        // обновим список
        api.list();
      }

      if (pkt.error) {
        toast(pkt.error, true);
        // сброс индикаторов
        const errId = pkt.data?.id ?? currentContainerId;
        if (errId) setLoading(errId, false);
        setModalLoading(false);
      }
    };

    ws.onclose = () => {
      setWs('red','Нет соединения');
      reconnectTimer = setTimeout(connect, RECONNECT_MS);
    };

    ws.onerror = () => {
      setWs('red','Ошибка');
      try { ws.close(); } catch {}
    };
  }

  // ---- UI helpers ----
  function toast(text, isErr=false){
    console[isErr ? 'error' : 'log'](text);
    wsStatus.textContent = text;
    setTimeout(() => {
      wsStatus.textContent = wsDot.classList.contains('green') ? 'Подключено' : 'Нет соединения';
    }, 2000);
  }

  function openContainerModal(id){
    currentContainerId = id;
    // очистим
    mc.name.textContent = mc.id.textContent = mc.image.textContent = mc.created.textContent = mc.ports.textContent = mc.mounts.textContent = '—';
    mc.statusPill.innerHTML = '—';
    setModalVisible(modalContainer, true);
    api.get(id);
  }

  function fillContainerModal(data){
    if (!data) return;
    mc.name.textContent = safe(data.name);
    mc.id.textContent = safe(data.id);
    mc.image.textContent = (data.image||[]).join(', ');
    mc.created.textContent = dt(data.created);
    mc.ports.textContent = portsToStr(data.ports);
    mc.mounts.textContent = mountsToStr(data.mounts);
    mc.statusPill.innerHTML = statusPill(data.status);

    // доступность кнопок
    const running = String(data.status||'').toLowerCase().startsWith('run');
    mc.actions.start.disabled = running;
    mc.actions.stop.disabled = !running;
  }

  function openLogsModalTail(id){
    ml.pre.textContent = '';
    ml.containerPill.textContent = id;
    ml.status.textContent = 'загрузка…';
    setModalVisible(modalLogs, true);
    api.logs(id, ml.tailInput.value);
  }

  function renderLogsTail(pkt){
    ml.status.textContent = '';
    if (pkt.container) ml.containerPill.textContent = pkt.container;
    const lines = Array.isArray(pkt.data) ? pkt.data : [];
    ml.pre.textContent = lines.join('\n');
  }

  function openStreamModal(id){
    ms.pre.textContent = '';
    ms.containerPill.textContent = id;
    ms.status.classList.remove('green','yellow','red');
    ms.status.classList.add('yellow');
    ms.status.textContent = 'запуск…';
    setModalVisible(modalStream, true);
    streamingForId = id;
    api.streamLogs(id);
    ms.status.classList.remove('yellow'); ms.status.classList.add('green');
    ms.status.textContent = 'идёт';
  }

  function stopStream(){
    api.stopStream();
    streamingForId = null;
    ms.status.classList.remove('green'); ms.status.classList.add('red');
    ms.status.textContent = 'остановлено';
  }

  // ---- Events ----
  btnRefresh?.addEventListener('click', () => {
    api.list();
    api.system();
  });

  gridEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const act = btn.getAttribute('data-act');
    if (!id) return;

    if (act === 'open') return openContainerModal(id);
    if (act === 'restart') return api.restart(id);
    if (act === 'start') return api.start(id);
    if (act === 'stop') return api.stop(id);
    if (act === 'logs') return openLogsModalTail(id);
    if (act === 'stream') return openStreamModal(id);
  });

  // контейнерная модалка: действия
  mc.actions.start.addEventListener('click', () => currentContainerId && api.start(currentContainerId));
  mc.actions.stop.addEventListener('click', () => currentContainerId && api.stop(currentContainerId));
  mc.actions.restart.addEventListener('click', () => currentContainerId && api.restart(currentContainerId));
  mc.actions.remove.addEventListener('click', () => {
    if (!currentContainerId) return;
    if (confirm('Удалить контейнер?')) api.remove(currentContainerId);
  });
  mc.actions.logs.addEventListener('click', () => currentContainerId && openLogsModalTail(currentContainerId));
  mc.actions.stream.addEventListener('click', () => currentContainerId && openStreamModal(currentContainerId));

  // tail logs modal
  ml.refresh.addEventListener('click', () => currentContainerId && api.logs(currentContainerId, ml.tailInput.value));

  // stream modal
  ms.stop.addEventListener('click', stopStream);
  ms.clear.addEventListener('click', () => { ms.pre.textContent = ''; });

  // модальные закрытия
  document.body.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close]');
    if (!closeBtn) return;

    if (modalStream && !modalStream.classList.contains('hidden')) stopStream();
    setModalVisible(modalContainer, false);
    setModalVisible(modalLogs, false);
    setModalVisible(modalStream, false);
    setModalLoading(false);
  });

  // Esc для модалок
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!modalStream.classList.contains('hidden')) stopStream();
      setModalVisible(modalContainer, false);
      setModalVisible(modalLogs, false);
      setModalVisible(modalStream, false);
      setModalLoading(false);
    }
  });

  // ---- Init ----
  window.addEventListener('load', () => {
    connect();
  });
})();
