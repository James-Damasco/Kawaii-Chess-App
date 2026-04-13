/**
 * ♟️ Chess Board Rendering Module
 * Handles rendering, highlighting, drag & drop
 */

import { sounds } from './sounds.js';

// ─── Piece Unicode Characters ─────────────────────────────────────────────────
const PIECE_SYMBOLS = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
};

// ─── State ────────────────────────────────────────────────────────────────────
let boardElement = null;
let selectedSquare = null;
let legalMoveSquares = [];
let lastMoveSquares = [];
let flipped = false;
let dragPiece = null;
let dragGhost = null;
let settings = {
  showLegalMoves: true,
  highlightLastMove: true,
  animatePieces: true,
  showCoordinates: true
};

// Callbacks
let onSquareClick = null;
let onPieceDrop = null;

/**
 * Initialize the board
 */
export function initBoard(element, callbacks = {}) {
  boardElement = element;
  onSquareClick = callbacks.onSquareClick;
  onPieceDrop = callbacks.onPieceDrop;

  // Create 64 squares
  for (let rank = 8; rank >= 1; rank--) {
    for (let file = 0; file < 8; file++) {
      const fileLetter = 'abcdefgh'[file];
      const squareName = `${fileLetter}${rank}`;
      const isLight = (file + rank) % 2 !== 0;

      const square = document.createElement('div');
      square.className = `square ${isLight ? 'light' : 'dark'}`;
      square.dataset.square = squareName;
      square.setAttribute('role', 'gridcell');
      square.setAttribute('aria-label', squareName);

      // Click handler
      square.addEventListener('click', handleSquareClick);

      // Drag over
      square.addEventListener('dragover', handleDragOver);
      square.addEventListener('drop', handleDrop);
      square.addEventListener('dragenter', handleDragEnter);

      // Touch events
      square.addEventListener('touchstart', handleTouchStart, { passive: false });
      square.addEventListener('touchmove', handleTouchMove, { passive: false });
      square.addEventListener('touchend', handleTouchEnd, { passive: false });

      boardElement.appendChild(square);
    }
  }

  renderCoordinates();
}

/**
 * Render all pieces from a Chess.js board
 */
export function renderBoard(chess) {
  if (!boardElement) return;

  const board = chess.board();
  const squares = boardElement.querySelectorAll('.square');

  squares.forEach(sq => {
    const squareName = sq.dataset.square;
    const file = squareName.charCodeAt(0) - 97;
    const rank = parseInt(squareName[1]) - 1;
    const piece = board[7 - rank][file];

    // Remove existing piece
    const existing = sq.querySelector('.piece');
    if (existing) sq.removeChild(existing);

    if (piece) {
      const pieceEl = document.createElement('div');
      const key = `${piece.color}${piece.type.toUpperCase()}`;
      pieceEl.className = `piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`;
      pieceEl.textContent = PIECE_SYMBOLS[key] || '';
      pieceEl.dataset.piece = piece.type;
      pieceEl.dataset.color = piece.color;
      pieceEl.dataset.square = squareName;

      // Drag events
      pieceEl.draggable = true;
      pieceEl.addEventListener('dragstart', handleDragStart);
      pieceEl.addEventListener('dragend', handleDragEnd);

      sq.appendChild(pieceEl);
    }
  });
}

/**
 * Animate a piece moving from one square to another
 */
export function animateMove(from, to, callback) {
  if (!settings.animatePieces || typeof anime === 'undefined') {
    callback?.();
    return;
  }

  const fromSquare = getSquareElement(from);
  const toSquare = getSquareElement(to);
  if (!fromSquare || !toSquare) { callback?.(); return; }

  const fromPiece = fromSquare.querySelector('.piece');
  if (!fromPiece) { callback?.(); return; }

  const fromRect = fromSquare.getBoundingClientRect();
  const toRect = toSquare.getBoundingClientRect();

  const deltaX = toRect.left - fromRect.left;
  const deltaY = toRect.top - fromRect.top;

  anime({
    targets: fromPiece,
    translateX: deltaX,
    translateY: deltaY,
    duration: 180,
    easing: 'easeOutCubic',
    complete: () => {
      fromPiece.style.transform = '';
      callback?.();
    }
  });
}

/**
 * Highlight selected square and legal moves
 */
export function highlightSquares(selected, legalMoves = [], captures = []) {
  clearHighlights();
  selectedSquare = selected;
  legalMoveSquares = legalMoves;

  if (selected) {
    const sq = getSquareElement(selected);
    if (sq) sq.classList.add('selected');
  }

  if (settings.showLegalMoves) {
    legalMoves.forEach(s => {
      const sq = getSquareElement(s);
      if (sq) sq.classList.add('legal-move');
    });
    captures.forEach(s => {
      const sq = getSquareElement(s);
      if (sq) {
        sq.classList.remove('legal-move');
        sq.classList.add('legal-capture');
      }
    });
  }
}

/**
 * Highlight last move squares
 */
export function highlightLastMove(from, to) {
  // Clear previous last-move highlights
  boardElement?.querySelectorAll('.last-move').forEach(sq => sq.classList.remove('last-move'));
  lastMoveSquares = [from, to];

  if (settings.highlightLastMove) {
    if (from) getSquareElement(from)?.classList.add('last-move');
    if (to) getSquareElement(to)?.classList.add('last-move');
  }
}

/**
 * Highlight the king in check
 */
export function highlightCheck(kingSquare) {
  boardElement?.querySelectorAll('.in-check').forEach(sq => sq.classList.remove('in-check'));
  if (kingSquare) {
    const sq = getSquareElement(kingSquare);
    if (sq) {
      sq.classList.add('in-check');
      const piece = sq.querySelector('.piece');
      if (piece) piece.classList.add('king-in-check');
    }
  }
}

/**
 * Clear all highlights
 */
export function clearHighlights() {
  if (!boardElement) return;
  boardElement.querySelectorAll('.selected, .legal-move, .legal-capture')
    .forEach(sq => sq.classList.remove('selected', 'legal-move', 'legal-capture'));
  selectedSquare = null;
  legalMoveSquares = [];
}

/**
 * Clear check highlights
 */
export function clearCheck() {
  boardElement?.querySelectorAll('.in-check').forEach(sq => sq.classList.remove('in-check'));
  boardElement?.querySelectorAll('.king-in-check').forEach(el => el.classList.remove('king-in-check'));
}

/**
 * Add landing animation to a piece
 */
export function addPieceLanding(square) {
  const piece = getSquareElement(square)?.querySelector('.piece');
  if (piece) {
    piece.classList.remove('piece-landing');
    void piece.offsetWidth; // Force reflow
    piece.classList.add('piece-landing');
    piece.addEventListener('animationend', () => piece.classList.remove('piece-landing'), { once: true });
  }
}

/**
 * Flip the board (for playing as black)
 */
export function flipBoard(shouldFlip) {
  if (!boardElement) return;
  flipped = shouldFlip;

  boardElement.classList.add('flipping');
  setTimeout(() => {
    if (shouldFlip) {
      boardElement.style.transform = 'rotate(180deg)';
      // Rotate pieces back so they're right-side up
      boardElement.querySelectorAll('.piece').forEach(p => {
        p.style.transform = 'rotate(180deg)';
      });
    } else {
      boardElement.style.transform = '';
      boardElement.querySelectorAll('.piece').forEach(p => {
        p.style.transform = '';
      });
    }
    boardElement.classList.remove('flipping');
    renderCoordinates();
  }, 250);
}

/**
 * Update settings
 */
export function updateSettings(newSettings) {
  settings = { ...settings, ...newSettings };
}

export function isFlipped() { return flipped; }

// ─── Coordinate Labels ────────────────────────────────────────────────────────

function renderCoordinates() {
  const ranksEl = document.getElementById('coord-ranks');
  const filesEl = document.getElementById('coord-files');
  if (!ranksEl || !filesEl) return;

  const ranks = flipped ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
  const files = flipped ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];

  ranksEl.innerHTML = ranks.map(r =>
    `<span class="coord-label">${r}</span>`
  ).join('');

  filesEl.innerHTML = files.map(f =>
    `<span class="coord-label">${f}</span>`
  ).join('');
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

function handleSquareClick(e) {
  const square = e.currentTarget.dataset.square;
  onSquareClick?.(square, e);
}

function handleDragStart(e) {
  const piece = e.currentTarget;
  dragPiece = piece;

  // Create drag ghost
  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  dragGhost.textContent = piece.textContent;
  dragGhost.style.color = piece.classList.contains('white-piece')
    ? 'var(--piece-white)'
    : 'var(--piece-black)';
  document.body.appendChild(dragGhost);

  e.dataTransfer.setDragImage(new Image(), 0, 0);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', piece.dataset.square);

  piece.style.opacity = '0.3';

  // Trigger square click to show legal moves
  const squareName = piece.dataset.square;
  onSquareClick?.(squareName, { isDragStart: true });

  document.addEventListener('mousemove', updateGhostPosition);
}

function handleDragEnd(e) {
  if (dragPiece) {
    dragPiece.style.opacity = '1';
    dragPiece = null;
  }
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
  document.removeEventListener('mousemove', updateGhostPosition);
}

function updateGhostPosition(e) {
  if (dragGhost) {
    dragGhost.style.left = e.clientX + 'px';
    dragGhost.style.top = e.clientY + 'px';
  }
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
}

function handleDrop(e) {
  e.preventDefault();
  const targetSquare = e.currentTarget.dataset.square;
  const sourceSquare = e.dataTransfer.getData('text/plain');
  if (sourceSquare && targetSquare && sourceSquare !== targetSquare) {
    onPieceDrop?.(sourceSquare, targetSquare);
  }
}

// ─── Touch Drag Support ───────────────────────────────────────────────────────

let touchStartSquare = null;
let touchGhost = null;

function handleTouchStart(e) {
  const square = e.currentTarget;
  const piece = square.querySelector('.piece');
  if (!piece) return;

  touchStartSquare = square.dataset.square;
  onSquareClick?.(touchStartSquare, { isDragStart: true });

  // Create touch ghost
  touchGhost = document.createElement('div');
  touchGhost.className = 'drag-ghost';
  touchGhost.textContent = piece.textContent;
  touchGhost.style.color = piece.classList.contains('white-piece')
    ? 'var(--piece-white)'
    : 'var(--piece-black)';
  document.body.appendChild(touchGhost);

  const touch = e.touches[0];
  touchGhost.style.left = touch.clientX + 'px';
  touchGhost.style.top = touch.clientY + 'px';

  piece.style.opacity = '0.3';
  e.preventDefault();
}

function handleTouchMove(e) {
  if (!touchGhost) return;
  const touch = e.touches[0];
  touchGhost.style.left = touch.clientX + 'px';
  touchGhost.style.top = touch.clientY + 'px';
  e.preventDefault();
}

function handleTouchEnd(e) {
  if (!touchStartSquare) return;

  const touch = e.changedTouches[0];
  const element = document.elementFromPoint(touch.clientX, touch.clientY);
  const targetSquare = element?.closest('.square')?.dataset.square;

  if (touchGhost) {
    touchGhost.remove();
    touchGhost = null;
  }

  // Restore opacity
  const sourceSquareEl = getSquareElement(touchStartSquare);
  const piece = sourceSquareEl?.querySelector('.piece');
  if (piece) piece.style.opacity = '1';

  if (targetSquare && targetSquare !== touchStartSquare) {
    onPieceDrop?.(touchStartSquare, targetSquare);
  } else if (targetSquare === touchStartSquare) {
    onSquareClick?.(touchStartSquare);
  }

  touchStartSquare = null;
  e.preventDefault();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSquareElement(squareName) {
  return boardElement?.querySelector(`[data-square="${squareName}"]`);
}

export { getSquareElement };
