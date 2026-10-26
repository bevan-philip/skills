import { createFileRoute } from '@tanstack/react-router'
import path from 'node:path'
import { boardExists, docFor, getRound, reviewedDoc, rootDir } from '@/server/store'
import { renderDigest, renderState } from '@/server/digest'

// `?state=1` prints the standing answers across all rounds; otherwise the
// digest of `?round=N` (default: latest).
export const Route = createFileRoute('/api/boards/$id/digest')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!boardExists(params.id)) return new Response('no such board\n', { status: 404 })
        const url = new URL(request.url)
        const { doc, revision, feedback, reopened } = await docFor(params.id)
        if (url.searchParams.get('state')) return new Response(renderState(doc, feedback, revision, reopened) + '\n')
        const n = Number(url.searchParams.get('round')) || undefined
        const { round } = await getRound(params.id, n)
        if (!round) return new Response('No feedback rounds yet.\n')
        const opts = { boardId: params.id, boardDir: path.join(rootDir(), params.id), revision, reopened }
        return new Response(renderDigest(await reviewedDoc(params.id, round.revision), feedback, round, opts) + '\n')
      },
    },
  },
})
