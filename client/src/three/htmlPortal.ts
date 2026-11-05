// Fester DOM-Container für alle drei-<Html>-Schilder der Szene.
// Ohne festes Ziel hängt drei die Schilder beim Start einmal um und baut dabei ihre
// React-Wurzel neu auf; die alte Wurzel räumt verspätet ab und leert den Container.
import { useThree } from '@react-three/fiber';
import { createContext, useContext, useEffect, type RefObject } from 'react';
import type * as THREE from 'three';

/**
 * Verschiebt das Bild etwas nach rechts unten, damit die Mitte der Welt im freien Bereich
 * zwischen Hofbuch (links), Vorrat (rechts) und Kopfleiste liegt. Nur auf breiten Schirmen.
 */
export function useHudOffset() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (size.width >= 900) {
      cam.setViewOffset(size.width, size.height, -Math.round(size.width * 0.07), -Math.round(size.height * 0.05), size.width, size.height);
    } else {
      cam.clearViewOffset();
    }
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
}

export const HtmlPortalContext = createContext<RefObject<HTMLElement> | undefined>(undefined);

export function useHtmlPortal() {
  return useContext(HtmlPortalContext);
}
