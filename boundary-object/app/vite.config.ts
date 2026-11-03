import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  // The built server inlines every package it imports, so the released
  // tarball runs with no node_modules beyond srvx (which server.mjs uses).
  // The dev server keeps the default and loads packages from node_modules.
  ssr: command === 'build' ? { noExternal: true } : {},
  // Reported by /api/health, so the CLI can tell whether the running server
  // is its own version.
  define: { __BOUNDARY_VERSION__: JSON.stringify(version) },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
}))
