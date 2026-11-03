import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  // The built server inlines every package it imports, so the released
  // tarball runs with no node_modules beyond srvx (which server.mjs uses).
  // The dev server keeps the default and loads packages from node_modules.
  ssr: command === 'build' ? { noExternal: true } : {},
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
}))
