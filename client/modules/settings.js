/**
 * ⚙️ settings.js
 * Theme switching, settings load / save / apply.
 */

import { state } from './game-state.js';
import { sounds, setSoundEnabled } from './sounds.js';
import { updateSettings as updateBoardSettings } from './board.js';
import { showToast } from './ui.js';

// ─── Theme ────────────────────────────────────────────────────────────────────

const THEME_ICONS = { cute: '🎀', dark: '🌙', classic: '♟️', forest: '🌿' };

export function setTheme(theme) {
    state.currentTheme = theme;
    document.body.setAttribute('data-theme', theme);

    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = THEME_ICONS[theme] || '🎨';

    document.querySelectorAll('#theme-menu .menu-item').forEach(item =>
        item.classList.toggle('active', item.dataset.theme === theme)
    );

    localStorage.setItem('chess-theme', theme);
}

// ─── Load saved settings on boot ─────────────────────────────────────────────

export function loadSettings() {
    // Theme
    const savedTheme = localStorage.getItem('chess-theme') || 'cute';
    setTheme(savedTheme);

    // Settings
    const saved = JSON.parse(localStorage.getItem('chess-settings') || '{}');
    state.settings = { ...state.settings, ...saved };

    syncCheckboxesToState();
    setSoundEnabled(state.settings.sound !== false);
    updateBoardSettings(state.settings);
    applyCoordinateVisibility();
}

// ─── Apply settings from checkboxes ──────────────────────────────────────────

export function applySettings() {
    const map = {
        'setting-show-legal': 'showLegalMoves',
        'setting-highlight-last': 'highlightLastMove',
        'setting-animate-pieces': 'animatePieces',
        'setting-sound': 'sound',
        'setting-coordinates': 'showCoordinates'
    };

    Object.entries(map).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) state.settings[key] = el.checked;
    });

    setSoundEnabled(state.settings.sound);
    const soundIcon = document.getElementById('sound-icon');
    if (soundIcon) soundIcon.textContent = state.settings.sound ? '🔊' : '🔇';

    updateBoardSettings(state.settings);
    applyCoordinateVisibility();

    localStorage.setItem('chess-settings', JSON.stringify(state.settings));
    showToast('Settings saved! ✓', 'success', 1500);
}

// ─── Sync toggle state → checkboxes ──────────────────────────────────────────

function syncCheckboxesToState() {
    const map = {
        'setting-show-legal': 'showLegalMoves',
        'setting-highlight-last': 'highlightLastMove',
        'setting-animate-pieces': 'animatePieces',
        'setting-sound': 'sound',
        'setting-coordinates': 'showCoordinates'
    };
    Object.entries(map).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.checked = state.settings[key] !== false;
    });
}

function applyCoordinateVisibility() {
    document.querySelectorAll('.coord-row, .coord-col').forEach(el => {
        el.style.display = state.settings.showCoordinates ? '' : 'none';
    });
}