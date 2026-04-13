/**
 * ♟️ Kawaii Chess — Main Game Controller
 * Orchestrates all game modes, board, UI, AI, and multiplayer
 */

import {
  initBoard, renderBoard, animateMove,
  highlightSquares, highlightLastMove, highlightCheck,
  clearHighlights, clearCheck, addPieceLanding, flipBoard,
  isFlipped, updateSettings as updateBoardSettings
} from './modules/board.js';

import {
  showToast, updateStatus, setActiveTurn, setPlayerNames,
  addMoveToHistory, clearMoveHistory, updateCapturedPieces,
  showGameOverModal, hideGameOverModal, launchConfetti,
  addChatMessage, showAIThinking, hideAIThinking,
  showPromotionModal, showGameView, showSetupView,
  toggleChatPanel, toggleOnlineButtons, showConnectionStatus,
  hideConnectionStatus, showRoomInfo
} from './modules/ui.js';

import { getBestMove, getDifficultyConfig } from './modules/ai.js';

import {
  connectSocket, disconnectSocket, createRoom, joinRoom,
  makeMove as socketMakeMove, sendChatMessage, requestRestart,
  offerDraw, respondToDrawOffer, notifyGameOver, getRoomId,
  getPlayerColor, getUsername, isConnected, on as socketOn
} from './modules/socket-client.js';

import { sounds, setSoundEnabled, isSoundEnabled, initSounds } from './modules/sounds.js';

// ─── Game State ───────────────────────────────────────────────────────────────
let chess = null;
let gameMode = 'local'; // 'local' | 'online' | 'computer'
let playerNames = { white: 'White', black: 'Black' };
let currentDifficulty = 'medium';
let playerColor = 'white'; // Player's color in computer mode
let aiColor = 'b';
let isGameActive = false;
let isAIThinking = false;
let pendingPromotion = null;
let onlinePlayerColor = null; // 'w' | 'b'
let currentTheme = 'cute';

// Settings
let gameSettings = {
  showLegalMoves: true,
  highlightLastMove: true,
  animatePieces: true,
  showCoordinates: true,
  sound: true
};

// ─── Initialize ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Hide loading screen after a brief moment
  setTimeout(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
        document.getElementById('app').classList.remove('hidden');
        animateAppEntry();
      }, 500);
    }
  }, 1500);

  // Initialize board
  const boardEl = document.getElementById('chess-board');
  initBoard(boardEl, {
    onSquareClick: handleSquareClick,
    onPieceDrop: handlePieceDrop
  });

  // Setup all UI event listeners
  setupEventListeners();

  // Load saved settings & theme
  loadSettings();

  // Initialize audio on first interaction
  document.addEventListener('click', () => initSounds(), { once: true });
}

function animateAppEntry() {
  if (typeof anime !== 'undefined') {
    anime({
      targets: '#top-bar, #setup-panels',
      opacity: [0, 1],
      translateY: [-20, 0],
      delay: anime.stagger(100),
      duration: 500,
      easing: 'easeOutCubic'
    });
  }
}

// ─── Game Initialization ──────────────────────────────────────────────────────

function startLocalGame() {
  const p1 = document.getElementById('local-p1-name')?.value.trim() || 'White Player';
  const p2 = document.getElementById('local-p2-name')?.value.trim() || 'Black Player';

  gameMode = 'local';
  playerNames = { white: p1, black: p2 };
  isGameActive = true;

  chess = new Chess();
  clearMoveHistory();
  showGameView();
  setPlayerNames(p1, p2);
  renderBoard(chess);
  setActiveTurn('w');
  updateStatus('♟️', `${p1}'s turn`);
  toggleChatPanel(false);
  toggleOnlineButtons(false);

  // Ensure board is in correct orientation
  flipBoard(false);

  sounds.click();
  showToast(`Game started! ${p1} vs ${p2}`, 'success');
}

function startComputerGame() {
  const username = document.getElementById('computer-username')?.value.trim() || 'Player';
  const colorChoice = document.querySelector('.color-option.active')?.dataset.color || 'white';
  const diff = document.querySelector('.diff-option.active')?.dataset.diff || 'medium';

  gameMode = 'computer';
  currentDifficulty = diff;
  isGameActive = true;

  // Determine player color
  if (colorChoice === 'random') {
    playerColor = Math.random() > 0.5 ? 'white' : 'black';
  } else {
    playerColor = colorChoice;
  }

  aiColor = playerColor === 'white' ? 'b' : 'w';
  const aiName = `🤖 AI (${getDifficultyConfig(diff).label})`;

  playerNames = playerColor === 'white'
    ? { white: username, black: aiName }
    : { white: aiName, black: username };

  chess = new Chess();
  clearMoveHistory();
  showGameView();
  setPlayerNames(playerNames.white, playerNames.black);
  renderBoard(chess);

  // Flip board if player is black
  const shouldFlip = playerColor === 'black';
  flipBoard(shouldFlip);

  setActiveTurn('w');
  updateStatus('♟️', 'Game started!');
  toggleChatPanel(false);
  toggleOnlineButtons(false);

  sounds.click();
  showToast(`Playing as ${playerColor} vs AI (${diff})`, 'info');

  // If player chose black, AI goes first
  if (playerColor === 'black') {
    setTimeout(() => triggerAIMove(), 500);
  }
}

function startOnlineGame(color, room) {
  gameMode = 'online';
  onlinePlayerColor = color;
  isGameActive = true;

  const myName = getUsername() || 'You';
  const opponentName = room.players.find(p => p.color !== color)?.username || 'Opponent';

  playerNames = color === 'white'
    ? { white: myName, black: opponentName }
    : { white: opponentName, black: myName };

  chess = new Chess();
  clearMoveHistory();
  showGameView();
  setPlayerNames(playerNames.white, playerNames.black);
  renderBoard(chess);

  // Flip if playing as black
  flipBoard(color === 'black');

  setActiveTurn('w');
  updateStatus('🌐', 'Online game started!');
  toggleChatPanel(true);
  toggleOnlineButtons(true);

  sounds.click();
  showToast(`You are playing as ${color}!`, 'success');
}

// ─── Move Handling ────────────────────────────────────────────────────────────

let selectedSquare = null;

function handleSquareClick(square, event) {
  if (!isGameActive || !chess) return;

  // Online: only allow moves on your turn
  if (gameMode === 'online') {
    const myColor = onlinePlayerColor === 'white' ? 'w' : 'b';
    if (chess.turn() !== myColor) {
      showToast("Wait for your turn!", 'warning', 1500);
      return;
    }
  }

  // Computer mode: only allow moves for human player
  if (gameMode === 'computer') {
    const myColor = playerColor === 'white' ? 'w' : 'b';
    if (chess.turn() !== myColor || isAIThinking) return;
  }

  const piece = chess.get(square);

  if (selectedSquare) {
    if (selectedSquare === square) {
      // Deselect
      selectedSquare = null;
      clearHighlights();
      return;
    }

    // Try to move
    if (tryMove(selectedSquare, square)) {
      selectedSquare = null;
      return;
    }

    // If clicked on own piece, select it instead
    if (piece && piece.color === chess.turn()) {
      selectSquare(square);
      return;
    }

    selectedSquare = null;
    clearHighlights();
  } else {
    // Select piece
    if (piece && piece.color === chess.turn()) {
      selectSquare(square);
    }
  }
}

function selectSquare(square) {
  selectedSquare = square;
  const legalMoves = chess.moves({ square, verbose: true });
  const moveSquares = legalMoves.map(m => m.to);
  const captureSquares = legalMoves.filter(m => m.captured || m.flags.includes('e')).map(m => m.to);
  const nonCaptureSquares = moveSquares.filter(s => !captureSquares.includes(s));

  highlightSquares(square, nonCaptureSquares, captureSquares);
}

function handlePieceDrop(from, to) {
  if (!isGameActive || !chess) return;

  // Same turn restrictions as click
  if (gameMode === 'online') {
    const myColor = onlinePlayerColor === 'white' ? 'w' : 'b';
    if (chess.turn() !== myColor) return;
  }
  if (gameMode === 'computer') {
    const myColor = playerColor === 'white' ? 'w' : 'b';
    if (chess.turn() !== myColor || isAIThinking) return;
  }

  selectedSquare = null;
  clearHighlights();
  tryMove(from, to);
}

async function tryMove(from, to) {
  if (!chess) return false;

  // Check for promotion
  const piece = chess.get(from);
  const isPromotion = piece?.type === 'p' && (
    (piece.color === 'w' && to[1] === '8') ||
    (piece.color === 'b' && to[1] === '1')
  );

  let promotionPiece = 'q';
  if (isPromotion) {
    clearHighlights();
    promotionPiece = await showPromotionModal(piece.color);
  }

  // Attempt the move
  const move = chess.move({ from, to, promotion: promotionPiece });

  if (!move) {
    sounds.error();
    return false;
  }

  // Move succeeded!
  onMoveMade(move);
  return true;
}

function onMoveMade(move, isOpponentMove = false) {
  // Clear highlights then re-render
  clearHighlights();
  clearCheck();

  // Animate if possible
  if (gameSettings.animatePieces && !isOpponentMove) {
    renderBoard(chess);
    addPieceLanding(move.to);
  } else {
    renderBoard(chess);
  }

  // Highlight last move
  highlightLastMove(move.from, move.to);

  // Update captured pieces
  updateCapturedPieces(chess);

  // Add to move history
  const moveNum = Math.ceil(chess.history().length / 2);
  addMoveToHistory(move, moveNum, move.color);

  // Play appropriate sound
  if (gameSettings.sound) {
    if (move.flags.includes('k') || move.flags.includes('q')) {
      sounds.castle();
    } else if (move.flags.includes('p')) {
      sounds.promote();
    } else if (move.captured) {
      sounds.capture();
    } else {
      sounds.move();
    }
  }

  // Check game state
  const gameOver = checkGameState();

  if (!gameOver) {
    setActiveTurn(chess.turn());
    updateStatus('♟️', `${chess.turn() === 'w' ? playerNames.white : playerNames.black}'s turn`);

    // Check/check indicator
    if (chess.in_check()) {
      const kingSquare = findKing(chess.turn());
      if (kingSquare) highlightCheck(kingSquare);
      sounds.check();
      showToast(`${chess.turn() === 'w' ? '♔' : '♚'} Check!`, 'warning', 2000);
    }

    // Sync online move
    if (gameMode === 'online' && !isOpponentMove) {
      socketMakeMove(move, chess.fen(), chess.pgn());
    }

    // Trigger AI if computer mode
    if (gameMode === 'computer' && !isOpponentMove) {
      const myColor = playerColor === 'white' ? 'w' : 'b';
      if (chess.turn() !== myColor) {
        setTimeout(() => triggerAIMove(), getDifficultyConfig(currentDifficulty).delay);
      }
    }
  }
}

// ─── Check Game State ─────────────────────────────────────────────────────────

function checkGameState() {
  if (chess.in_checkmate()) {
    const winner = chess.turn() === 'w' ? 'Black' : 'White';
    const loser = chess.turn() === 'w' ? 'White' : 'Black';

    setTimeout(() => {
      sounds.checkmate?.();
      sounds.win();
      launchConfetti();
      showGameOverModal(
        `${winner} Wins! 🎉`,
        `${loser} is checkmated!`,
        winner === 'White' ? '♔' : '♚'
      );
    }, 300);

    if (gameMode === 'online') {
      notifyGameOver(winner.toLowerCase(), 'checkmate');
    }

    isGameActive = false;
    return true;
  }

  if (chess.in_stalemate()) {
    setTimeout(() => {
      sounds.draw();
      showGameOverModal('Stalemate!', 'The game is a draw — no legal moves.', '🤝');
    }, 300);
    isGameActive = false;
    return true;
  }

  if (chess.in_draw()) {
    let reason = 'Draw by repetition';
    if (chess.insufficient_material()) reason = 'Draw by insufficient material';
    setTimeout(() => {
      sounds.draw();
      showGameOverModal("It's a Draw!", reason, '🤝');
    }, 300);
    isGameActive = false;
    return true;
  }

  return false;
}

// ─── AI ───────────────────────────────────────────────────────────────────────

async function triggerAIMove() {
  if (!isGameActive || !chess || chess.game_over()) return;
  if (chess.turn() !== aiColor) return;

  isAIThinking = true;
  showAIThinking();
  updateStatus('🤖', 'AI is thinking…');

  // Run minimax in a small delay to let UI update
  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const bestMove = getBestMove(chess, currentDifficulty, aiColor);
    if (bestMove && isGameActive) {
      chess.move(bestMove);
      onMoveMade(bestMove, false);
    }
  } catch (e) {
    console.error('AI error:', e);
  } finally {
    isAIThinking = false;
    hideAIThinking();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findKing(color) {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === color) {
        return `${'abcdefgh'[c]}${8 - r}`;
      }
    }
  }
  return null;
}

// ─── Game Controls ────────────────────────────────────────────────────────────

function undoMove() {
  if (!chess || !isGameActive) return;

  if (gameMode === 'computer') {
    // Undo two moves (player + AI)
    if (chess.history().length >= 2) {
      chess.undo();
      chess.undo();
    } else if (chess.history().length === 1) {
      chess.undo();
    }
  } else if (gameMode === 'local') {
    chess.undo();
  } else {
    showToast("Can't undo in online mode", 'warning');
    return;
  }

  // Rebuild history display
  rebuildMoveHistory();
  clearHighlights();
  clearCheck();
  renderBoard(chess);
  setActiveTurn(chess.turn());
  updateCapturedPieces(chess);
  updateStatus('↩️', 'Move undone');
  sounds.click();
}

function rebuildMoveHistory() {
  clearMoveHistory();
  const history = chess.history({ verbose: true });
  history.forEach((move, i) => {
    const moveNum = Math.floor(i / 2) + 1;
    addMoveToHistory(move, moveNum, move.color);
  });
}

function restartGame() {
  if (!chess) return;

  chess.reset();
  isGameActive = true;
  isAIThinking = false;
  selectedSquare = null;

  clearMoveHistory();
  clearHighlights();
  clearCheck();
  renderBoard(chess);
  setActiveTurn('w');
  updateCapturedPieces(chess);
  updateStatus('♟️', 'Game restarted!');
  hideGameOverModal();

  // Online: notify opponent
  if (gameMode === 'online') {
    requestRestart();
  }

  // Computer: flip back if needed
  if (gameMode === 'computer') {
    flipBoard(playerColor === 'black');
    if (playerColor === 'black') {
      setTimeout(() => triggerAIMove(), 500);
    }
  }

  sounds.click();
  showToast('Game restarted! ♟️', 'info');
}

function goToMainMenu() {
  isGameActive = false;
  isAIThinking = false;
  selectedSquare = null;
  chess = null;

  hideGameOverModal();
  showSetupView();
  clearHighlights();

  if (gameMode === 'online') {
    disconnectSocket();
    hideConnectionStatus();
    document.getElementById('room-info-panel')?.classList.add('hidden');
  }

  sounds.click();
}

// ─── Online Setup ─────────────────────────────────────────────────────────────

function setupOnlineRoom() {
  const username = document.getElementById('online-username')?.value.trim();
  if (!username) {
    showToast('Please enter your username!', 'warning');
    return;
  }

  showConnectionStatus('Connecting to server…', false);

  const socket = connectSocket();

  // Handle connection
  const unsubConnect = socketOn('connect', () => {
    showConnectionStatus('Connected! Creating room…', true);
    createRoom(username);
    unsubConnect();
  });

  socketOn('roomCreated', (data) => {
    showRoomInfo(data.roomId);
    showConnectionStatus(`Room ${data.roomId} created — waiting for opponent`, true);
    showToast(`Room ${data.roomId} created!`, 'success');
  });

  socketOn('gameStarted', (data) => {
    const myColor = getPlayerColor();
    showConnectionStatus('Opponent joined! Game starting…', true);
    setTimeout(() => {
      hideConnectionStatus();
      startOnlineGame(myColor, data.room);
    }, 1000);
  });

  socketOn('connect_error', () => {
    showConnectionStatus('Connection failed!', false);
    showToast('Could not connect to server', 'error');
  });
}

function joinOnlineRoom() {
  const username = document.getElementById('online-username')?.value.trim();
  const roomCode = document.getElementById('room-code-input')?.value.trim().toUpperCase();

  if (!username) { showToast('Please enter your username!', 'warning'); return; }
  if (!roomCode) { showToast('Please enter a room code!', 'warning'); return; }

  showConnectionStatus('Connecting…', false);

  const socket = connectSocket();

  const unsubConnect = socketOn('connect', () => {
    showConnectionStatus(`Joining room ${roomCode}…`, true);
    joinRoom(roomCode, username);
    unsubConnect();
  });

  socketOn('roomJoined', (data) => {
    const myColor = getPlayerColor();
    showConnectionStatus('Joined! Starting game…', true);
    setTimeout(() => {
      hideConnectionStatus();
      startOnlineGame(myColor, data.room);
    }, 500);
  });

  socketOn('serverError', (data) => {
    showConnectionStatus('Error', false);
    showToast(data.message || 'Failed to join room', 'error');
  });

  socketOn('connect_error', () => {
    showConnectionStatus('Connection failed!', false);
    showToast('Could not connect to server', 'error');
  });

  // If already connected, join immediately
  if (isConnected()) {
    showConnectionStatus(`Joining room ${roomCode}…`, true);
    joinRoom(roomCode, username);
  }
}

function setupOnlineEventHandlers() {
  // Opponent made a move
  socketOn('moveMade', (data) => {
    if (!chess || !isGameActive) return;

    const move = chess.move(data.move);
    if (move) {
      onMoveMade(move, true);
    }
  });

  // Opponent restarted
  socketOn('gameRestarted', (data) => {
    showToast(data.message || 'Game restarted by opponent', 'info');
    restartGame();
  });

  // Opponent disconnected
  socketOn('playerDisconnected', (data) => {
    showToast(`${data.username} disconnected!`, 'warning', 5000);
    updateStatus('⚡', 'Opponent disconnected…');
    addChatMessage('System', `${data.username} has disconnected`, false, true);
  });

  // Opponent reconnected
  socketOn('playerReconnected', (data) => {
    showToast(`${data.username} reconnected!`, 'success');
    addChatMessage('System', `${data.username} has reconnected`, false, true);
  });

  // Chat message
  socketOn('receiveMessage', (data) => {
    const isOwn = data.username === getUsername();
    addChatMessage(data.username, data.message, isOwn);
    if (!isOwn) sounds.notification();
  });

  // Draw offer
  socketOn('drawOffered', (data) => {
    showToast(`${data.username} offers a draw! Accept?`, 'info', 10000);
    // Could add accept/decline buttons here
  });

  socketOn('drawAccepted', () => {
    isGameActive = false;
    sounds.draw();
    showGameOverModal("Draw Accepted!", "The game is a draw.", '🤝');
  });

  socketOn('gameEnded', (data) => {
    isGameActive = false;
  });
}

// ─── Event Listeners Setup ────────────────────────────────────────────────────

function setupEventListeners() {
  // Mode selector
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const mode = btn.dataset.mode;
      gameMode = mode;

      document.querySelectorAll('.setup-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`setup-${mode}`)?.classList.add('active');

      sounds.click();
    });
  });

  // Start Local Game
  document.getElementById('start-local-btn')?.addEventListener('click', startLocalGame);

  // Start Computer Game
  document.getElementById('start-computer-btn')?.addEventListener('click', startComputerGame);

  // Color selector
  document.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sounds.click();
    });
  });

  // Difficulty selector
  document.querySelectorAll('.diff-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sounds.click();
    });
  });

  // Online: Create Room
  document.getElementById('create-room-btn')?.addEventListener('click', setupOnlineRoom);

  // Online: Join Room
  document.getElementById('join-room-btn')?.addEventListener('click', joinOnlineRoom);

  // Room code input: Enter key
  document.getElementById('room-code-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinOnlineRoom();
  });

  // Copy room code
  document.getElementById('copy-room-btn')?.addEventListener('click', () => {
    const code = document.getElementById('room-code-value')?.textContent;
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        showToast('Room code copied!', 'success', 2000);
      });
    }
  });

  // Undo
  document.getElementById('undo-btn')?.addEventListener('click', undoMove);

  // Restart
  document.getElementById('restart-btn')?.addEventListener('click', restartGame);

  // Flip board
  document.getElementById('flip-btn')?.addEventListener('click', () => {
    flipBoard(!isFlipped());
    sounds.click();
  });

  // Resign
  document.getElementById('resign-btn')?.addEventListener('click', () => {
    if (!isGameActive) return;
    isGameActive = false;
    const myColor = onlinePlayerColor === 'white' ? 'White' : 'Black';
    showGameOverModal('Resigned!', `${myColor} resigned.`, '🏳️');
    notifyGameOver(onlinePlayerColor === 'white' ? 'black' : 'white', 'resignation');
    sounds.click();
  });

  // Draw offer
  document.getElementById('draw-btn')?.addEventListener('click', () => {
    offerDraw();
    showToast('Draw offer sent!', 'info');
    sounds.click();
  });

  // Game Over Modal buttons
  document.getElementById('modal-restart-btn')?.addEventListener('click', restartGame);
  document.getElementById('modal-menu-btn')?.addEventListener('click', goToMainMenu);

  // Sound toggle
  document.getElementById('sound-toggle')?.addEventListener('click', () => {
    const enabled = !isSoundEnabled();
    setSoundEnabled(enabled);
    gameSettings.sound = enabled;
    document.getElementById('sound-icon').textContent = enabled ? '🔊' : '🔇';
    showToast(enabled ? 'Sound on 🔊' : 'Sound off 🔇', 'info', 1500);
  });

  // Theme
  document.getElementById('theme-btn')?.addEventListener('click', (e) => {
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
      const theme = item.dataset.theme;
      setTheme(theme);
      document.getElementById('theme-menu')?.classList.add('hidden');
    });
  });

  // Settings
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    document.getElementById('settings-modal')?.classList.remove('hidden');
    sounds.click();
  });

  document.getElementById('close-settings-btn')?.addEventListener('click', () => {
    document.getElementById('settings-modal')?.classList.add('hidden');
    applySettings();
    sounds.click();
  });

  // Chat
  document.getElementById('chat-send-btn')?.addEventListener('click', sendChat);
  document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });

  // Close dropdowns on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#theme-btn') && !e.target.closest('#theme-menu')) {
      document.getElementById('theme-menu')?.classList.add('hidden');
    }
  });

  // Enter key for local player names
  ['local-p1-name', 'local-p2-name'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') startLocalGame();
    });
  });

  // Enter for computer username
  document.getElementById('computer-username')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startComputerGame();
  });

  // Setup online event handlers
  setupOnlineEventHandlers();
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input?.value.trim();
  if (!message || gameMode !== 'online') return;

  sendChatMessage(message);
  addChatMessage(getUsername(), message, true);
  input.value = '';
  sounds.click();
}

// ─── Theme ────────────────────────────────────────────────────────────────────

function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);

  const icons = { cute: '🎀', dark: '🌙', classic: '♟️', forest: '🌿' };
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) themeIcon.textContent = icons[theme] || '🎨';

  // Update active in menu
  document.querySelectorAll('#theme-menu .menu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.theme === theme);
  });

  localStorage.setItem('chess-theme', theme);
  sounds.click();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function loadSettings() {
  // Theme
  const savedTheme = localStorage.getItem('chess-theme') || 'cute';
  setTheme(savedTheme);

  // Settings checkboxes
  const savedSettings = JSON.parse(localStorage.getItem('chess-settings') || '{}');
  gameSettings = { ...gameSettings, ...savedSettings };

  const settingMap = {
    'setting-show-legal': 'showLegalMoves',
    'setting-highlight-last': 'highlightLastMove',
    'setting-animate-pieces': 'animatePieces',
    'setting-sound': 'sound',
    'setting-coordinates': 'showCoordinates'
  };

  Object.entries(settingMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = gameSettings[key] !== false;
  });

  setSoundEnabled(gameSettings.sound !== false);
  updateBoardSettings(gameSettings);
}

function applySettings() {
  const settingMap = {
    'setting-show-legal': 'showLegalMoves',
    'setting-highlight-last': 'highlightLastMove',
    'setting-animate-pieces': 'animatePieces',
    'setting-sound': 'sound',
    'setting-coordinates': 'showCoordinates'
  };

  Object.entries(settingMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) gameSettings[key] = el.checked;
  });

  setSoundEnabled(gameSettings.sound);
  document.getElementById('sound-icon').textContent = gameSettings.sound ? '🔊' : '🔇';
  updateBoardSettings(gameSettings);

  // Coordinate visibility
  const coordEls = document.querySelectorAll('.coord-row, .coord-col');
  coordEls.forEach(el => {
    el.style.display = gameSettings.showCoordinates ? '' : 'none';
  });

  localStorage.setItem('chess-settings', JSON.stringify(gameSettings));
  showToast('Settings saved!', 'success', 1500);
}
