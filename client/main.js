/**
 * ♟️ Kawaii Chess — Entry Point (main.js)
 *
 * Responsibility: boot the app, wire DOM events to module functions.
 * All logic lives in /modules/*.
 *
 * Module map
 * ─────────────────────────────────────────────────────────────
 *  game-state.js    shared mutable state
 *  game-init.js     startLocal / startComputer / startOnline
 *  move-handler.js  click / drop / tryMove / onMoveMade / AI
 *  game-controls.js back / pause / undo / restart / flip
 *  online.js        socket room create/join + in-game handlers
 *  settings.js      theme + settings load/save
 *  board.js         rendering + drag & drop + touch
 *  ui.js            toasts / modals / history / chat / confetti
 *  sounds.js        Web Audio synth effects
 *  socket-client.js Socket.io wrapper
 */

import { initBoard, flipBoard, isFlipped } from './modules/board.js';
import { handleSquareClick, handlePieceDrop } from './modules/move-handler.js';
import { startLocalGame, startComputerGame } from './modules/game-init.js';
import { handleBack, togglePause, undoMove, restartGame } from './modules/game-controls.js';
import { handleCreateRoom, handleJoinRoom, setupOnlineGameHandlers } from './modules/online.js';
import { loadSettings, setTheme, applySettings } from './modules/settings.js';
import { sounds, setSoundEnabled, isSoundEnabled, initSounds } from './modules/sounds.js';
import { sendChatMessage, offerDraw, notifyGameOver } from './modules/socket-client.js';
import {
  showToast, showGameOverModal,
  addChatMessage
} from './modules/ui.js';
import { state } from './modules/game-state.js';
import { getUsername } from './modules/socket-client.js';

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', boot);

function boot() {
  // ── Loading splash ──────────────────────────────────────────────────────
  setTimeout(() => {
    const splash = document.getElementById('loading-screen');
    if (!splash) return;
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.style.display = 'none';
      document.getElementById('app')?.classList.remove('hidden');
      animateEntry();
    }, 500);
  }, 1400);

  // ── Board ───────────────────────────────────────────────────────────────
  initBoard(document.getElementById('chess-board'), {
    onSquareClick: handleSquareClick,
    onPieceDrop: handlePieceDrop
  });

  // ── Wire all DOM events ─────────────────────────────────────────────────
  bindEvents();

  // ── Load persisted settings / theme ────────────────────────────────────
  loadSettings();

  // ── Online in-game handlers (always ready) ──────────────────────────────
  setupOnlineGameHandlers();

  // ── Listen for online restart event dispatched by online.js ─────────────
  document.addEventListener('online:restart', () => restartGame());

  // ── Init audio on first click ───────────────────────────────────────────
  document.addEventListener('click', () => initSounds(), { once: true });
}

function animateEntry() {
  if (typeof anime === 'undefined') return;
  anime({
    targets: '#top-bar, #setup-panels',
    opacity: [0, 1],
    translateY: [-20, 0],
    delay: anime.stagger(100),
    duration: 500,
    easing: 'easeOutCubic'
  });
}

// ─── Event Bindings ───────────────────────────────────────────────────────────

function bindEvents() {

  // ── Mode Tabs ────────────────────────────────────────────────────────────
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const mode = btn.dataset.mode;
      state.gameMode = mode;

      document.querySelectorAll('.setup-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`setup-${mode}`)?.classList.add('active');
      sounds.click();
    });
  });

  // ── Setup: Start buttons ─────────────────────────────────────────────────
  on('start-local-btn', 'click', startLocalGame);
  on('start-computer-btn', 'click', startComputerGame);

  // ── Setup: Color & difficulty selectors ──────────────────────────────────
  document.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sounds.click();
    });
  });
  document.querySelectorAll('.diff-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sounds.click();
    });
  });

  // ── Online: Create / Join ────────────────────────────────────────────────
  on('create-room-btn', 'click', handleCreateRoom);
  on('join-room-btn', 'click', handleJoinRoom);
  onKey('room-code-input', 'Enter', handleJoinRoom);

  // ── Copy room code ───────────────────────────────────────────────────────
  on('copy-room-btn', 'click', () => {
    const code = document.getElementById('room-code-value')?.textContent;
    if (code) {
      navigator.clipboard.writeText(code)
        .then(() => showToast('Room code copied! 📋', 'success', 2000))
        .catch(() => showToast(code, 'info', 4000));
    }
  });

  // ── ← Back Button ─────────────────────────────────────────────────────────
  on('back-btn', 'click', handleBack);

  // ── ⏸️ Pause Button ──────────────────────────────────────────────────────
  on('pause-btn', 'click', togglePause);
  on('pause-resume-btn', 'click', togglePause);   // Resume inside pause overlay

  // ── Game Controls ─────────────────────────────────────────────────────────
  on('undo-btn', 'click', undoMove);
  on('restart-btn', 'click', restartGame);
  on('flip-btn', 'click', () => { flipBoard(!isFlipped()); sounds.click(); });

  // ── Online-only Controls ──────────────────────────────────────────────────
  on('resign-btn', 'click', () => {
    if (!state.isGameActive) return;
    state.isGameActive = false;
    const myColor = state.onlinePlayerColor === 'white' ? 'White' : 'Black';
    showGameOverModal('Resigned 🏳️', `${myColor} resigned.`, '🏳️');
    notifyGameOver(state.onlinePlayerColor === 'white' ? 'black' : 'white', 'resignation');
    sounds.click();
  });

  on('draw-btn', 'click', () => {
    offerDraw();
    showToast('Draw offer sent 🤝', 'info');
    sounds.click();
  });

  // ── Game Over Modal ───────────────────────────────────────────────────────
  on('modal-restart-btn', 'click', restartGame);
  on('modal-menu-btn', 'click', handleBack);

  // ── Sound Toggle ──────────────────────────────────────────────────────────
  on('sound-toggle', 'click', () => {
    const enabled = !isSoundEnabled();
    setSoundEnabled(enabled);
    state.settings.sound = enabled;
    const icon = document.getElementById('sound-icon');
    if (icon) icon.textContent = enabled ? '🔊' : '🔇';
    showToast(enabled ? 'Sound on 🔊' : 'Sound off 🔇', 'info', 1500);
  });

  // ── Theme ─────────────────────────────────────────────────────────────────
  on('theme-btn', 'click', (e) => {
    const menu = document.getElementById('theme-menu');
    if (!menu) return;
    const rect = e.currentTarget.getBoundingClientRect();
    menu.style.top = (rect.bottom + 8) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.classList.toggle('hidden');
    e.stopPropagation();
  });
  document.querySelectorAll('#theme-menu .menu-item').forEach(item => {
    item.addEventListener('click', () => {
      setTheme(item.dataset.theme);
      document.getElementById('theme-menu')?.classList.add('hidden');
    });
  });

  // ── Settings Modal ────────────────────────────────────────────────────────
  on('settings-btn', 'click', () => {
    document.getElementById('settings-modal')?.classList.remove('hidden');
    sounds.click();
  });
  on('close-settings-btn', 'click', () => {
    document.getElementById('settings-modal')?.classList.add('hidden');
    applySettings();
    sounds.click();
  });

  // ── Chat ──────────────────────────────────────────────────────────────────
  on('chat-send-btn', 'click', sendChat);
  onKey('chat-input', 'Enter', sendChat);

  // ── Enter shortcuts for setup fields ─────────────────────────────────────
  onKey('local-p1-name', 'Enter', startLocalGame);
  onKey('local-p2-name', 'Enter', startLocalGame);
  onKey('computer-username', 'Enter', startComputerGame);
  onKey('online-username', 'Enter', handleCreateRoom);

  // ── Close dropdowns on outside click ─────────────────────────────────────
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#theme-btn') && !e.target.closest('#theme-menu')) {
      document.getElementById('theme-menu')?.classList.add('hidden');
    }
  });

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.key === 'Escape') {
      if (!document.getElementById('pause-overlay')?.classList.contains('hidden')) {
        togglePause(); return;
      }
      if (!document.getElementById('settings-modal')?.classList.contains('hidden')) {
        document.getElementById('settings-modal').classList.add('hidden'); return;
      }
      if (!document.getElementById('back-confirm-overlay')?.classList.contains('hidden')) {
        document.getElementById('back-confirm-overlay').classList.add('hidden'); return;
      }
    }
    // P = Pause
    if (e.key === 'p' || e.key === 'P') togglePause();
    // U = Undo
    if (e.key === 'u' || e.key === 'U') undoMove();
  });
}

// ─── Chat helper ─────────────────────────────────────────────────────────────

function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input?.value.trim();
  if (!message || state.gameMode !== 'online') return;
  sendChatMessage(message);
  addChatMessage(getUsername(), message, true);
  input.value = '';
  sounds.click();
}

// ─── Tiny DOM helpers ─────────────────────────────────────────────────────────

function on(id, event, handler) {
  document.getElementById(id)?.addEventListener(event, handler);
}

function onKey(id, key, handler) {
  document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === key) handler(e);
  });
}