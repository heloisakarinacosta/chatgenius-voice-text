
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      'Content-Security-Policy': "default-src 'self' http://localhost:* https://localhost:* http://191.232.33.131:* https://191.232.33.131:* https://*.openai.com https://*.googleapis.com https://*.productfruits.com; script-src 'self' https://cdn.gpteng.co https://*.googleapis.com https://*.productfruits.com 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http://localhost:* https://localhost:* http://191.232.33.131:* https://191.232.33.131:* https://*.openai.com https://api.openai.com https://*.productfruits.com wss://*.googleapis.com https://*.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.productfruits.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://* http://*; media-src 'self' blob: https://*; worker-src 'self' blob:;"
    },
    proxy: {
      // In development, proxy API requests to the backend server
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxy
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Set proper headers for JSON content
            proxyReq.setHeader('Accept', 'application/json');
            proxyReq.setHeader('Content-Type', 'application/json');
            console.log('Proxying request:', req.method, req.url || '');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            // Force JSON content type for health endpoint
            if (req.url && req.url.includes('/health')) {
              proxyRes.headers['content-type'] = 'application/json';
            }
            console.log('Proxy response:', proxyRes.statusCode, req.url || '', 'Content-Type:', proxyRes.headers['content-type']);
          });
        }
      }
    }
  },
  preview: {
    host: "::",
    port: 3000,
    headers: {
      'Content-Security-Policy': "default-src 'self' http://localhost:* https://localhost:* http://191.232.33.131:* https://191.232.33.131:* https://*.openai.com https://*.googleapis.com https://*.productfruits.com; script-src 'self' https://cdn.gpteng.co https://*.googleapis.com https://*.productfruits.com 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http://localhost:* https://localhost:* http://191.232.33.131:* https://191.232.33.131:* https://*.openai.com https://api.openai.com https://*.productfruits.com wss://*.googleapis.com https://*.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.productfruits.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://* http://*; media-src 'self' blob: https://*; worker-src 'self' blob:;"
    },
    proxy: {
      // In preview mode, also use proxy (for Lovable preview environment)
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxy
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            // Force JSON content type for health endpoint
            if (req.url && req.url.includes('/health')) {
              proxyRes.headers['content-type'] = 'application/json';
            }
          });
        }
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'process.env': {
      PORT: process.env.PORT || (mode === 'production' ? 3000 : 8080),
      DEV_PORT: 3030, // Development API port defined here
      NODE_ENV: mode, // Make sure NODE_ENV is properly exposed to client code
      API_BASE_URL: '/api' // Define a consistent API base URL for the client
    }
  }
}));
