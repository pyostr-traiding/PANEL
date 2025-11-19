// ============================================================
// GPT — чаты: список, диалог, отправка, статусы, сокет с авто-реподключением
// ============================================================

(function () {
  // --- API ---
  const LIST_API = '/api/front/gpt/filter';
  const CHAT_API = '/api/front/gpt/?key=';
  const SEND_API = '/api/front/gpt/send';

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

  // --- State ---
  let page = 1;
  const perPage = 10;
  let isLoading = false;
  let noMore = false;

  const chatKeys = new Set();
  let chats = [];
  let activeKey = null;
  const messagesCache = new Map();

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
    const parts = key.split(':');
    return { uuid: parts[1], action: parts[2] || '' };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(dt) {
    try { return new Date(dt).toLocaleString(); }
    catch { return dt; }
  }

  // ============================================================
  // Список чатов
  // ============================================================
  // --- Кнопка создания нового чата ---
  const newChatBtn = document.getElementById('chat-new-btn');

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

  // открытие чата
  el.querySelector('.chat-item-left').addEventListener('click', () => {
    if (activeKey !== key) setActiveChat(key);
  });

  // обработка меню
  const menu = el.querySelector('.chat-menu');
  const menuBtn = menu.querySelector('.chat-menu-btn');
  const deleteBtn = menu.querySelector('.chat-delete-btn');

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



async function deleteChat(key, element) {
  if (!confirm('Удалить этот чат?')) return;
  try {
    const res = await fetch('/api/front/gpt/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: key })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    element.remove();
    chatKeys.delete(key);
    chats = chats.filter(c => c.key !== key);
    if (activeKey === key) {
      activeKey = null;
      chatWindowEl.innerHTML = `<div class="empty-state">Чат удалён.</div>`;
    }
  } catch (err) {
    console.error('Delete chat error:', err);
    alert('Не удалось удалить чат');
  }
}
function closeAllMenus() {
  document.querySelectorAll('.chat-menu.open').forEach(m => m.classList.remove('open'));
}

document.addEventListener('click', (e) => {
  // если клик вне меню
  if (!e.target.closest('.chat-menu')) {
    closeAllMenus();
  }
});

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

    const url = `${LIST_API}?page=${page}&per_page=${perPage}`;
    try {
      const res = await fetch(url);
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
  // Диалог
  // ============================================================

  async function setActiveChat(key) {
    activeKey = key;
    highlightActive();
    if (emptyStateEl) emptyStateEl.remove();
    chatWindowEl.innerHTML = '';
    if (messagesCache.has(key)) {
      renderMessages(messagesCache.get(key));
    } else {
      await loadChat(key);
    }
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
    } catch (e) {
      console.error('loadChat error:', e);
      chatWindowEl.innerHTML = `<div class="empty-state">Не удалось загрузить чат</div>`;
    }
  }

  function renderMessages(msgs) {
    if (!Array.isArray(msgs)) return;
    chatWindowEl.innerHTML = '';
    msgs.forEach(appendMessage);
    scrollChatToBottom();
  }

  function appendMessage(m) {
    const isAssistant = m.role === 'assistant';
    const bubble = document.createElement('div');
    bubble.className = `msg ${isAssistant ? 'assistant' : 'user'}`;

    const content = m.message_type === 'img_url'
      ? `<img src="${m.message}" alt="image">`
      : escapeHtml(m.message).replace(/\n/g, '<br>');

    let statusIcon = '';
    if (m.role === 'user') {
      if (m.status === 'pending') {
        statusIcon = `<span class="msg-status pending">⏳</span>`;
      } else if (m.status === 'error') {
        statusIcon = `<span class="msg-status error">❌</span>`;
      } else {
        statusIcon = `<span class="msg-status delivered">✅</span>`;
      }
    }

    bubble.dataset.msgText = m.message;
    bubble.innerHTML = `
      <div class="msg-content">${content}</div>
      <small>${formatDate(m.dt)} • ${isAssistant ? 'Ассистент' : 'Вы'} ${statusIcon}</small>
    `;

    chatWindowEl.appendChild(bubble);
    scrollChatToBottom();
  }

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      chatWindowEl.scrollTop = chatWindowEl.scrollHeight;
    });
  }

  // ============================================================
  // Отправка сообщений
  // ============================================================

  inputForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeKey) return;

    const text = inputField.value.trim();
    if (!text) return;

    const body = JSON.stringify({ uuid: activeKey, text });

    // добавляем локально как "ожидающее"
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
        body
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('Send error:', err);
      // если ошибка — помечаем последнее как ❌
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
        const data = JSON.parse(ev.data);
        handleIncoming(data);
      } catch (e) {
        console.error('WS parse error', e);
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
    const { uuid, action, role, message } = pkt;
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

  window.addEventListener('load', () => {
    loadPage();
    connectWS();
  });

  window.addEventListener('beforeunload', cleanupWS);
})();
