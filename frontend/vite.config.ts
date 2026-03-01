import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    allowedHosts: true,
    proxy: Object.fromEntries(
      ['/api', '/auth', '/users', '/health'].map((prefix) => [
        prefix,
        {
          target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
          changeOrigin: true,
        },
      ]),
    ),
  },
})
