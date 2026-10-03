/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOCK_AUTH_DELAY_MS?: string;
  readonly VITE_MOCK_AUTH_SESSION_TTL_MS?: string;
}
