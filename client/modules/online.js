/**
 * 🌐 online.js
 * All Socket.io room setup, join flow, and in-game event handlers.
 */

import { state } from './game-state.js';
import { onMoveMade } from './move-handler.js';
import { startOnlineGame } from './game-init.js';
import {
    showToast, updateStatus, addChatMessage,
    showGameOverModal, showConnectionStatus,
    hideConnectionStatus, showRoomInfo
} from './ui.js';
import { sounds } from './sounds.js';
import {
    connectSocket, disconnectSocket,
    createRoom, joinRoom,
    offerDraw, notifyGameOver,
    getPlayerColor, getUsername, isConnected,
    on as socketOn
} from './socket-client.js';

// ─── Create Room Flow ─────────────────────────────────────────────────────────

export function handleCreateRoom() {
    const username = document.getElementById('online-username')?.value.trim();
    if (!username) { showToast('Please enter your username! ✍️', 'warning'); return; }

    showConnectionStatus('Connecting to server…', false);
    connectSocket();

    const unsubConnect = socketOn('connect', () => {
        showConnectionStatus('Connected — creating room…', true);
        createRoom(username);
        unsubConnect();
    });

    socketOn('roomCreated', (data) => {
        showRoomInfo(data.roomId);
        showConnectionStatus(`Room ${data.roomId} ready — share it with a friend!`, true);
        showToast(`Room ${data.roomId} created! 🏠`, 'success');
    });

    socketOn('gameStarted', (data) => {
        const color = getPlayerColor();
        showConnectionStatus('Opponent joined — starting!', true);
        setTimeout(() => { hideConnectionStatus(); startOnlineGame(color, data.room); }, 900);
    });

    socketOn('connect_error', () => {
        showConnectionStatus('Connection failed ❌', false);
        showToast('Could not reach the server', 'error');
    });
}

// ─── Join Room Flow ───────────────────────────────────────────────────────────

export function handleJoinRoom() {
    const username = document.getElementById('online-username')?.value.trim();
    const roomCode = document.getElementById('room-code-input')?.value.trim().toUpperCase();

    if (!username) { showToast('Please enter your username! ✍️', 'warning'); return; }
    if (!roomCode) { showToast('Please enter a room code! 🔑', 'warning'); return; }

    showConnectionStatus('Connecting…', false);
    connectSocket();

    const doJoin = () => {
        showConnectionStatus(`Joining room ${roomCode}…`, true);
        joinRoom(roomCode, username);
    };

    if (isConnected()) { doJoin(); }
    else {
        const unsub = socketOn('connect', () => { doJoin(); unsub(); });
    }

    socketOn('roomJoined', (data) => {
        const color = getPlayerColor();
        showConnectionStatus('Joined — starting game…', true);
        setTimeout(() => { hideConnectionStatus(); startOnlineGame(color, data.room); }, 500);
    });

    socketOn('serverError', (data) => {
        showConnectionStatus('Error', false);
        showToast(data.message || 'Failed to join room', 'error');
    });

    socketOn('connect_error', () => {
        showConnectionStatus('Connection failed ❌', false);
        showToast('Could not reach the server', 'error');
    });
}

// ─── In-game Online Event Handlers ───────────────────────────────────────────

export function setupOnlineGameHandlers() {
    // Opponent move
    socketOn('moveMade', (data) => {
        if (!state.chess || !state.isGameActive) return;
        const move = state.chess.move(data.move);
        if (move) onMoveMade(move, true);
    });

    // Restart request from opponent
    socketOn('gameRestarted', (data) => {
        showToast(data.message || 'Game restarted by opponent 🔄', 'info');
        // The game-controls restartGame will be called by the outer layer
        // We just emit a custom DOM event so main.js can respond
        document.dispatchEvent(new CustomEvent('online:restart', { detail: data }));
    });

    // Disconnect / reconnect
    socketOn('playerDisconnected', (data) => {
        showToast(`${data.username} disconnected ⚡`, 'warning', 5000);
        updateStatus('⚡', 'Opponent disconnected…');
        addChatMessage('System', `${data.username} has disconnected`, false, true);
    });

    socketOn('playerReconnected', (data) => {
        showToast(`${data.username} reconnected! 🔌`, 'success');
        addChatMessage('System', `${data.username} has reconnected`, false, true);
    });

    // Chat
    socketOn('receiveMessage', (data) => {
        const isOwn = data.username === getUsername();
        addChatMessage(data.username, data.message, isOwn);
        if (!isOwn) sounds.notification();
    });

    // Draw
    socketOn('drawOffered', (data) => showToast(`${data.username} offers a draw 🤝`, 'info', 8000));
    socketOn('drawAccepted', () => {
        state.isGameActive = false;
        sounds.draw();
        showGameOverModal('Draw Accepted!', 'The game ends in a draw.', '🤝');
    });
    socketOn('gameEnded', () => { state.isGameActive = false; });
}

// ─── Leave Online Session ─────────────────────────────────────────────────────

export function leaveOnlineSession() {
    disconnectSocket();
    hideConnectionStatus();
    document.getElementById('room-info-panel')?.classList.add('hidden');
}