// Fester DOM-Container für alle drei-<Html>-Schilder der Szene.
// Ohne festes Ziel hängt drei die Schilder beim Start einmal um und baut dabei ihre
// React-Wurzel neu auf; die alte Wurzel räumt verspätet ab und leert den Container.
import { createContext, useContext, type RefObject } from 'react';

export const HtmlPortalContext = createContext<RefObject<HTMLElement> | undefined>(undefined);

export function useHtmlPortal() {
  return useContext(HtmlPortalContext);
}
