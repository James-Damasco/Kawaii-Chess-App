/**
 * 🎨 UI Module
 * Handles all UI updates, toasts, modals, move history, confetti
 */

// ─── Toast Notifications ──────────────────────────────────────────────────────

const toastContainer = document.getElementById('toast-container');

export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;

  toastContainer.appendChild(toast);
  toast.addEventListener('click', () => removeToast(toast));

  setTimeout(() => removeToast(toast), duration);
  return toast;
}

function removeToast(toast) {
  toast.style.animation = 'toastOut 0.3s ease forwards';
  setTimeout(() => toast.remove(), 300);
}

// ─── Status Updates ───────────────────────────────────────────────────────────

export function updateStatus(icon, message) {
  const iconEl = document.getElementById('status-icon');
  const msgEl = document.getElementById('status-message');
  if (iconEl) iconEl.textContent = icon;
  if (msgEl) msgEl.textContent = message;
}

export function setActiveTurn(color) {
  const topIndicator = document.getElementById('top-turn-indicator');
  const bottomIndicator = document.getElementById('bottom-turn-indicator');
  const topInfo = document.getElementById('player-top');
  const bottomInfo = document.getElementById('player-bottom');

  // Assume bottom = white, top = black (default orientation)
  topInfo?.classList.toggle('active-player', color === 'b');
  bottomInfo?.classList.toggle('active-player', color === 'w');

  if (topIndicator) {
    topIndicator.innerHTML = color === 'b'
      ? '<span class="active-indicator">● Your turn</span>'
      : '';
  }
  if (bottomIndicator) {
    bottomIndicator.innerHTML = color === 'w'
      ? '<span class="active-indicator">● Your turn</span>'
      : '';
  }
}

export function setPlayerNames(white, black, flipped = false) {
  const topName = document.getElementById('top-player-name');
  const bottomName = document.getElementById('bottom-player-name');
  const topAvatar = document.getElementById('top-avatar');
  const bottomAvatar = document.getElementById('bottom-avatar');

  if (!flipped) {
    // Default: white on bottom, black on top
    if (topName) topName.textContent = black;
    if (bottomName) bottomName.textContent = white;
    if (topAvatar) topAvatar.textContent = '♚';
    if (bottomAvatar) bottomAvatar.textContent = '♔';
  } else {
    // Flipped: black on bottom, white on top
    if (topName) topName.textContent = white;
    if (bottomName) bottomName.textContent = black;
    if (topAvatar) topAvatar.textContent = '♔';
    if (bottomAvatar) bottomAvatar.textContent = '♚';
  }
}

// ─── Move History ─────────────────────────────────────────────────────────────

let moveHistory = [];

export function addMoveToHistory(moveObj, moveNumber, color) {
  const historyContainer = document.getElementById('move-history');
  if (!historyContainer) return;

  // Remove empty state
  const emptyState = historyContainer.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const san = moveObj.san || moveObj;

  if (color === 'w') {
    // Start new row
    const row = document.createElement('div');
    row.className = 'move-row';
    row.dataset.moveIndex = moveHistory.length;

    const numEl = document.createElement('span');
    numEl.className = 'move-num';
    numEl.textContent = `${moveNumber}.`;

    const moveEl = document.createElement('span');
    moveEl.className = 'move-white';
    moveEl.textContent = san;

    row.appendChild(numEl);
    row.appendChild(moveEl);
    historyContainer.appendChild(row);
  } else {
    // Add to last row (black's move)
    const rows = historyContainer.querySelectorAll('.move-row');
    const lastRow = rows[rows.length - 1];
    if (lastRow) {
      const moveEl = document.createElement('span');
      moveEl.className = 'move-black';
      moveEl.textContent = san;
      lastRow.appendChild(moveEl);
    }
  }

  moveHistory.push({ san, color });

  // Scroll to bottom
  historyContainer.scrollTop = historyContainer.scrollHeight;

  // Highlight current move
  updateCurrentMoveHighlight();
}

export function clearMoveHistory() {
  moveHistory = [];
  const historyContainer = document.getElementById('move-history');
  if (historyContainer) {
    historyContainer.innerHTML = '<p class="empty-state">No moves yet</p>';
  }
}

function updateCurrentMoveHighlight() {
  const historyContainer = document.getElementById('move-history');
  if (!historyContainer) return;

  // Remove all current highlights
  historyContainer.querySelectorAll('.current').forEach(el => el.classList.remove('current'));

  // Highlight last move
  const allMoves = historyContainer.querySelectorAll('.move-white, .move-black');
  const last = allMoves[allMoves.length - 1];
  if (last) last.classList.add('current');
}

// ─── Captured Pieces ──────────────────────────────────────────────────────────

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_SYMBOLS_WHITE = { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' };
const PIECE_SYMBOLS_BLACK = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };

export function updateCapturedPieces(chess) {
  // Calculate material from history
  const whiteCaptured = [];
  const blackCaptured = [];

  chess.history({ verbose: true }).forEach(move => {
    if (move.captured) {
      if (move.color === 'w') {
        whiteCaptured.push(move.captured);
      } else {
        blackCaptured.push(move.captured);
      }
    }
  });

  // Sort by value
  const sortByValue = arr => arr.sort((a, b) => (PIECE_VALUES[b] || 0) - (PIECE_VALUES[a] || 0));
  sortByValue(whiteCaptured);
  sortByValue(blackCaptured);

  // Update top (black player, shows white's captures)
  const topCaptured = document.getElementById('top-captured');
  if (topCaptured) {
    topCaptured.innerHTML = blackCaptured
      .map(p => `<span>${PIECE_SYMBOLS_WHITE[p] || ''}</span>`)
      .join('');
  }

  // Update bottom (white player, shows black's captures)
  const bottomCaptured = document.getElementById('bottom-captured');
  if (bottomCaptured) {
    bottomCaptured.innerHTML = whiteCaptured
      .map(p => `<span>${PIECE_SYMBOLS_BLACK[p] || ''}</span>`)
      .join('');
  }
}

// ─── Game Over Modal ──────────────────────────────────────────────────────────

export function showGameOverModal(title, subtitle, emoji = '🏆') {
  const modal = document.getElementById('gameover-modal');
  const emojiEl = document.getElementById('gameover-emoji');
  const titleEl = document.getElementById('gameover-title');
  const subtitleEl = document.getElementById('gameover-subtitle');

  if (!modal) return;

  if (emojiEl) emojiEl.textContent = emoji;
  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;

  modal.classList.remove('hidden');

  // Animate in
  if (typeof anime !== 'undefined') {
    anime({
      targets: modal.querySelector('.modal-card'),
      scale: [0.5, 1],
      opacity: [0, 1],
      duration: 500,
      easing: 'spring(1, 80, 10, 0)'
    });
  }
}

export function hideGameOverModal() {
  document.getElementById('gameover-modal')?.classList.add('hidden');
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

export function launchConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;

  container.innerHTML = '';

  const colors = ['#ec4899', '#a855f7', '#38bdf8', '#34d399', '#fb923c', '#facc15'];
  const count = 60;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-delay: ${Math.random() * 0.5}s;
      animation-duration: ${2 + Math.random() * 1.5}s;
    `;
    container.appendChild(piece);
  }

  // Clear after animation
  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export function addChatMessage(username, message, isOwn = false, isSystem = false) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const msgEl = document.createElement('div');

  if (isSystem) {
    msgEl.className = 'chat-msg system';
    msgEl.textContent = message;
  } else {
    msgEl.className = `chat-msg ${isOwn ? 'own' : 'other'}`;
    msgEl.innerHTML = `
      <div class="chat-msg-user">${escapeHtml(username)}</div>
      <div class="chat-msg-text">${escapeHtml(message)}</div>
    `;
  }

  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── AI Thinking Indicator ────────────────────────────────────────────────────

let thinkingEl = null;

export function showAIThinking() {
  if (thinkingEl) return;

  const statusSection = document.getElementById('status-section');
  if (!statusSection) return;

  thinkingEl = document.createElement('div');
  thinkingEl.className = 'ai-thinking';
  thinkingEl.innerHTML = `
    🤖 AI is thinking
    <div class="thinking-dots">
      <span></span><span></span><span></span>
    </div>
  `;
  statusSection.appendChild(thinkingEl);
}

export function hideAIThinking() {
  thinkingEl?.remove();
  thinkingEl = null;
}

// ─── Promotion UI ─────────────────────────────────────────────────────────────

const PROMO_SYMBOLS = {
  w: { q: '♕', r: '♖', b: '♗', n: '♘' },
  b: { q: '♛', r: '♜', b: '♝', n: '♞' }
};

export function showPromotionModal(color) {
  return new Promise((resolve) => {
    const modal = document.getElementById('promotion-modal');
    const choices = document.getElementById('promotion-choices');
    if (!modal || !choices) { resolve('q'); return; }

    choices.innerHTML = '';
    const pieces = ['q', 'r', 'b', 'n'];

    pieces.forEach(piece => {
      const btn = document.createElement('button');
      btn.className = 'promo-btn';
      btn.textContent = PROMO_SYMBOLS[color][piece];
      btn.title = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[piece];
      btn.addEventListener('click', () => {
        modal.classList.add('hidden');
        resolve(piece);
      });
      choices.appendChild(btn);
    });

    modal.classList.remove('hidden');

    // Animate in
    if (typeof anime !== 'undefined') {
      anime({
        targets: modal.querySelector('.promotion-content'),
        scale: [0.5, 1],
        opacity: [0, 1],
        duration: 300,
        easing: 'spring(1, 80, 10, 0)'
      });
    }
  });
}

export function hidePromotionModal() {
  document.getElementById('promotion-modal')?.classList.add('hidden');
}

// ─── Online Status ────────────────────────────────────────────────────────────

export function showConnectionStatus(message, connected = true) {
  const statusEl = document.getElementById('connection-status');
  const textEl = document.getElementById('status-text');
  const dot = statusEl?.querySelector('.status-dot');

  if (!statusEl) return;

  statusEl.classList.remove('hidden');
  if (textEl) textEl.textContent = message;
  if (dot) {
    dot.style.background = connected ? 'var(--accent-success)' : 'var(--accent-danger)';
  }
}

export function hideConnectionStatus() {
  document.getElementById('connection-status')?.classList.add('hidden');
}

export function showRoomInfo(roomId) {
  const panel = document.getElementById('room-info-panel');
  const codeEl = document.getElementById('room-code-value');

  if (panel) panel.classList.remove('hidden');
  if (codeEl) codeEl.textContent = roomId;
}

// ─── Board Transition ─────────────────────────────────────────────────────────

export function showGameView() {
  document.getElementById('setup-panels')?.classList.add('hidden');
  document.getElementById('game-area')?.classList.remove('hidden');
  document.getElementById('side-panel')?.classList.remove('hidden');
}

export function showSetupView() {
  document.getElementById('setup-panels')?.classList.remove('hidden');
  document.getElementById('game-area')?.classList.add('hidden');
  document.getElementById('side-panel')?.classList.add('hidden');
}

export function toggleChatPanel(visible) {
  const chatSection = document.getElementById('chat-section');
  if (chatSection) {
    if (visible) chatSection.classList.remove('hidden');
    else chatSection.classList.add('hidden');
  }
}

export function toggleOnlineButtons(visible) {
  ['resign-btn', 'draw-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      if (visible) btn.classList.remove('hidden');
      else btn.classList.add('hidden');
    }
  });
}
