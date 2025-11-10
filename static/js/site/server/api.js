/* =============================================================================
   API: WebSocket, события, команды к серверу
   ========================================================================== */
(function (w) {
  const { $, toast } = w.DockerUI.utils;
  const { els, setWs, setModalVisible, setLoading, setModalLoading } = w.DockerUI.ui;
  const { state, WS_URL } = w.DockerUI.state;
  const { renderSystem, renderContainers, fillContainerModal, renderLogsTail } = w.DockerUI.render;

  function wsSend(obj) {
    try { state.ws?.send(JSON.stringify(obj)); } catch (e) { console.error('WS send error', e); }
  }

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

  function connect() {
    clearTimeout(state.reconnectTimer);
    setWs('yellow','Подключение…');
    try { state.ws?.close(); } catch {}
    state.ws = new WebSocket(WS_URL);

    state.ws.onopen = () => {
      setWs('green','Подключено');
      api.list();
      api.system();
    };

    state.ws.onmessage = (ev) => {
      let pkt; try { pkt = JSON.parse(ev.data); } catch { return; }

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

      if (pkt.type === 'containers') { renderContainers(pkt.data || []); return; }
      if (pkt.type === 'container_info') { fillContainerModal(pkt.data); return; }
      if (pkt.type === 'system') { renderSystem(pkt.data); return; }
      if (pkt.type === 'logs') { renderLogsTail(pkt); return; }

      if (pkt.type === 'log_line') {
        if (pkt.container && pkt.data && state.streamingForId) {
          els.ms.pre.textContent += (els.ms.pre.textContent ? '\n' : '') + String(pkt.data);
          els.ms.pre.scrollTop = els.ms.pre.scrollHeight;
        }
        return;
      }

      if (pkt.message) {
        toast(pkt.message);
        const doneId = pkt.data?.id ?? state.currentContainerId;
        if (doneId) setLoading(doneId, false);
        setModalLoading(false);
        api.list();
      }

      if (pkt.error) {
        toast(pkt.error, true);
        const errId = pkt.data?.id ?? state.currentContainerId;
        if (errId) setLoading(errId, false);
        setModalLoading(false);
      }
    };

    state.ws.onclose = () => {
      setWs('red','Нет соединения');
      state.reconnectTimer = setTimeout(connect, state.RECONNECT_MS);
    };

    state.ws.onerror = () => {
      setWs('red','Ошибка');
      try { state.ws.close(); } catch {}
    };
  }

  w.DockerUI = w.DockerUI || {};
  w.DockerUI.api = { connect, wsSend, ...api };
})(window);
