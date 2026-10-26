import { createFileRoute } from '@tanstack/react-router'
import { boardExists, check } from '@/server/store'

export const Route = createFileRoute('/api/boards/$id/check')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!boardExists(params.id)) return Response.json({ ok: false, error: 'doc.json not found' }, { status: 404 })
        return Response.json(await check(params.id))
      },
    },
  },
})
