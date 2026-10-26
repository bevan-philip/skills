import { createFileRoute } from '@tanstack/react-router'
import { listBoards } from '@/server/store'

export const Route = createFileRoute('/api/boards/')({
  server: {
    handlers: {
      GET: async () => Response.json(await listBoards()),
    },
  },
})
