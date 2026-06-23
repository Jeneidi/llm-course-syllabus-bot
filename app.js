import { SYSTEM_INSTRUCTIONS } from './prompts.js';

const API_BASE = '/api/openai';
const CHAT_MODEL = 'gpt-4o-mini';
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 60;

const state = {
  apiKey: '',
  vectorStoreId: null,
  lastResponseId: null,
  readyFileCount: 0,
};

const el = {
  apiKey: document.getElementById('api-key'),
  toggleKey: document.getElementById('toggle-key'),
  rememberKey: document.getElementById('remember-key'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  fileList: document.getElementById('file-list'),
  statusPill: document.getElementById('status-pill'),
  chatLog: document.getElementById('chat-log'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  sendBtn: document.getElementById('send-btn'),
};

init();

function init() {
  const savedKey = sessionStorage.getItem('syllabusbot_key');
  if (savedKey) {
    el.apiKey.value = savedKey;
    state.apiKey = savedKey;
    el.rememberKey.checked = true;
  }

  el.apiKey.addEventListener('input', () => {
    state.apiKey = el.apiKey.value.trim();
    if (el.rememberKey.checked) persistKey();
  });

  el.rememberKey.addEventListener('change', () => {
    if (el.rememberKey.checked) persistKey();
    else sessionStorage.removeItem('syllabusbot_key');
  });

  el.toggleKey.addEventListener('click', () => {
    const isHidden = el.apiKey.type === 'password';
    el.apiKey.type = isHidden ? 'text' : 'password';
    el.toggleKey.setAttribute('aria-label', isHidden ? 'Hide key' : 'Show key');
  });

  el.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.fileInput.click();
    }
  });
  el.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dropzone.classList.add('is-dragover');
  });
  el.dropzone.addEventListener('dragleave', () => el.dropzone.classList.remove('is-dragover'));
  el.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropzone.classList.remove('is-dragover');
    handleFiles(e.dataTransfer.files);
  });
  el.fileInput.addEventListener('change', () => {
    handleFiles(el.fileInput.files);
    el.fileInput.value = '';
  });

  el.chatForm.addEventListener('submit', onSubmitMessage);
}

function persistKey() {
  sessionStorage.setItem('syllabusbot_key', state.apiKey);
}

function setStatusPill(text, mode) {
  el.statusPill.innerHTML = mode === 'busy' ? `<span class="shimmer">${escapeHtml(text)}</span>` : escapeHtml(text);
  el.statusPill.className = 'status-pill ' + (mode ? `is-${mode}` : '');
}

function setChatEnabled(enabled) {
  el.chatInput.disabled = !enabled;
  el.sendBtn.disabled = !enabled;
}

async function apiFetch(path, options = {}) {
  if (!state.apiKey) throw new Error('Add your OpenAI API key first.');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.apiKey}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await describeError(res));
  return res.json();
}

async function describeError(res) {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw);
    return `${res.status}: ${parsed.error?.message || raw}`;
  } catch (_) {
    return `${res.status}: ${raw || res.statusText || 'request failed'}`;
  }
}

async function ensureVectorStore() {
  if (state.vectorStoreId) return state.vectorStoreId;
  const store = await apiFetch('/vector_stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `syllabus-bot-${Date.now()}` }),
  });
  state.vectorStoreId = store.id;
  return store.id;
}

function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  for (const file of files) {
    if (file.type !== 'application/pdf') {
      addFileRow(file.name, 'error', 'Not a PDF');
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      addFileRow(file.name, 'error', 'Too large');
      continue;
    }
    ingestFile(file);
  }
}

function addFileRow(name, status, label) {
  const li = document.createElement('li');
  li.className = 'file-item';
  li.dataset.name = name;
  li.innerHTML = `<span class="file-name">${escapeHtml(name)}</span><span class="file-status is-${status}">${renderStatusLabel(status, label)}</span>`;
  el.fileList.appendChild(li);
  return li;
}

function updateFileRow(row, status, label) {
  const badge = row.querySelector('.file-status');
  badge.className = `file-status is-${status}`;
  badge.innerHTML = renderStatusLabel(status, label);
}

function renderStatusLabel(status, label) {
  const isInProgress = status === 'uploading' || status === 'indexing';
  return isInProgress ? `<span class="shimmer">${escapeHtml(label)}</span>` : escapeHtml(label);
}

async function ingestFile(file) {
  const row = addFileRow(file.name, 'uploading', 'Uploading');
  try {
    if (!state.apiKey) throw new Error('Add your OpenAI API key first.');
    const vectorStoreId = await ensureVectorStore();

    const form = new FormData();
    form.append('file', file);
    form.append('purpose', 'assistants');
    const uploaded = await apiFetch('/files', { method: 'POST', body: form });

    updateFileRow(row, 'indexing', 'Indexing');
    await apiFetch(`/vector_stores/${vectorStoreId}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: uploaded.id }),
    });

    await pollFileReady(vectorStoreId, uploaded.id);
    updateFileRow(row, 'ready', 'Ready');
    state.readyFileCount += 1;
    setStatusPill('Ready', 'ready');
    setChatEnabled(true);
  } catch (err) {
    updateFileRow(row, 'error', 'Failed');
    setStatusPill('Error', 'error');
    appendChatMessage('error', `Couldn't index "${file.name}": ${err.message}`);
  }
}

async function pollFileReady(vectorStoreId, fileId) {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const info = await apiFetch(`/vector_stores/${vectorStoreId}/files/${fileId}`);
    if (info.status === 'completed') return;
    if (info.status === 'failed' || info.status === 'cancelled') {
      throw new Error(`indexing ${info.status}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('indexing timed out');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function onSubmitMessage(e) {
  e.preventDefault();
  const question = el.chatInput.value.trim();
  if (!question) return;
  if (!state.vectorStoreId || state.readyFileCount === 0) {
    appendChatMessage('error', 'Upload and index a syllabus before asking a question.');
    return;
  }

  el.chatInput.value = '';
  appendChatMessage('user', question);
  setChatEnabled(false);
  setStatusPill('Thinking…', 'busy');
  const bubble = appendChatMessage('pending', 'Thinking...');
  let started = false;

  try {
    const payload = {
      model: CHAT_MODEL,
      input: question,
      instructions: SYSTEM_INSTRUCTIONS,
      tools: [{ type: 'file_search', vector_store_ids: [state.vectorStoreId] }],
    };
    if (state.lastResponseId) payload.previous_response_id = state.lastResponseId;

    const finalResponse = await streamResponse(payload, (delta) => {
      if (!started) {
        started = true;
        bubble.className = 'msg bot';
        bubble.textContent = '';
      }
      bubble.textContent += delta;
      el.chatLog.scrollTop = el.chatLog.scrollHeight;
    });

    state.lastResponseId = finalResponse.id;
    const { text, sources } = extractAnswer(finalResponse);
    bubble.className = 'msg bot';
    bubble.textContent = text || '(no answer returned)';
    appendSources(bubble, sources);
  } catch (err) {
    bubble.remove();
    appendChatMessage('error', err.message);
  } finally {
    setChatEnabled(true);
    setStatusPill('Ready', 'ready');
    el.chatInput.focus();
  }
}

async function streamResponse(payload, onDelta) {
  if (!state.apiKey) throw new Error('Add your OpenAI API key first.');
  const res = await fetch(`${API_BASE}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${state.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...payload, stream: true }),
  });
  if (!res.ok) throw new Error(await describeError(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResponse = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const event = JSON.parse(line.slice(6));
      if (event.type === 'response.output_text.delta') onDelta(event.delta);
      else if (event.type === 'response.completed') finalResponse = event.response;
      else if (event.type === 'response.failed' || event.type === 'error') {
        throw new Error(event.response?.error?.message || event.message || 'stream error');
      }
    }
  }

  if (!finalResponse) throw new Error('stream ended without a completed response');
  return finalResponse;
}

function extractAnswer(response) {
  const message = (response.output || []).find((item) => item.type === 'message');
  if (!message) return { text: '', sources: [] };
  const part = (message.content || []).find((c) => c.type === 'output_text') || message.content?.[0];
  const text = part?.text || '';
  const seen = new Set();
  const sources = [];
  for (const ann of part?.annotations || []) {
    if (ann.type === 'file_citation' && ann.filename && !seen.has(ann.filename)) {
      seen.add(ann.filename);
      sources.push(ann.filename);
    }
  }
  return { text, sources };
}

function appendChatMessage(kind, text, sources) {
  const empty = el.chatLog.querySelector('.chat-empty');
  if (empty) empty.remove();

  const bubble = document.createElement('div');
  bubble.className = `msg ${kind}`;
  bubble.textContent = text;
  appendSources(bubble, sources);

  el.chatLog.appendChild(bubble);
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
  return bubble;
}

function appendSources(bubble, sources) {
  if (!sources || !sources.length) return;
  const sourcesEl = document.createElement('div');
  sourcesEl.className = 'sources';
  for (const name of sources) {
    const chip = document.createElement('span');
    chip.className = 'source-chip';
    chip.textContent = name;
    sourcesEl.appendChild(chip);
  }
  bubble.appendChild(sourcesEl);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
