/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adresse des Spielservers, z. B. https://mosswood-server.onrender.com. Leer = gleiche Herkunft. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
