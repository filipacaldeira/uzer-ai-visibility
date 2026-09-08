import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Local dev/preview only: the proxy injects the Peekaboo key from .env.local.
// In production the key is injected by the Netlify edge function instead and
// never ships in the bundle.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    '/api-proxy': {
      target: 'https://www.aipeekaboo.com',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api-proxy/, ''),
      secure: true,
      headers: { 'X-API-Key': env.VITE_API_KEY || '' },
    },
  }
  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
