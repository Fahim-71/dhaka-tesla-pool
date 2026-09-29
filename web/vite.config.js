import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs on :4000. Proxying /api means the browser
// talks to one origin, exactly like in Docker (nginx) - no CORS needed locally.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
