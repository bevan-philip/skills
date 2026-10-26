import { createFileRoute } from '@tanstack/react-router'
import { boardExists, getView } from '@/server/store'

export const Route = createFileRoute('/api/boards/$id/')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!boardExists(params.id)) return Response.json({ error: 'no such board' }, { status: 404 })
        return Response.json(await getView(params.id))
      },
    },
  },
})
