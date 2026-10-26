import { createFileRoute } from '@tanstack/react-router'
import { subscribe } from '@/server/store'
import { sse } from '@/server/sse'

export const Route = createFileRoute('/api/events')({
  server: {
    handlers: {
      GET: ({ request }) => sse(request, (send) => subscribe('*', send)),
    },
  },
})
