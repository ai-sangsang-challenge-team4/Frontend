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
      // The backend has no CORS config and its paths (/teacher, /auth) overlap app routes,
      // so dev requests go through /api and the prefix is stripped before forwarding.
      proxy: apiProxyTarget ? {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      } : undefined,
    },
  };
});
