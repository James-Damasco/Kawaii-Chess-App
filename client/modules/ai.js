/**
 * ♟️ Chess AI Module
 * Minimax algorithm with alpha-beta pruning for computer opponent
 */

// ─── Piece Values ─────────────────────────────────────────────────────────────
const PIECE_VALUES = {
  p: 100,   // Pawn
  n: 320,   // Knight
  b: 330,   // Bishop
  r: 500,   // Rook
  q: 900,   // Queen
  k: 20000  // King
};

// ─── Piece-Square Tables (encourage good positioning) ─────────────────────────
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];

const ROOK_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
  0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_TABLE_MIDGAME = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20
];

/**
 * Get the positional bonus for a piece at a given square
 */
function getPieceSquareValue(piece, row, col, isWhite) {
  const tableRow = isWhite ? (7 - row) : row;
  const idx = tableRow * 8 + col;

  switch (piece.toLowerCase()) {
    case 'p': return PAWN_TABLE[idx];
    case 'n': return KNIGHT_TABLE[idx];
    case 'b': return BISHOP_TABLE[idx];
    case 'r': return ROOK_TABLE[idx];
    case 'q': return QUEEN_TABLE[idx];
    case 'k': return KING_TABLE_MIDGAME[idx];
    default:  return 0;
  }
}

/**
 * Evaluate the board position from white's perspective
 * Higher = better for white
 */
function evaluateBoard(chess) {
  if (chess.in_checkmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.in_stalemate() || chess.in_draw()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = board[row][col];
      if (!sq) continue;

      const isWhite = sq.color === 'w';
      const pieceValue = PIECE_VALUES[sq.type] || 0;
      const posValue = getPieceSquareValue(sq.type, row, col, isWhite);
      const total = pieceValue + posValue;

      score += isWhite ? total : -total;
    }
  }

  return score;
}

/**
 * Minimax with Alpha-Beta pruning
 */
function minimax(chess, depth, alpha, beta, isMaximizing) {
  if (depth === 0 || chess.game_over()) {
    return evaluateBoard(chess);
  }

  const moves = chess.moves({ verbose: true });

  // Move ordering: captures first (improves alpha-beta efficiency)
  moves.sort((a, b) => {
    const aCapture = a.captured ? PIECE_VALUES[a.captured] : 0;
    const bCapture = b.captured ? PIECE_VALUES[b.captured] : 0;
    return bCapture - aCapture;
  });

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const evalScore = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break; // Prune
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const evalScore = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break; // Prune
    }
    return minEval;
  }
}

/**
 * Get the best move for the AI
 * @param {Chess} chess - Chess.js instance
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @param {string} aiColor - 'w' | 'b'
 * @returns {Object|null} best move
 */
export function getBestMove(chess, difficulty, aiColor) {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  // Easy: completely random
  if (difficulty === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Medium: 50% chance random, 50% depth-1 minimax
  if (difficulty === 'medium') {
    if (Math.random() < 0.3) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    return getBestMoveByDepth(chess, 2, aiColor);
  }

  // Hard: depth-4 minimax with alpha-beta
  return getBestMoveByDepth(chess, 4, aiColor);
}

/**
 * Get the best move at a given search depth
 */
function getBestMoveByDepth(chess, depth, aiColor) {
  const moves = chess.moves({ verbose: true });
  const isMaximizing = aiColor === 'w';

  let bestMove = null;
  let bestScore = isMaximizing ? -Infinity : Infinity;

  // Shuffle moves for variety
  const shuffled = [...moves].sort(() => Math.random() - 0.5);

  // Move ordering: captures first
  shuffled.sort((a, b) => {
    const aCapture = a.captured ? PIECE_VALUES[a.captured] : 0;
    const bCapture = b.captured ? PIECE_VALUES[b.captured] : 0;
    return bCapture - aCapture;
  });

  for (const move of shuffled) {
    chess.move(move);
    const score = minimax(chess, depth - 1, -Infinity, Infinity, !isMaximizing);
    chess.undo();

    if (isMaximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove || moves[0];
}

/**
 * Get AI difficulty config
 */
export function getDifficultyConfig(difficulty) {
  const configs = {
    easy:   { label: '🌸 Easy',   depth: 1, delay: 400  },
    medium: { label: '⚡ Medium', depth: 2, delay: 700  },
    hard:   { label: '💀 Hard',   depth: 4, delay: 1200 }
  };
  return configs[difficulty] || configs.medium;
}
