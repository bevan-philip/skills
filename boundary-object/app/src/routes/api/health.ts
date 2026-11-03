import { createFileRoute } from '@tanstack/react-router'
import { rootDir } from '@/server/store'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () =>
        Response.json({ ok: true, app: 'boundary-object', version: __BOUNDARY_VERSION__, root: rootDir(), pid: process.pid }),
    },
  },
})
