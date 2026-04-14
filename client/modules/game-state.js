/**
 * 🗃️ game-state.js
 * Single source of truth for all mutable game state.
 * All modules import from here — no circular deps.
 */

export const state = {
    // ── Chess engine instance ───────────────────────────────────────────────
    chess: null,

    // ── Current mode: 'local' | 'online' | 'computer' ──────────────────────
    gameMode: 'local',

    // ── Lifecycle flags ─────────────────────────────────────────────────────
    isGameActive: false,
    isPaused: false,
    isAIThinking: false,

    // ── Local / Computer mode ────────────────────────────────────────────────
    playerNames: { white: 'White', black: 'Black' },
    playerColor: 'white',   // human's color in computer mode
    aiColor: 'b',
    currentDifficulty: 'medium',

    // ── Online mode ──────────────────────────────────────────────────────────
    onlinePlayerColor: null,     // 'white' | 'black'

    // ── Board interaction ────────────────────────────────────────────────────
    selectedSquare: null,

    // ── UI ───────────────────────────────────────────────────────────────────
    currentTheme: 'cute',

    // ── User preferences ────────────────────────────────────────────────────
    settings: {
        showLegalMoves: true,
        highlightLastMove: true,
        animatePieces: true,
        showCoordinates: true,
        sound: true
    }
};

/** Convenience reset for a new game (keeps mode/settings intact) */
export function resetGameState() {
    state.chess = null;
    state.isGameActive = false;
    state.isPaused = false;
    state.isAIThinking = false;
    state.selectedSquare = null;
}