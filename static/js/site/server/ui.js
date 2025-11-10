/* =============================================================================
   UI: индикаторы, модалки, лоадеры
   ========================================================================== */
(function (w) {
  const { $, toast } = w.DockerUI.utils;
  const { state } = w.DockerUI.state;

  const els = {
    wsDot: $('#ws-dot'),
    wsStatus: $('#ws-status'),
    systemCards: $('#system-cards'),
    grid: $('#containers-grid'),
    btnRefresh: $('#btn-refresh'),
    cntLabel: $('#containers-count'),

    modalContainer: $('#modal-container'),
    modalLogs: $('#modal-logs'),
    modalStream: $('#modal-stream'),

    mc: {
      name: $('#mc-name'),
      id: $('#mc-id'),
      image: $('#mc-image'),
      created: $('#mc-created'),
      ports: $('#mc-ports'),
      mounts: $('#mc-mounts'),
      statusPill: $('#modal-container-status'),
      actions: {
        start: $('#act-start'),
        stop: $('#act-stop'),
        restart: $('#act-restart'),
        remove: $('#act-remove'),
        logs: $('#act-logs'),
        stream: $('#act-stream'),
      }
    },
    ml: {
      title: $('#modal-logs-title'),
      containerPill: $('#ml-container'),
      tailInput: $('#ml-tail'),
      refresh: $('#ml-refresh'),
      status: $('#ml-status'),
      pre: $('#logs-pre'),
    },
    ms: {
      title: $('#modal-stream-title'),
      containerPill: $('#ms-container'),
      status: $('#ms-status'),
      pre: $('#stream-pre'),
      stop: $('#ms-stop'),
      clear: $('#ms-clear'),
    },
  };

  function setWs(color, text) {
    els.wsDot.classList.remove('green', 'yellow', 'red');
    els.wsDot.classList.add(color);
    els.wsStatus.textContent = text;
  }

  function setModalVisible(modal, visible) {
    modal.classList.toggle('hidden', !visible);
    modal.setAttribute('aria-hidden', String(!visible));
  }

  function setLoading(id, isLoading) {
    if (!id) return;
    const cardBtn = els.grid.querySelector(`.card button[data-id="${id}"]`);
    const card = cardBtn ? cardBtn.closest('.card') : null;
    if (card) card.classList.toggle('loading', isLoading);
    if (isLoading) state.pendingOps.add(id); else state.pendingOps.delete(id);
  }

  function setModalLoading(isLoading) {
    els.modalContainer && els.modalContainer.classList.toggle('loading', isLoading);
  }

  w.DockerUI = w.DockerUI || {};
  w.DockerUI.ui = { els, setWs, setModalVisible, setLoading, setModalLoading, toast };
})(window);
