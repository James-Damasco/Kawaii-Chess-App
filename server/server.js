/**
 * ♟️ Chess App - Backend Server
 * Express + Socket.io real-time multiplayer server
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// ─── Socket.io Setup ─────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// ─── Serve index.html ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ─── Room State Management ────────────────────────────────────────────────────
const rooms = new Map();

/**
 * Room structure:
 * {
 *   id: string,
 *   players: [{ id, username, color }],
 *   spectators: [],
 *   gameState: string (FEN),
 *   moveHistory: [],
 *   chat: [],
 *   status: 'waiting' | 'playing' | 'finished',
 *   createdAt: Date
 * }
 */

function createRoom(roomId, hostSocketId, username) {
  const room = {
    id: roomId,
    players: [
      {
        id: hostSocketId,
        username: username || 'Player 1',
        color: 'white'
      }
    ],
    spectators: [],
    gameState: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // initial FEN
    moveHistory: [],
    chat: [],
    status: 'waiting',
    createdAt: new Date()
  };
  rooms.set(roomId, room);
  return room;
}

function getRoomByPlayer(socketId) {
  for (const [, room] of rooms) {
    if (room.players.find(p => p.id === socketId)) {
      return room;
    }
  }
  return null;
}

// ─── Socket.io Events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`✅ Player connected: ${socket.id}`);

  // ── Create Room ──────────────────────────────────────────────────────────────
  socket.on('createRoom', ({ username }) => {
    const roomId = uuidv4().substring(0, 6).toUpperCase();
    const room = createRoom(roomId, socket.id, username);

    socket.join(roomId);
    socket.emit('roomCreated', {
      roomId,
      color: 'white',
      room: sanitizeRoom(room)
    });

    console.log(`🏠 Room created: ${roomId} by ${username}`);
  });

  // ── Join Room ────────────────────────────────────────────────────────────────
  socket.on('joinRoom', ({ roomId, username }) => {
    const room = rooms.get(roomId.toUpperCase());

    if (!room) {
      socket.emit('error', { message: 'Room not found. Check the room code.' });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full!' });
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress.' });
      return;
    }

    // Add second player
    room.players.push({
      id: socket.id,
      username: username || 'Player 2',
      color: 'black'
    });
    room.status = 'playing';

    socket.join(roomId);

    // Notify joining player
    socket.emit('roomJoined', {
      roomId,
      color: 'black',
      room: sanitizeRoom(room)
    });

    // Notify host that opponent joined
    io.to(roomId).emit('gameStarted', {
      room: sanitizeRoom(room),
      message: `${username || 'Player 2'} joined the game!`
    });

    console.log(`👥 ${username} joined room: ${roomId}`);
  });

  // ── Make Move ────────────────────────────────────────────────────────────────
  socket.on('makeMove', ({ roomId, move, fen, pgn }) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found.' });
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'You are not in this room.' });
      return;
    }

    // Update game state
    room.gameState = fen;
    room.moveHistory.push({
      move,
      fen,
      player: player.color,
      timestamp: new Date()
    });

    // Broadcast move to all players in room (except sender)
    socket.to(roomId).emit('moveMade', {
      move,
      fen,
      pgn,
      player: player.color,
      moveNumber: room.moveHistory.length
    });

    console.log(`♟️ Move in room ${roomId}: ${JSON.stringify(move)} by ${player.username}`);
  });

  // ── Send Chat Message ─────────────────────────────────────────────────────────
  socket.on('sendMessage', ({ roomId, message, username }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const chatMsg = {
      id: uuidv4(),
      username,
      message,
      timestamp: new Date()
    };

    room.chat.push(chatMsg);

    // Broadcast to all in room
    io.to(roomId).emit('receiveMessage', chatMsg);
  });

  // ── Restart Game ─────────────────────────────────────────────────────────────
  socket.on('restartGame', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // Reset game state
    room.gameState = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    room.moveHistory = [];
    room.status = 'playing';

    // Broadcast restart to all players
    io.to(roomId).emit('gameRestarted', {
      fen: room.gameState,
      message: `${player.username} restarted the game!`
    });

    console.log(`🔄 Game restarted in room: ${roomId}`);
  });

  // ── Offer Draw ───────────────────────────────────────────────────────────────
  socket.on('offerDraw', ({ roomId, username }) => {
    socket.to(roomId).emit('drawOffered', { username });
  });

  socket.on('respondDraw', ({ roomId, accepted }) => {
    if (accepted) {
      io.to(roomId).emit('drawAccepted');
    } else {
      socket.to(roomId).emit('drawDeclined');
    }
  });

  // ── Game Over ─────────────────────────────────────────────────────────────────
  socket.on('gameOver', ({ roomId, result, reason }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.status = 'finished';
    io.to(roomId).emit('gameEnded', { result, reason });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`❌ Player disconnected: ${socket.id}`);

    const room = getRoomByPlayer(socket.id);
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        // Notify others in room
        socket.to(room.id).emit('playerDisconnected', {
          username: player.username,
          color: player.color
        });

        // Mark player as disconnected (keep room alive for reconnect)
        player.disconnected = true;
        player.disconnectedAt = new Date();

        // Auto-cleanup after 5 minutes
        setTimeout(() => {
          const currentRoom = rooms.get(room.id);
          if (currentRoom) {
            const stillDisconnected = currentRoom.players.find(
              p => p.id === socket.id && p.disconnected
            );
            if (stillDisconnected) {
              rooms.delete(room.id);
              console.log(`🗑️ Room cleaned up: ${room.id}`);
            }
          }
        }, 5 * 60 * 1000);
      }
    }
  });

  // ── Reconnect ─────────────────────────────────────────────────────────────────
  socket.on('reconnectToRoom', ({ roomId, username }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room no longer exists.' });
      return;
    }

    const disconnectedPlayer = room.players.find(
      p => p.username === username && p.disconnected
    );

    if (disconnectedPlayer) {
      disconnectedPlayer.id = socket.id;
      disconnectedPlayer.disconnected = false;

      socket.join(roomId);
      socket.emit('reconnected', {
        color: disconnectedPlayer.color,
        room: sanitizeRoom(room)
      });

      socket.to(roomId).emit('playerReconnected', {
        username: disconnectedPlayer.username
      });
    }
  });

  // ── Get Room List (for debugging/admin) ──────────────────────────────────────
  socket.on('getRoomInfo', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      socket.emit('roomInfo', sanitizeRoom(room));
    } else {
      socket.emit('error', { message: 'Room not found.' });
    }
  });
});

// ─── Helper: Sanitize room for sending to client ──────────────────────────────
function sanitizeRoom(room) {
  return {
    id: room.id,
    players: room.players.map(p => ({
      username: p.username,
      color: p.color,
      disconnected: p.disconnected || false
    })),
    status: room.status,
    gameState: room.gameState,
    moveHistory: room.moveHistory.map(m => ({ move: m.move, player: m.player })),
    createdAt: room.createdAt
  };
}

// ─── Health Check Endpoint ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: rooms.size,
    uptime: process.uptime()
  });
});

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase());
  if (room) {
    res.json(sanitizeRoom(room));
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ♟️  Chess App Server
  ══════════════════════
  🌐 URL:    http://localhost:${PORT}
  🔌 Socket: ws://localhost:${PORT}
  📊 Rooms:  ${rooms.size} active
  ══════════════════════
  `);
});

module.exports = { app, server, io };
