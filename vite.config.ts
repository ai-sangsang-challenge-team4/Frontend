import type { IncomingMessage } from 'node:http';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Cross-origin fetches carry an Origin that differs from the dev server's host; no-cors requests
// from another site carry no Origin but are marked cross-site by Sec-Fetch-Site.
function isForeignRequest(req: IncomingMessage) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return true;
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.host;
  } catch {
    return true;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET;

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      // The backend paths (/teacher, /auth) overlap app routes, so dev requests go through /api
      // and the prefix is stripped before forwarding.
      proxy: apiProxyTarget ? {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          // Only this dev server's own pages may use the proxy. A request from another site is answered
          // here (404) and never reaches the backend, because the Origin header is dropped below.
          bypass: (req) => (isForeignRequest(req) ? false : undefined),
          // Backend CORS allows only the Vercel origin and answers 403 to any other Origin header,
          // so the proxied request is sent as a same-origin (server-to-server) call.
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyRequest) => proxyRequest.removeHeader('origin'));
          },
        },
      } : undefined,
    },
  };
});
