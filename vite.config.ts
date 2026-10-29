import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
