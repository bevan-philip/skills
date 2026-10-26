import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Mermaid's lazy chunks are big by nature; they only load when a board uses one.
  build: { chunkSizeWarningLimit: 2500 },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
})
