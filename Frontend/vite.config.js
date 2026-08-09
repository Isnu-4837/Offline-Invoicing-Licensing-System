import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: Remove VitePWA for Electron build
export default defineConfig({
  base: "./",   // THIS FIXES /assets PROBLEM
  plugins: [react()],
})