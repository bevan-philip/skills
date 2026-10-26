import { createFileRoute } from '@tanstack/react-router'
import path from 'node:path'
import { boardExists, docFor, markDelivered, reviewedDoc, rootDir, waitForRound } from '@/server/store'
import { renderDigest } from '@/server/digest'

// Long-poll used by `boundary wait`. Returns the oldest round the agent has
// not received yet, marking it delivered, or 204 when the wait times out.
export const Route = createFileRoute('/api/boards/$id/wait')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        // Taking a round marks it delivered, so only the CLI may do it.
        if (request.headers.get('x-boundary-agent') !== '1') return new Response('CLI only\n', { status: 403 })
        if (!boardExists(params.id)) return Response.json({ error: 'no such board' }, { status: 404 })
        const url = new URL(request.url)
        const secs = Math.min(Math.max(Number(url.searchParams.get('timeout') ?? 120), 1), 300)
        const round = await waitForRound(params.id, secs * 1000, request.signal)
        if (!round || request.signal.aborted) return new Response(null, { status: 204 })
        const { revision, feedback } = await docFor(params.id)
        const digest = renderDigest(await reviewedDoc(params.id, round.revision), feedback, round, {
          boardId: params.id,
          boardDir: path.join(rootDir(), params.id),
          revision,
        })
        await markDelivered(params.id, round.n)
        return Response.json({ round, digest })
      },
    },
  },
})
