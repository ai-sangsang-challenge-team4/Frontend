/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  // 'http' calls the backend escalation endpoints; anything else uses the mock.
  readonly VITE_ESCALATION_API?: string;
  readonly VITE_MOCK_AUTH_DELAY_MS?: string;
  readonly VITE_MOCK_AUTH_SESSION_TTL_MS?: string;
}
