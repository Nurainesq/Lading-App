/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute API origin for native builds, e.g. https://api.lading.app.
   * Left unset on the web, where a relative /api is proxied same-origin.
   */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
