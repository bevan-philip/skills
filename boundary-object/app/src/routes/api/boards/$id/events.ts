import { createFileRoute } from '@tanstack/react-router'
import { isListening, subscribe } from '@/server/store'
import { sse } from '@/server/sse'

export const Route = createFileRoute('/api/boards/$id/events')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        sse(request, (send) => {
          send('presence', { listening: isListening(params.id) })
          return subscribe(params.id, send)
        }),
    },
  },
})
