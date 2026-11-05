// Unterscheidet Tippen von Ziehen: Wer die Karte verschiebt, soll dabei nicht
// versehentlich ein Gebäude auswählen. Zählt die Bewegung seit dem letzten Drücken.

let startX = 0;
let startY = 0;
let moved = 0;

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      // ein zweiter Finger (Zoomen) zählt immer als Geste, nicht als Tippen
      if (!e.isPrimary) {
        moved = Infinity;
        return;
      }
      startX = e.clientX;
      startY = e.clientY;
      moved = 0;
    },
    true,
  );
  window.addEventListener(
    'pointermove',
    (e) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.buttons === 0)) return;
      moved = Math.max(moved, Math.hypot(e.clientX - startX, e.clientY - startY));
    },
    true,
  );
}

/** true, wenn der letzte Druck eine Zieh- oder Zoomgeste war. */
export const wasDrag = () => moved > 8;

/** Umhüllt einen Klick-Handler so, dass er nach dem Ziehen nicht auslöst. */
export function tapOnly<A extends unknown[]>(fn: (...args: A) => void) {
  return (...args: A) => {
    if (!wasDrag()) fn(...args);
  };
}
