import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@logic': path.resolve(__dirname, 'src/logic')   // <── NEW
    }
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
})
