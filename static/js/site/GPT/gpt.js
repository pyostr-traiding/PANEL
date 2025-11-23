// ============================================================
// GPT — чаты: список, диалог, отправка, загрузка истории,
// автообновление, выбор модели, сокет с переподключением
// ============================================================

(function () {
  // --- API ---
  const LIST_API = '/api/front/gpt/filter';
  const CHAT_API = '/api/front/gpt/?key=';
  const SEND_API = '/api/front/gpt/send';
  const MODELS_API = '/api/settings/gpt/list';
  const DELETE_API = '/api/front/gpt/delete';

  // --- WS URL ---
  const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const WS_URL = `${wsScheme}://${window.location.host}/ws/gpt/`;

  // --- DOM ---
  const chatListEl = document.getElementById('chat-list');
  const chatWindowEl = document.getElementById('chat-window');
  const emptyStateEl = document.getElementById('empty-state');
  const wsDotEl = document.getElementById('ws-dot');
  const wsStatusTextEl = document.getElementById('ws-status-text');
  const listLoaderEl = document.getElementById('chat-list-loader');
  const listEndEl = document.getElementById('chat-list-end');
  const listErrorEl = document.getElementById('chat-list-error');
  const inputForm = document.getElementById('chat-input-form');
  const inputField = document.getElementById('chat-input');
  const modelSelect = document.getElementById('gpt-model-select');
  const newChatBtn = document.getElementById('chat-new-btn');

  // --- State ---
  let page = 1;
  const perPage = 10;
  let isLoading = false;
  let noMore = false;

  const chatKeys = new Set();
  let chats = [];
  let activeKey = null;

  let messagesCache = new Map();

  let models = [];
  let activeModel = null;

  // --- WS ---
  let ws = null;
  let reconnectTimer = null;
  const RECONNECT_INTERVAL = 5000;

  // ============================================================
  // Утилиты
  // ============================================================

  function setWsStatus(color, text) {
    wsDotEl.classList.remove('green', 'yellow', 'red');
    wsDotEl.classList.add(color);
    wsStatusTextEl.textContent = text;
  }

  function keyFrom(uuid, action) {
    return `chat:${uuid}:${action}`;
  }

  function parseKey(key) {
    const [_, uuid, action = ""] = key.split(':');
    return { uuid, action };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  // --- Markdown + highlight.js ---
hljs.configure({ ignoreUnescapedHTML: true });

function renderMarkdown(text) {
  return marked.parse(text, {
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    }
  });
}

  function formatDate(dt) {
    try { return new Date(dt).toLocaleString(); }
    catch { return dt; }
  }

  // ============================================================
  // Загрузка моделей
  // ============================================================

  async function loadModels() {
    try {
      const res = await fetch(MODELS_API);
      const data = await res.json();
      models = data;

      modelSelect.innerHTML = '';

      if (!data.length) {
        modelSelect.innerHTML = `<option value="">Модели не найдены</option>`;
        activeModel = null;
        return;
      }

      data.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.code;
        opt.textContent = m.name;
        modelSelect.appendChild(opt);
      });

      activeModel = data[0].code;
      modelSelect.value = activeModel;

    } catch (err) {
      console.error('Ошибка загрузки моделей:', err);
      modelSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
      activeModel = null;
    }
  }

  modelSelect?.addEventListener('change', () => {
    activeModel = modelSelect.value;
  });

  // ============================================================
  // Список чатов
  // ============================================================

  newChatBtn?.addEventListener('click', () => {
    const uuid = crypto.randomUUID();
    const key = `chat:${uuid}:user_chat`;

    if (!chatKeys.has(key)) {
      chatKeys.add(key);
      chats.unshift({ key });
      mountChatList([{ key }], { prepend: true });
      setActiveChat(key);
    }
  });

  function renderChatItem({ key }) {
    const { action } = parseKey(key);
    const el = document.createElement('div');
    el.className = 'chat-item';
    el.dataset.key = key;

    el.innerHTML = `
      <div class="chat-item-left">
        <div class="chat-title">${action || 'Диалог'}</div>
        <span class="chat-key">${key}</span>
      </div>
      <div class="chat-menu">
        <button type="button" class="chat-menu-btn">⋯</button>
        <div class="chat-menu-popup">
          <button class="chat-delete-btn">Удалить</button>
        </div>
      </div>
    `;

    el.querySelector('.chat-item-left').addEventListener('click', () => {
      if (activeKey !== key) setActiveChat(key);
    });

    const menu = el.querySelector('.chat-menu');
    const menuBtn = el.querySelector('.chat-menu-btn');
    const deleteBtn = el.querySelector('.chat-delete-btn');

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      closeAllMenus();
      if (!isOpen) menu.classList.add('open');
    });

    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      menu.classList.remove('open');
      await deleteChat(key, el);
    });

    return el;
  }

  function closeAllMenus() {
    document.querySelectorAll('.chat-menu.open').forEach(m => m.classList.remove('open'));
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.chat-menu')) closeAllMenus();
  });

  async function deleteChat(key, element) {
    if (!confirm('Удалить этот чат?')) return;

    try {
      const res = await fetch(DELETE_API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: key })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      element.remove();
      chatKeys.delete(key);
      chats = chats.filter(c => c.key !== key);
      messagesCache.delete(key);

      if (activeKey === key) {
        activeKey = null;
        chatWindowEl.innerHTML = `<div class="empty-state">Чат удалён.</div>`;
      }

    } catch (err) {
      console.error('Delete chat error:', err);
      alert('Не удалось удалить чат');
    }
  }

  function mountChatList(items, { prepend = false } = {}) {
    const fragment = document.createDocumentFragment();
    items.forEach(it => fragment.appendChild(renderChatItem(it)));
    prepend ? chatListEl.prepend(fragment) : chatListEl.appendChild(fragment);
    highlightActive();
  }

  function highlightActive() {
    Array.from(chatListEl.children).forEach(node => {
      node.classList.toggle('active', node.dataset.key === activeKey);
    });
  }

  async function loadPage() {
    if (isLoading || noMore) return;
    isLoading = true;

    listErrorEl.classList.add('hidden');
    listEndEl.classList.add('hidden');
    listLoaderEl.classList.remove('hidden');

    try {
      const res = await fetch(`${LIST_API}?page=${page}&per_page=${perPage}`);
      if (res.status === 404) {
        noMore = true;
        listEndEl.classList.remove('hidden');
        return;
      }

      const data = await res.json();
      const fresh = [];

      data.forEach(key => {
        if (!chatKeys.has(key)) {
          chatKeys.add(key);
          chats.push({ key });
          fresh.push({ key });
        }
      });

      if (fresh.length) mountChatList(fresh);
      if (!activeKey && chats.length) setActiveChat(chats[0].key);

      page++;

    } catch (e) {
      listErrorEl.classList.remove('hidden');
      console.error('loadPage error:', e);
    } finally {
      isLoading = false;
      listLoaderEl.classList.add('hidden');
    }
  }

  chatListEl.addEventListener('scroll', () => {
    const nearBottom = chatListEl.scrollTop + chatListEl.clientHeight >= chatListEl.scrollHeight - 40;
    if (nearBottom) loadPage();
  });

  // ============================================================
  // Модель для чата
  // ============================================================

  function applyModelFromChat(modelCode) {
    if (!modelSelect) return;

    let found = false;
    for (let i = 0; i < modelSelect.options.length; i++) {
      if (modelSelect.options[i].value === modelCode) {
        modelSelect.selectedIndex = i;
        activeModel = modelCode;
        found = true;
        break;
      }
    }

    if (!found) {
      console.warn("Модель из чата не найдена:", modelCode);
    }
  }

  // ============================================================
  // Диалог
  // ============================================================

  async function setActiveChat(key) {
    activeKey = key;
    highlightActive();

    if (emptyStateEl) emptyStateEl.remove();

    chatWindowEl.innerHTML = '';

    // 1. Моментально рендерим кэш если есть
    if (messagesCache.has(key)) {
      renderMessages(messagesCache.get(key));
    }

    // 2. ВСЕГДА грузим с сервера заново (и обновляем модель)
    await loadChat(key);
  }

  async function loadChat(key) {
    const encodedKey = encodeURIComponent(key);

    try {
      const res = await fetch(`${CHAT_API}${encodedKey}`);
      const data = await res.json();

      const msgs = Array.isArray(data)
        ? data
        : (Array.isArray(data.results) ? data.results : [data]);

      messagesCache.set(key, msgs);
      renderMessages(msgs);

      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        if (last.code) applyModelFromChat(last.code);
      }

    } catch (err) {
      console.error('loadChat error:', err);
      chatWindowEl.innerHTML = `<div class="empty-state">Не удалось загрузить чат</div>`;
    }
  }

  function renderMessages(msgs) {
    chatWindowEl.innerHTML = '';
    msgs.forEach(appendMessage);
    scrollChatToBottom();
  }

  function appendMessage(m) {
    const isAssistant = m.role === 'assistant';
    const bubble = document.createElement('div');
    bubble.className = `msg ${isAssistant ? 'assistant' : 'user'}`;

    let content;

    if (m.message_type === 'img_url') {
        content = `<img src="${m.message}" alt="">`;
    } else {
        // ВСЕ сообщения → через Markdown
        content = renderMarkdown(m.message || "");
    }

    bubble.innerHTML = `
        <div class="bubble">
            ${content}
        </div>
    `;

    chatWindowEl.appendChild(bubble);
    scrollChatToBottom();

    // подсветка
    bubble.querySelectorAll("pre code").forEach(block => {
        hljs.highlightElement(block);
    });
}

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      chatWindowEl.scrollTop = chatWindowEl.scrollHeight;
    });
  }

  // ============================================================
  // Отправка
  // ============================================================

  inputForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeKey) return;
    if (!activeModel) return;

    const text = inputField.value.trim();
    if (!text) return;

    appendMessage({
      message: text,
      message_type: 'text',
      role: 'user',
      dt: new Date().toISOString(),
      status: 'pending'
    });

    inputField.value = '';

    try {
      const res = await fetch(SEND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: activeKey,
          text,
          code: activeModel,
          context: (models.find(m => m.code === activeModel)?.context) || null
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

    } catch (err) {
      console.error('Send error:', err);

      const lastPending = chatWindowEl.querySelector('.msg.user .msg-status.pending');
      if (lastPending) {
        lastPending.textContent = '❌';
        lastPending.classList.remove('pending');
        lastPending.classList.add('error');
      }
    }
  });

  // ============================================================
  // WebSocket
  // ============================================================

  function connectWS() {
    cleanupWS();
    setWsStatus('yellow', 'Подключение...');

    ws = new WebSocket(WS_URL);

    ws.onopen = () => setWsStatus('green', 'Подключено');

    ws.onmessage = (ev) => {
      try {
        const pkt = JSON.parse(ev.data);
        handleIncoming(pkt);
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      setWsStatus('red', 'Нет соединения');
      scheduleReconnect();
    };

    ws.onerror = () => {
      setWsStatus('red', 'Ошибка');
      try { ws.close(); } catch {}
    };
  }

  function cleanupWS() {
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try { ws.close(); } catch {}
      ws = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    setWsStatus('yellow', 'Переподключение...');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWS();
    }, RECONNECT_INTERVAL);
  }

  function handleIncoming(pkt) {
    const { uuid, action, role, message, code } = pkt;
    if (!uuid || !action) return;

    const key = keyFrom(uuid, action);

    if (!chatKeys.has(key)) {
      chatKeys.add(key);
      chats.unshift({ key });
      mountChatList([{ key }], { prepend: true });
    }

    const arr = messagesCache.get(key) || [];
    arr.push(pkt);
    messagesCache.set(key, arr);

    if (role === "assistant" && code) applyModelFromChat(code);

    if (activeKey === key && role === 'user') {
      const pending = Array.from(chatWindowEl.querySelectorAll('.msg.user'))
        .reverse()
        .find(el => el.querySelector('.msg-status.pending')
          && el.dataset.msgText.trim() === message.trim());
      if (pending) {
        const icon = pending.querySelector('.msg-status');
        icon.textContent = '✅';
        icon.classList.remove('pending');
        icon.classList.add('delivered');
        return;
      }
    }

    if (activeKey === key) {
      appendMessage(pkt);
    }
  }

  // ============================================================
  // Инициализация
  // ============================================================

  window.addEventListener('load', async () => {
    await loadModels();
    await loadPage();
    connectWS();
  });

  window.addEventListener('beforeunload', cleanupWS);

})();
