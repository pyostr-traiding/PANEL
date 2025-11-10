/* =============================================================================
   Utils: форматирование, DOM-хелперы, уведомления
   ========================================================================== */
(function (w) {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmt = (n) => new Intl.NumberFormat().format(n);
  const safe = (s) => String(s ?? '');
  const dt = (s) => { try { return new Date(s).toLocaleString(); } catch { return s; } };
  const percent = (v, d = 1) => `${(Number.isFinite(v) ? v : 0).toFixed(d)}%`;
  const clearNode = (el) => { while (el && el.firstChild) el.removeChild(el.firstChild); };
  const scrollToBottom = (el) => { if (el) el.scrollTop = el.scrollHeight; };

  function portsToStr(ports) {
    if (!ports || typeof ports !== 'object') return '—';
    const list = [];
    Object.entries(ports).forEach(([p, arr]) => {
      if (Array.isArray(arr)) arr.forEach(m => list.push(`${m.HostIp}:${m.HostPort}→${p}`));
    });
    return list.length ? list.join(', ') : '—';
  }
  const mountsToStr = (mounts) => Array.isArray(mounts) && mounts.length
    ? mounts.map(m => `${m.Source||''}:${m.Destination||''}`).join(', ')
    : '—';

  function statusPillHTML(status) {
    const st = (status || '').toLowerCase();
    if (st.startsWith('run')) return `<span class="pill pill-dot green">running</span>`;
    if (st.startsWith('exited')) return `<span class="pill pill-dot red">exited</span>`;
    return `<span class="pill pill-dot yellow">${safe(status)}</span>`;
  }

  function toast(text, isErr = false) {
  console[isErr ? 'error' : 'log'](text);
  if (window.DockerUI.toast) {
    window.DockerUI.toast(text, isErr ? 'error' : 'info');
  }
}

  w.DockerUI = w.DockerUI || {};
  w.DockerUI.utils = { $, $$, fmt, safe, dt, percent, clearNode, scrollToBottom, portsToStr, mountsToStr, statusPillHTML, toast };
})(window);
