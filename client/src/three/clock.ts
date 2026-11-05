// Gemeinsame Zeit für Shader (Wind, Wasser, Wolken). Wird einmal pro Bild weitergezählt.
import { useFrame } from '@react-three/fiber';

export const worldTime = { value: 0 };

export function WorldClock() {
  useFrame((_, delta) => {
    worldTime.value += Math.min(delta, 0.1);
  });
  return null;
}

/** Qualitätsstufe: Desktop mit genug Kernen bekommt größere Schattenkarten und mehr Gras. */
export const QUALITY: 'high' | 'medium' = (() => {
  if (typeof navigator === 'undefined') return 'medium';
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
  return !mobile && (navigator.hardwareConcurrency ?? 4) >= 6 ? 'high' : 'medium';
})();
