/**
 * ♟️ move-handler.js
 * Handles square clicks, drag-drop, move execution, game-over detection.
 */

import { state } from './game-state.js';
import {
    renderBoard, highlightSquares, highlightLastMove,
    highlightCheck, clearHighlights, clearCheck, addPieceLanding
} from './board.js';
import {
    showToast, updateStatus, setActiveTurn,
    addMoveToHistory, updateCapturedPieces,
    showGameOverModal, launchConfetti,
    showAIThinking, hideAIThinking, showPromotionModal
} from './ui.js';
import { sounds } from './sounds.js';
import { getBestMove, getDifficultyConfig } from './ai.js';
import { makeMove as socketMakeMove } from './socket-client.js';

// ─── Square Click ─────────────────────────────────────────────────────────────

export function handleSquareClick(square) {
    const { chess, isGameActive, isPaused, gameMode,
        onlinePlayerColor, playerColor, isAIThinking } = state;

    if (!isGameActive || !chess || isPaused) return;

    // Online: only your turn
    if (gameMode === 'online') {
        const myColor = onlinePlayerColor === 'white' ? 'w' : 'b';
        if (chess.turn() !== myColor) {
            showToast('Wait for your turn! ⏳', 'warning', 1500);
            return;
        }
    }

    // Computer: only human's turn
    if (gameMode === 'computer') {
        const myColor = playerColor === 'white' ? 'w' : 'b';
        if (chess.turn() !== myColor || isAIThinking) return;
    }

    const piece = chess.get(square);

    if (state.selectedSquare) {
        if (state.selectedSquare === square) {
            state.selectedSquare = null;
            clearHighlights();
            return;
        }

        // Attempt move first
        if (tryMove(state.selectedSquare, square)) {
            state.selectedSquare = null;
            return;
        }

        // Re-select if own piece
        if (piece && piece.color === chess.turn()) {
            selectSquare(square);
            return;
        }

        state.selectedSquare = null;
        clearHighlights();
    } else {
        if (piece && piece.color === chess.turn()) {
            selectSquare(square);
        }
    }
}

// ─── Piece Drop (drag & touch) ────────────────────────────────────────────────

export function handlePieceDrop(from, to) {
    const { chess, isGameActive, isPaused, gameMode,
        onlinePlayerColor, playerColor, isAIThinking } = state;

    if (!isGameActive || !chess || isPaused) return;

    if (gameMode === 'online') {
        const myColor = onlinePlayerColor === 'white' ? 'w' : 'b';
        if (chess.turn() !== myColor) return;
    }
    if (gameMode === 'computer') {
        const myColor = playerColor === 'white' ? 'w' : 'b';
        if (chess.turn() !== myColor || isAIThinking) return;
    }

    state.selectedSquare = null;
    clearHighlights();
    tryMove(from, to);
}

// ─── Try Move ─────────────────────────────────────────────────────────────────

export async function tryMove(from, to) {
    const { chess } = state;
    if (!chess) return false;

    const piece = chess.get(from);
    const isPromotion =
        piece?.type === 'p' &&
        ((piece.color === 'w' && to[1] === '8') ||
            (piece.color === 'b' && to[1] === '1'));

    let promotionPiece = 'q';
    if (isPromotion) {
        clearHighlights();
        promotionPiece = await showPromotionModal(piece.color);
    }

    const move = chess.move({ from, to, promotion: promotionPiece });
    if (!move) {
        sounds.error();
        return false;
    }

    onMoveMade(move);
    return true;
}

// ─── On Move Made ─────────────────────────────────────────────────────────────

export function onMoveMade(move, isOpponentMove = false) {
    clearHighlights();
    clearCheck();

    renderBoard(state.chess);

    if (!isOpponentMove) addPieceLanding(move.to);

    highlightLastMove(move.from, move.to);
    updateCapturedPieces(state.chess);

    const moveNum = Math.ceil(state.chess.history().length / 2);
    addMoveToHistory(move, moveNum, move.color);

    // Sounds
    if (state.settings.sound) {
        if (move.flags.includes('k') || move.flags.includes('q')) sounds.castle();
        else if (move.flags.includes('p')) sounds.promote();
        else if (move.captured) sounds.capture();
        else sounds.move();
    }

    const gameOver = checkGameState();
    if (gameOver) return;

    setActiveTurn(state.chess.turn());
    updateStatus(
        '♟️',
        `${state.chess.turn() === 'w' ? state.playerNames.white : state.playerNames.black}'s turn`
    );

    if (state.chess.in_check()) {
        const kingSquare = findKing(state.chess.turn());
        if (kingSquare) highlightCheck(kingSquare);
        sounds.check();
        showToast(`${state.chess.turn() === 'w' ? '♔' : '♚'} Check!`, 'warning', 2000);
    }

    // Sync online
    if (state.gameMode === 'online' && !isOpponentMove) {
        socketMakeMove(move, state.chess.fen(), state.chess.pgn());
    }

    // AI turn
    if (state.gameMode === 'computer' && !isOpponentMove) {
        const myColor = state.playerColor === 'white' ? 'w' : 'b';
        if (state.chess.turn() !== myColor) {
            const delay = getDifficultyConfig(state.currentDifficulty).delay;
            setTimeout(() => triggerAIMove(), delay);
        }
    }
}

// ─── AI Move ──────────────────────────────────────────────────────────────────

export async function triggerAIMove() {
    if (!state.isGameActive || !state.chess || state.chess.game_over() || state.isPaused) return;
    if (state.chess.turn() !== state.aiColor) return;

    state.isAIThinking = true;
    showAIThinking();
    updateStatus('🤖', 'AI is thinking…');

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        const best = getBestMove(state.chess, state.currentDifficulty, state.aiColor);
        if (best && state.isGameActive && !state.isPaused) {
            state.chess.move(best);
            onMoveMade(best, false);
        }
    } catch (e) {
        console.error('AI error:', e);
    } finally {
        state.isAIThinking = false;
        hideAIThinking();
    }
}

// ─── Game State Check ─────────────────────────────────────────────────────────

function checkGameState() {
    const { chess, playerNames } = state;

    if (chess.in_checkmate()) {
        const winner = chess.turn() === 'w' ? 'Black' : 'White';
        const loser = chess.turn() === 'w' ? 'White' : 'Black';
        setTimeout(() => {
            sounds.win();
            launchConfetti();
            showGameOverModal(`${winner} Wins! 🎉`, `${loser} is in checkmate!`, winner === 'White' ? '♔' : '♚');
        }, 300);
        state.isGameActive = false;
        return true;
    }

    if (chess.in_stalemate()) {
        setTimeout(() => {
            sounds.draw();
            showGameOverModal('Stalemate!', 'No legal moves — the game is a draw.', '🤝');
        }, 300);
        state.isGameActive = false;
        return true;
    }

    if (chess.in_draw()) {
        const reason = chess.insufficient_material()
            ? 'Draw by insufficient material'
            : 'Draw by repetition / 50-move rule';
        setTimeout(() => {
            sounds.draw();
            showGameOverModal("It's a Draw!", reason, '🤝');
        }, 300);
        state.isGameActive = false;
        return true;
    }

    return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findKing(color) {
    const board = state.chess.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.type === 'k' && p.color === color) {
                return `${'abcdefgh'[c]}${8 - r}`;
            }
        }
    }
    return null;
}

function selectSquare(square) {
    state.selectedSquare = square;
    const legalMoves = state.chess.moves({ square, verbose: true });
    const moveSquares = legalMoves.map(m => m.to);
    const captureSquares = legalMoves
        .filter(m => m.captured || m.flags.includes('e'))
        .map(m => m.to);
    const quietSquares = moveSquares.filter(s => !captureSquares.includes(s));
    highlightSquares(square, quietSquares, captureSquares);
}