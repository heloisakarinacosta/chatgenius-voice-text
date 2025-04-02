
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
      'Content-Security-Policy': "default-src 'self' http://localhost:* https://*.openai.com https://*.googleapis.com; script-src 'self' https://cdn.gpteng.co https://*.googleapis.com 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http://localhost:* https://*.openai.com https://api.openai.com wss://*.googleapis.com https://*.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*; media-src 'self' blob: https://*; worker-src 'self' blob:;"
    }
  },
  preview: {
    host: "::",
    port: 8080,
    headers: {
      'Content-Security-Policy': "default-src 'self' http://localhost:* https://*.openai.com https://*.googleapis.com; script-src 'self' https://cdn.gpteng.co https://*.googleapis.com 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http://localhost:* https://*.openai.com https://api.openai.com wss://*.googleapis.com https://*.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*; media-src 'self' blob: https://*; worker-src 'self' blob:;"
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
      PORT: process.env.PORT || 8080
    }
  }
}));
