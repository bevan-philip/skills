import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs/promises'
import path from 'node:path'
import { resolveAsset } from '@/server/store'

const types: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
}

export const Route = createFileRoute('/api/boards/$id/file/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = resolveAsset(params.id, decodeURIComponent(params._splat ?? ''))
        if (!file) return new Response('not found', { status: 404 })
        const type = types[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
        const headers: Record<string, string> = {
          'content-type': type,
          'cache-control': 'no-cache',
          'x-content-type-options': 'nosniff',
        }
        // Agent-written HTML runs in an opaque origin even when opened directly.
        if (type.startsWith('text/html')) headers['content-security-policy'] = 'sandbox allow-scripts'
        return new Response(await fs.readFile(file), { headers })
      },
    },
  },
})
