# ♟️ Kawaii Chess — Full-Stack Real-Time Chess App

A **production-ready**, cute, modern chess web application with **local multiplayer**, **online multiplayer via Socket.io**, and **AI opponent with Minimax algorithm**.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
# or for auto-reload during development:
npm run dev
```

### 3. Open in Browser

```
http://localhost:3000
```

---

## 🎮 Game Modes

### 👥 Local Multiplayer
- Two players on one device
- Turn indicator with player names
- Undo move support
- Full move history

### 🌐 Online Multiplayer (Socket.io)
1. **Player 1**: Click "Online" → Enter name → Click "Create Room"
2. Share the 6-character room code with your friend
3. **Player 2**: Click "Online" → Enter name → Enter the code → Click "Join"
4. Game starts automatically when both players connect!

Features:
- Real-time move synchronization
- In-game chat
- Draw offers
- Resign button
- Reconnection handling

### 🤖 vs AI (Computer)
- Three difficulty levels:
  - 🌸 **Easy** — Random moves
  - ⚡ **Medium** — Depth-2 Minimax
  - 💀 **Hard** — Depth-4 Minimax with Alpha-Beta pruning
- Choose to play as White, Black, or Random

---

## ♟️ Chess Features

- ✅ Full legal move validation (Chess.js)
- ✅ Check, checkmate, stalemate detection
- ✅ Castling (kingside & queenside)
- ✅ En passant
- ✅ Pawn promotion (UI piece selector)
- ✅ Move history panel
- ✅ Captured pieces display
- ✅ Drag & drop pieces
- ✅ Touch support for mobile
- ✅ Highlight legal moves
- ✅ Highlight last move
- ✅ King in check indicator
- ✅ Board flip

---

## 🎨 Themes

- 🎀 **Cute Pastel** — Pink & lavender
- 🌙 **Dark Mode** — Deep navy & indigo
- ♟️ **Classic** — Traditional brown wood
- 🌿 **Forest** — Earthy greens

---

## 📡 Socket.io Events

### Client → Server
| Event | Data | Description |
|-------|------|-------------|
| `createRoom` | `{ username }` | Create a new room |
| `joinRoom` | `{ roomId, username }` | Join an existing room |
| `makeMove` | `{ roomId, move, fen, pgn }` | Send a move |
| `sendMessage` | `{ roomId, message, username }` | Chat message |
| `restartGame` | `{ roomId }` | Restart the game |
| `offerDraw` | `{ roomId, username }` | Offer a draw |
| `respondDraw` | `{ roomId, accepted }` | Accept/decline draw |
| `gameOver` | `{ roomId, result, reason }` | Notify game end |

### Server → Client
| Event | Data | Description |
|-------|------|-------------|
| `roomCreated` | `{ roomId, color, room }` | Room creation confirmed |
| `roomJoined` | `{ roomId, color, room }` | Successfully joined room |
| `gameStarted` | `{ room, message }` | Both players connected |
| `moveMade` | `{ move, fen, pgn, player }` | Opponent made a move |
| `receiveMessage` | `{ username, message }` | Chat message received |
| `playerDisconnected` | `{ username, color }` | Opponent left |
| `playerReconnected` | `{ username }` | Opponent reconnected |
| `gameRestarted` | `{ fen, message }` | Game was restarted |
| `drawOffered` | `{ username }` | Draw offer received |
| `drawAccepted` | — | Draw accepted |
| `gameEnded` | `{ result, reason }` | Game ended |

---

## 📁 Project Structure

```
chess-app/
├── client/                 # Frontend
│   ├── index.html          # Main HTML
│   ├── styles.css          # All styles (4 themes)
│   ├── main.js             # Game controller (ES6 module)
│   └── modules/
│       ├── board.js        # Board rendering & drag/drop
│       ├── ai.js           # Minimax AI engine
│       ├── ui.js           # UI helpers & components
│       ├── sounds.js       # Web Audio API sound effects
│       └── socket-client.js # Socket.io client wrapper
├── server/
│   └── server.js           # Express + Socket.io server
├── package.json
└── README.md
```

---

## ⚙️ Configuration

### Port
Default: `3000`

Change with environment variable:
```bash
PORT=8080 npm start
```

### Production
For production deployment, consider:
- Using `pm2` for process management
- Setting up nginx as reverse proxy
- Using `NODE_ENV=production`

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Node.js + Express** | HTTP server |
| **Socket.io** | Real-time multiplayer |
| **Chess.js** | Game logic & validation |
| **Anime.js** | Smooth animations |
| **Web Audio API** | Synthetic sound effects |
| **Vanilla ES6+** | No framework needed |
| **CSS Custom Properties** | Theme system |

---

## 📱 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari / Chrome for Android

---

## 🔧 Development Notes

- The frontend uses ES6 modules (`type="module"`) — must be served via HTTP, not `file://`
- The server serves the client files statically
- Socket.io automatically handles WebSocket fallback to polling
- The AI runs synchronously on the main thread — for very deep searches, consider a Web Worker

---

Built with ❤️ and ♟️
