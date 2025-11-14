/* =============================================================================
   Main: привязка событий и инициализация
   ========================================================================== */
(function (w) {
  const { els, setModalVisible } = w.DockerUI.ui;
  const { connect, list, system, logs, streamLogs, stopStream, start, stop, restart, remove, get } = w.DockerUI.api;
  const { state } = w.DockerUI.state;

  function bindEvents() {
    // Обновить список
    els.btnRefresh?.addEventListener('click', () => { list(); system(); });

    // Карточки контейнеров
    els.grid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]'); if (!btn) return;
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act'); if (!id) return;

      if (act === 'open') { state.currentContainerId = id; setModalVisible(els.modalContainer, true); get(id); return; }
      if (act === 'restart') return restart(id);
      if (act === 'start')   return start(id);
      if (act === 'stop')    return stop(id);
      if (act === 'logs')    { state.currentContainerId = id; setModalVisible(els.modalLogs, true); logs(id, els.ml.tailInput.value); return; }
      if (act === 'stream')  {
        state.currentContainerId = id;
        setModalVisible(els.modalStream, true);
        state.streamingForId = id;
        streamLogs(id);
        els.ms.status.classList.remove('red','yellow');
        els.ms.status.classList.add('green');
        els.ms.status.textContent = 'идёт';
        return;
      }
    });

    // Контейнерная модалка: действия
    els.mc.actions.start.addEventListener('click', () => state.currentContainerId && start(state.currentContainerId));
    els.mc.actions.stop.addEventListener('click', () => state.currentContainerId && stop(state.currentContainerId));
    els.mc.actions.restart.addEventListener('click', () => state.currentContainerId && restart(state.currentContainerId));
    els.mc.actions.remove.addEventListener('click', () => {
      if (!state.currentContainerId) return;
      if (confirm('Удалить контейнер?')) remove(state.currentContainerId);
    });
    els.mc.actions.logs.addEventListener('click', () => state.currentContainerId && (setModalVisible(els.modalLogs, true), logs(state.currentContainerId, els.ml.tailInput.value)));
    els.mc.actions.stream.addEventListener('click', () => state.currentContainerId && (
      setModalVisible(els.modalStream, true),
      state.streamingForId = state.currentContainerId,
      streamLogs(state.currentContainerId),
      els.ms.status.classList.remove('red','yellow'),
      els.ms.status.classList.add('green'),
      els.ms.status.textContent = 'идёт'
    ));

    // Tail logs
    els.ml.refresh.addEventListener('click', () => state.currentContainerId && logs(state.currentContainerId, els.ml.tailInput.value));

    // Stream logs
    els.ms.stop.addEventListener('click', () => {
      stopStream();
      state.streamingForId = null;
      els.ms.status.classList.remove('green');
      els.ms.status.classList.add('red');
      els.ms.status.textContent = 'остановлено';
    });
    els.ms.clear.addEventListener('click', () => { els.ms.pre.textContent = ''; });

    // Перезагрузка всех — открытие модалки
    els.btnRestartAll?.addEventListener('click', () => {
      setModalVisible(els.modalSeq, true);
      els.seqPre.textContent = '';
    });

    // Кнопка "Запустить" внутри модалки
    els.seqRun?.addEventListener('click', () => {
      els.seqPre.textContent = '⏳ Запуск последовательной перезагрузки...\n';
      els.seqRun.disabled = true;
      w.DockerUI.api.restartAll();
    });

    // Закрытие модалок
    document.body.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close]'); if (!closeBtn) return;
      if (els.modalStream && !els.modalStream.classList.contains('hidden')) { stopStream(); state.streamingForId = null; }
      setModalVisible(els.modalContainer, false);
      setModalVisible(els.modalLogs, false);
      setModalVisible(els.modalStream, false);
      setModalVisible(els.modalSeq, false);
      els.seqRun.disabled = false;
    });

    // Esc закрытие
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!els.modalContainer.classList.contains('hidden')) setModalVisible(els.modalContainer, false);
      if (!els.modalLogs.classList.contains('hidden')) setModalVisible(els.modalLogs, false);
      if (!els.modalStream.classList.contains('hidden')) { stopStream(); state.streamingForId = null; setModalVisible(els.modalStream, false); }
      if (!els.modalSeq.classList.contains('hidden')) { setModalVisible(els.modalSeq, false); els.seqRun.disabled = false; }
    });
  }

  window.addEventListener('load', () => { bindEvents(); connect(); });
})(window);
