/**
 * 🔊 Sound Effects Module using Howler.js
 * Generates synthetic sounds since we don't have audio files
 */

let soundEnabled = true;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Play a synthetic sound using Web Audio API
 */
function playTone({ frequency = 440, type = 'sine', duration = 0.15, volume = 0.3, ramp = true } = {}) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
    if (ramp) {
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    } else {
      gainNode.gain.setValueAtTime(volume, ctx.currentTime + duration - 0.02);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    }

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Silently fail if audio not available
  }
}

/**
 * Play a chord (multiple frequencies)
 */
function playChord(frequencies, options = {}) {
  frequencies.forEach((freq, i) => {
    setTimeout(() => playTone({ frequency: freq, ...options }), i * 30);
  });
}

// ─── Sound Effects ────────────────────────────────────────────────────────────

export const sounds = {
  /** Soft pop for regular moves */
  move() {
    playTone({ frequency: 523, type: 'triangle', duration: 0.12, volume: 0.2 });
  },

  /** Sparkle for captures */
  capture() {
    playChord([880, 1100, 1320], { type: 'sine', duration: 0.15, volume: 0.15 });
  },

  /** Alert sound for check */
  check() {
    playTone({ frequency: 660, type: 'square', duration: 0.1, volume: 0.25 });
    setTimeout(() => playTone({ frequency: 880, type: 'square', duration: 0.1, volume: 0.25 }), 100);
  },

  /** Dramatic sound for checkmate */
  checkmate() {
    const freqs = [523, 466, 415, 349];
    freqs.forEach((freq, i) => {
      setTimeout(() => playTone({ frequency: freq, type: 'sawtooth', duration: 0.3, volume: 0.2 }), i * 150);
    });
  },

  /** Happy jingle when winning */
  win() {
    const melody = [523, 659, 784, 1047];
    melody.forEach((freq, i) => {
      setTimeout(() => playTone({ frequency: freq, type: 'triangle', duration: 0.2, volume: 0.25 }), i * 120);
    });
  },

  /** Gentle sound for castling */
  castle() {
    playChord([440, 554], { type: 'triangle', duration: 0.2, volume: 0.2 });
  },

  /** Pawn promotion sound */
  promote() {
    const melody = [523, 659, 784, 1047, 1319];
    melody.forEach((freq, i) => {
      setTimeout(() => playTone({ frequency: freq, type: 'sine', duration: 0.15, volume: 0.2 }), i * 80);
    });
  },

  /** Click sound for UI interactions */
  click() {
    playTone({ frequency: 1000, type: 'sine', duration: 0.06, volume: 0.15 });
  },

  /** Notification sound for chat */
  notification() {
    playChord([880, 1100], { type: 'sine', duration: 0.12, volume: 0.12 });
  },

  /** Error/invalid move sound */
  error() {
    playTone({ frequency: 200, type: 'square', duration: 0.15, volume: 0.2 });
  },

  /** Draw / stalemate */
  draw() {
    playChord([523, 659, 784], { type: 'triangle', duration: 0.25, volume: 0.18 });
  }
};

export function setSoundEnabled(enabled) {
  soundEnabled = enabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}

/**
 * Initialize sound system (call on first user interaction)
 */
export function initSounds() {
  try {
    getAudioContext();
  } catch (e) {
    soundEnabled = false;
  }
}
