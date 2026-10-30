const messagesEl = document.getElementById('chat-messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

const history = [];
let busy = false;

const suggestions = [
  'Jelaskan apa itu API dengan contoh singkat',
  'Buat daftar 5 ide proyek web',
  'Tulis fungsi JavaScript untuk membalik string',
];

marked.setOptions({
  gfm: true,
  breaks: true,
});

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function resizeInput() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text));
}

function createRow(role) {
  const row = document.createElement('article');
  row.className = `message message-${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? 'You' : '✦';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  row.append(avatar, bubble);
  messagesEl.appendChild(row);
  return { row, bubble };
}

function addUserMessage(text) {
  const { bubble } = createRow('user');
  bubble.textContent = text;
  scrollToBottom();
}

function showLoading() {
  const { row, bubble } = createRow('bot');
  row.classList.add('is-loading');

  bubble.innerHTML = `
    <div class="loading-indicator">
      <div class="bouncing-dots" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span class="loading-text">Thinking</span>
    </div>
  `;

  scrollToBottom();
  return { row, bubble };
}

function revealAnswer(row, bubble, markdown) {
  row.classList.remove('is-loading');
  bubble.innerHTML = renderMarkdown(markdown);
  scrollToBottom();
}

function revealError(row, bubble, message) {
  row.classList.remove('is-loading');
  bubble.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'error-text';
  p.textContent = message;
  bubble.appendChild(p);
  scrollToBottom();
}

function setBusy(next) {
  busy = next;
  sendBtn.disabled = next;
  input.disabled = next;
}

async function sendMessage(text) {
  const prompt = text.trim();
  if (!prompt || busy) return;

  addUserMessage(prompt);
  history.push({ role: 'user', text: prompt });
  input.value = '';
  resizeInput();
  setBusy(true);

  const { row, bubble } = showLoading();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Gagal menghubungi server.');
    }

    history.push({ role: 'model', text: data.result });
    revealAnswer(row, bubble, data.result);
  } catch (err) {
    history.pop();
    revealError(row, bubble, err.message || 'Terjadi kesalahan.');
  } finally {
    setBusy(false);
    input.focus();
  }
}

function renderWelcome() {
  const { bubble } = createRow('bot');
  bubble.innerHTML = `
    <p>Halo. Saya YP-AI-Assistant. Tulis pesan, atau pilih salah satu ide di bawah.</p>
    <div class="suggestions"></div>
  `;

  const wrap = bubble.querySelector('.suggestions');
  suggestions.forEach((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion';
    button.textContent = label;
    button.addEventListener('click', () => sendMessage(label));
    wrap.appendChild(button);
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener('input', resizeInput);

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

renderWelcome();
input.focus();
