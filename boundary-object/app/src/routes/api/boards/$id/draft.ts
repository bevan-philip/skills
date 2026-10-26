import { createFileRoute } from '@tanstack/react-router'
import { boardExists, saveDraft } from '@/server/store'
import { draft } from '@/lib/schema'

// Plain-HTTP draft save for navigator.sendBeacon, which the page uses to
// hand over an unsaved edit as the tab closes. The page's normal autosave
// goes through the putDraft server function instead.
export const Route = createFileRoute('/api/boards/$id/draft')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!boardExists(params.id)) return new Response('no such board\n', { status: 404 })
        const parsed = draft.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return new Response('invalid draft\n', { status: 400 })
        await saveDraft(params.id, parsed.data)
        return new Response(null, { status: 204 })
      },
    },
  },
})
