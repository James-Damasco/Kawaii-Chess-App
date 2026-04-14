/**
 * 🎮 game-init.js
 * Functions to initialise / start each of the three game modes.
 */

import { state, resetGameState } from './game-state.js';
import { renderBoard, flipBoard } from './board.js';
import {
    showToast, updateStatus, setActiveTurn, setPlayerNames,
    clearMoveHistory, updateCapturedPieces,
    showGameView, toggleChatPanel, toggleOnlineButtons
} from './ui.js';
import { sounds } from './sounds.js';
import { getDifficultyConfig } from './ai.js';
import { triggerAIMove } from './move-handler.js';
import { getUsername } from './socket-client.js';

// ─── Local Game ───────────────────────────────────────────────────────────────

export function startLocalGame() {
    const p1 = document.getElementById('local-p1-name')?.value.trim() || 'White Player';
    const p2 = document.getElementById('local-p2-name')?.value.trim() || 'Black Player';

    resetGameState();
    state.gameMode = 'local';
    state.playerNames = { white: p1, black: p2 };
    state.chess = new Chess();
    state.isGameActive = true;

    clearMoveHistory();
    showGameView();
    setPlayerNames(p1, p2);
    renderBoard(state.chess);
    flipBoard(false);
    setActiveTurn('w');
    updateStatus('♟️', `${p1}'s turn`);
    toggleChatPanel(false);
    toggleOnlineButtons(false);

    sounds.click();
    showToast(`🎮 ${p1} vs ${p2} — Let's go!`, 'success');
}

// ─── Computer Game ────────────────────────────────────────────────────────────

export function startComputerGame() {
    const username = document.getElementById('computer-username')?.value.trim() || 'Player';
    const colorChoice = document.querySelector('.color-option.active')?.dataset.color || 'white';
    const diff = document.querySelector('.diff-option.active')?.dataset.diff || 'medium';

    resetGameState();
    state.gameMode = 'computer';
    state.currentDifficulty = diff;
    state.chess = new Chess();
    state.isGameActive = true;

    // Resolve color
    state.playerColor = colorChoice === 'random'
        ? (Math.random() > 0.5 ? 'white' : 'black')
        : colorChoice;

    state.aiColor = state.playerColor === 'white' ? 'b' : 'w';

    const cfg = getDifficultyConfig(diff);
    const aiName = `🤖 AI (${cfg.label})`;

    state.playerNames = state.playerColor === 'white'
        ? { white: username, black: aiName }
        : { white: aiName, black: username };

    clearMoveHistory();
    showGameView();
    setPlayerNames(state.playerNames.white, state.playerNames.black);
    renderBoard(state.chess);
    flipBoard(state.playerColor === 'black');
    setActiveTurn('w');
    updateStatus('♟️', 'Game started!');
    toggleChatPanel(false);
    toggleOnlineButtons(false);

    sounds.click();
    showToast(`Playing as ${state.playerColor} vs AI (${diff}) 🤖`, 'info');

    if (state.playerColor === 'black') {
        setTimeout(() => triggerAIMove(), 600);
    }
}

// ─── Online Game ──────────────────────────────────────────────────────────────

export function startOnlineGame(color, room) {
    resetGameState();
    state.gameMode = 'online';
    state.onlinePlayerColor = color;
    state.chess = new Chess();
    state.isGameActive = true;

    const myName = getUsername() || 'You';
    const opponentName = room.players.find(p => p.color !== color)?.username || 'Opponent';

    state.playerNames = color === 'white'
        ? { white: myName, black: opponentName }
        : { white: opponentName, black: myName };

    clearMoveHistory();
    showGameView();
    setPlayerNames(state.playerNames.white, state.playerNames.black);
    renderBoard(state.chess);
    flipBoard(color === 'black');
    setActiveTurn('w');
    updateCapturedPieces(state.chess);
    updateStatus('🌐', 'Online game started!');
    toggleChatPanel(true);
    toggleOnlineButtons(true);

    sounds.click();
    showToast(`You are playing as ${color}! 🌐`, 'success');
}