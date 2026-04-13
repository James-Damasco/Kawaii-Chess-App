/**
 * 🌐 Socket.io Client Module
 * Handles all real-time multiplayer communication
 */

let socket = null;
let currentRoomId = null;
let playerColor = null;
let playerUsername = null;

// Event callbacks
const callbacks = {};

/**
 * Connect to the server
 */
export function connectSocket() {
  if (socket && socket.connected) return socket;

  // Connect to same origin (server serves client)
  socket = io(window.location.origin, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  // ── Connection Events ──────────────────────────────────────────────────────
  socket.on('connect', () => {
    console.log('🔌 Connected to server:', socket.id);
    emit('connect');
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected:', reason);
    emit('disconnect', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    emit('connect_error', err);
  });

  // ── Room Events ────────────────────────────────────────────────────────────
  socket.on('roomCreated', (data) => {
    currentRoomId = data.roomId;
    playerColor = data.color;
    console.log(`🏠 Room created: ${currentRoomId}, playing as ${playerColor}`);
    emit('roomCreated', data);
  });

  socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    playerColor = data.color;
    console.log(`👥 Joined room: ${currentRoomId}, playing as ${playerColor}`);
    emit('roomJoined', data);
  });

  socket.on('gameStarted', (data) => {
    console.log('🎮 Game started!', data);
    emit('gameStarted', data);
  });

  // ── Game Events ────────────────────────────────────────────────────────────
  socket.on('moveMade', (data) => {
    emit('moveMade', data);
  });

  socket.on('gameRestarted', (data) => {
    emit('gameRestarted', data);
  });

  socket.on('gameEnded', (data) => {
    emit('gameEnded', data);
  });

  // ── Player Events ──────────────────────────────────────────────────────────
  socket.on('playerDisconnected', (data) => {
    emit('playerDisconnected', data);
  });

  socket.on('playerReconnected', (data) => {
    emit('playerReconnected', data);
  });

  socket.on('reconnected', (data) => {
    currentRoomId = data.room?.id;
    playerColor = data.color;
    emit('reconnected', data);
  });

  // ── Chat Events ────────────────────────────────────────────────────────────
  socket.on('receiveMessage', (data) => {
    emit('receiveMessage', data);
  });

  // ── Draw Events ────────────────────────────────────────────────────────────
  socket.on('drawOffered', (data) => {
    emit('drawOffered', data);
  });

  socket.on('drawAccepted', () => {
    emit('drawAccepted');
  });

  socket.on('drawDeclined', () => {
    emit('drawDeclined');
  });

  // ── Error Events ───────────────────────────────────────────────────────────
  socket.on('error', (data) => {
    emit('serverError', data);
  });

  socket.on('roomInfo', (data) => {
    emit('roomInfo', data);
  });

  return socket;
}

/**
 * Disconnect the socket
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentRoomId = null;
    playerColor = null;
  }
}

// ─── Emit Server Events ───────────────────────────────────────────────────────

export function createRoom(username) {
  playerUsername = username;
  socket?.emit('createRoom', { username });
}

export function joinRoom(roomId, username) {
  playerUsername = username;
  socket?.emit('joinRoom', { roomId, username });
}

export function makeMove(move, fen, pgn) {
  socket?.emit('makeMove', {
    roomId: currentRoomId,
    move,
    fen,
    pgn
  });
}

export function sendChatMessage(message) {
  socket?.emit('sendMessage', {
    roomId: currentRoomId,
    message,
    username: playerUsername
  });
}

export function requestRestart() {
  socket?.emit('restartGame', { roomId: currentRoomId });
}

export function offerDraw() {
  socket?.emit('offerDraw', { roomId: currentRoomId, username: playerUsername });
}

export function respondToDrawOffer(accepted) {
  socket?.emit('respondDraw', { roomId: currentRoomId, accepted });
}

export function notifyGameOver(result, reason) {
  socket?.emit('gameOver', { roomId: currentRoomId, result, reason });
}

export function reconnectToRoom(roomId, username) {
  socket?.emit('reconnectToRoom', { roomId, username });
}

// ─── Event System ─────────────────────────────────────────────────────────────

/** Subscribe to a socket event */
export function on(event, callback) {
  if (!callbacks[event]) callbacks[event] = [];
  callbacks[event].push(callback);
  return () => off(event, callback); // Returns unsubscribe fn
}

/** Unsubscribe from a socket event */
export function off(event, callback) {
  if (callbacks[event]) {
    callbacks[event] = callbacks[event].filter(cb => cb !== callback);
  }
}

/** Emit an event to local subscribers */
function emit(event, data) {
  if (callbacks[event]) {
    callbacks[event].forEach(cb => cb(data));
  }
}

// ─── Getters ──────────────────────────────────────────────────────────────────

export function getRoomId() { return currentRoomId; }
export function getPlayerColor() { return playerColor; }
export function getUsername() { return playerUsername; }
export function isConnected() { return socket?.connected ?? false; }
