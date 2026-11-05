// Kleine Klangbibliothek: alle Geräusche werden live mit der Web Audio API erzeugt,
// es gibt keine Audiodateien. Stumm-Schaltung wird pro Browser gemerkt.

import { useSyncExternalStore } from 'react';

export type SoundName = 'tap' | 'pop' | 'clack' | 'chime' | 'fanfare' | 'error' | 'whoosh';

const MUTE_KEY = 'mosswood.muted';
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

function audio(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur: number, freq: number, gain: number, delay = 0, q = 4) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t);
}

const SOUNDS: Record<SoundName, () => void> = {
  tap: () => tone(720, 0.07, 'sine', 0.04),
  pop: () => {
    tone(380, 0.14, 'sine', 0.12, 0, 980);
    tone(1200, 0.08, 'triangle', 0.03, 0.06);
  },
  clack: () => {
    noise(0.06, 1700, 0.35);
    tone(170, 0.09, 'triangle', 0.1);
    noise(0.05, 2300, 0.2, 0.07);
    tone(210, 0.07, 'triangle', 0.07, 0.07);
  },
  chime: () => {
    tone(659, 0.4, 'triangle', 0.07);
    tone(988, 0.5, 'triangle', 0.06, 0.1);
    tone(1319, 0.7, 'sine', 0.045, 0.2);
  },
  fanfare: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.45, 'triangle', 0.07, i * 0.11));
    tone(1568, 0.9, 'sine', 0.04, 0.45);
  },
  error: () => tone(240, 0.2, 'sine', 0.07, 0, 150),
  whoosh: () => noise(0.25, 900, 0.12, 0, 0.8),
};

export const sound = {
  play(name: SoundName) {
    if (muted) return;
    try {
      SOUNDS[name]();
    } catch {
      /* Audio nicht verfügbar – still weiterspielen */
    }
  },
  isMuted: () => muted,
  setMuted(value: boolean) {
    muted = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
      /* ignorieren */
    }
    listeners.forEach((l) => l());
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export function useMuted() {
  return useSyncExternalStore(sound.subscribe, sound.isMuted, sound.isMuted);
}
