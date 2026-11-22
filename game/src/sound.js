// Tiny WebAudio sound effects, all synthesised in code — no audio files, no network.
// The context is created lazily on the first user gesture, so it never blocks loading.

let context = null;

function audio() {
  if (context) return context;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
  } catch {
    return null;
  }
  return context;
}

/** One short tone: a sine or square blip sliding from one frequency to another. */
function blip(frequencyFrom, frequencyTo, duration, type, volume) {
  const ctx = audio();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequencyFrom, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, frequencyTo), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    // Sound is garnish: a failure here must never break the game.
  }
}

export const SOUNDS = {
  /** A soft coin chime when loot is pocketed. */
  pickup() {
    blip(880, 1320, 0.12, 'sine', 0.12);
  },
  /** The heavy clink of the tiara case opening. */
  tiara() {
    blip(520, 1040, 0.35, 'triangle', 0.16);
    setTimeout(() => blip(1040, 1560, 0.3, 'sine', 0.12), 90);
  },
  /** The alarm's rising two-tone warning while the thief is seen. */
  spotted() {
    blip(620, 460, 0.18, 'square', 0.07);
  },
  /** The EMP's electric zap. */
  emp() {
    blip(1800, 120, 0.35, 'sawtooth', 0.1);
  },
  /** The decoy's thrown clatter. */
  decoy() {
    blip(300, 180, 0.1, 'square', 0.1);
  },
  /** A guard's grab: a dull thud. */
  grabbed() {
    blip(140, 60, 0.25, 'sawtooth', 0.18);
  },
  /** The getaway fanfare when the thief slips out with the loot. */
  win() {
    blip(523, 523, 0.14, 'triangle', 0.14);
    setTimeout(() => blip(659, 659, 0.14, 'triangle', 0.14), 140);
    setTimeout(() => blip(784, 1046, 0.3, 'triangle', 0.16), 280);
  },
  /** The caught sting when the alarm maxes out. */
  lose() {
    blip(392, 196, 0.5, 'sawtooth', 0.14);
  },
};
