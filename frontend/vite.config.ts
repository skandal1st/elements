import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'),
) as { version?: string }

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || pkg.version || '0.0.0'),
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
