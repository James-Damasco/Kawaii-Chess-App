/**
 * 🎛️ game-controls.js
 * Back button, Pause/Resume, Undo, Restart, Flip, Resign, Draw controls.
 */

import { state } from './game-state.js';
import { renderBoard, clearHighlights, clearCheck, flipBoard, isFlipped } from './board.js';
import {
    showToast, updateStatus, setActiveTurn,
    clearMoveHistory, addMoveToHistory, updateCapturedPieces,
    showGameOverModal, hideGameOverModal,
    showSetupView, toggleChatPanel
} from './ui.js';
import { sounds } from './sounds.js';
import { requestRestart, notifyGameOver, offerDraw } from './socket-client.js';
import { leaveOnlineSession } from './online.js';
import { triggerAIMove } from './move-handler.js';

// ─── Back Button ──────────────────────────────────────────────────────────────

/**
 * Show the "leave game?" confirmation overlay and wire its buttons.
 * Called when user taps ← Back.
 */
export function handleBack() {
    sounds.click();

    // If no active game, just go straight to menu
    if (!state.isGameActive) {
        goToMainMenu();
        return;
    }

    showBackConfirm();
}

function showBackConfirm() {
    const overlay = document.getElementById('back-confirm-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');

    // Pause game while dialog is open (silently, no overlay)
    const wasActive = state.isGameActive;

    document.getElementById('back-confirm-yes')?.addEventListener('click', () => {
        overlay.classList.add('hidden');
        goToMainMenu();
    }, { once: true });

    document.getElementById('back-confirm-no')?.addEventListener('click', () => {
        overlay.classList.add('hidden');
        sounds.click();
    }, { once: true });
}

function goToMainMenu() {
    state.isGameActive = false;
    state.isAIThinking = false;
    state.isPaused = false;
    state.selectedSquare = null;
    state.chess = null;

    hideGameOverModal();
    hidePauseOverlay();
    showSetupView();
    clearHighlights();

    if (state.gameMode === 'online') leaveOnlineSession();

    // Reset mode buttons to show correct panel
    const modeBtn = document.querySelector(`.mode-btn[data-mode="${state.gameMode}"]`);
    if (modeBtn) modeBtn.click();

    sounds.click();
    showToast('Back to main menu 🏠', 'info', 2000);
}

// ─── Pause / Resume ───────────────────────────────────────────────────────────

export function togglePause() {
    if (!state.isGameActive) return;

    // Can't meaningfully pause an online game
    if (state.gameMode === 'online') {
        showToast("Can't pause an online game! ⚡", 'warning', 2000);
        return;
    }

    state.isPaused = !state.isPaused;

    if (state.isPaused) {
        showPauseOverlay();
        updatePauseBtn(true);
        updateStatus('⏸️', 'Game paused');
        sounds.click();
    } else {
        hidePauseOverlay();
        updatePauseBtn(false);
        updateStatus('♟️',
            `${state.chess.turn() === 'w' ? state.playerNames.white : state.playerNames.black}'s turn`
        );
        sounds.click();

        // If it's the AI's turn and it was paused mid-think, re-trigger
        if (state.gameMode === 'computer' && !state.isAIThinking) {
            const myColor = state.playerColor === 'white' ? 'w' : 'b';
            if (state.chess.turn() !== myColor) triggerAIMove();
        }
    }
}

function showPauseOverlay() {
    const overlay = document.getElementById('pause-overlay');
    overlay?.classList.remove('hidden');
}

function hidePauseOverlay() {
    const overlay = document.getElementById('pause-overlay');
    overlay?.classList.add('hidden');
}

function updatePauseBtn(isPaused) {
    const btn = document.getElementById('pause-btn');
    const icon = document.getElementById('pause-icon');
    if (!btn || !icon) return;
    icon.textContent = isPaused ? '▶️' : '⏸️';
    btn.title = isPaused ? 'Resume game' : 'Pause game';
    btn.classList.toggle('active', isPaused);
}

// ─── Undo ─────────────────────────────────────────────────────────────────────

export function undoMove() {
    if (!state.chess || !state.isGameActive || state.isPaused) return;

    if (state.gameMode === 'online') {
        showToast("Can't undo in online mode 🌐", 'warning');
        return;
    }

    if (state.gameMode === 'computer') {
        // Undo both AI + human move
        if (state.chess.history().length >= 2) {
            state.chess.undo();
            state.chess.undo();
        } else if (state.chess.history().length === 1) {
            state.chess.undo();
        } else {
            showToast('Nothing to undo!', 'warning', 1500);
            return;
        }
    } else {
        if (!state.chess.undo()) {
            showToast('Nothing to undo!', 'warning', 1500);
            return;
        }
    }

    rebuildMoveHistory();
    clearHighlights();
    clearCheck();
    renderBoard(state.chess);
    setActiveTurn(state.chess.turn());
    updateCapturedPieces(state.chess);
    updateStatus('↩️', 'Move undone');
    sounds.click();
    showToast('Move undone ↩️', 'info', 1500);
}

// ─── Restart ──────────────────────────────────────────────────────────────────

export function restartGame() {
    if (!state.chess) return;

    state.chess.reset();
    state.isGameActive = true;
    state.isAIThinking = false;
    state.isPaused = false;
    state.selectedSquare = null;

    clearMoveHistory();
    clearHighlights();
    clearCheck();
    renderBoard(state.chess);
    setActiveTurn('w');
    updateCapturedPieces(state.chess);
    updateStatus('♟️', 'Game restarted!');
    hideGameOverModal();
    hidePauseOverlay();
    updatePauseBtn(false);

    if (state.gameMode === 'online') requestRestart();

    if (state.gameMode === 'computer') {
        flipBoard(state.playerColor === 'black');
        if (state.playerColor === 'black') setTimeout(() => triggerAIMove(), 600);
    }

    sounds.click();
    showToast('Game restarted! ♟️', 'info');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rebuildMoveHistory() {
    clearMoveHistory();
    state.chess.history({ verbose: true }).forEach((move, i) => {
        const moveNum = Math.floor(i / 2) + 1;
        addMoveToHistory(move, moveNum, move.color);
    });
}