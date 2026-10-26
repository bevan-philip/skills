import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBoard } from '@/lib/api'
import type { BoardView } from '@/lib/schema'
import { BoardPage, BoardMissing } from '@/components/board/board-page'

export const Route = createFileRoute('/b/$id')({
  loader: ({ params }) => getBoard({ data: { id: params.id } }),
  component: BoardRoute,
  errorComponent: ({ error }) => <BoardMissing message={error instanceof Error ? error.message : String(error)} />,
})

function BoardRoute() {
  const { id } = Route.useParams()
  const initial = Route.useLoaderData()
  const qc = useQueryClient()
  const queryKey = ['board', id]
  const { data } = useQuery({ queryKey, queryFn: () => getBoard({ data: { id } }), initialData: initial })

  // The agent edits doc.json; the server tells us and we refetch.
  React.useEffect(() => {
    const es = new EventSource(`/api/boards/${id}/events`)
    const refetch = () => qc.invalidateQueries({ queryKey })
    // `ready` also fires after a reconnect (the CLI restarts the server on rebuild).
    es.addEventListener('ready', refetch)
    es.addEventListener('doc', refetch)
    es.addEventListener('feedback', refetch)
    es.addEventListener('presence', (e) => {
      const { listening } = JSON.parse((e as MessageEvent).data)
      qc.setQueryData<BoardView>(queryKey, (v) => (v ? { ...v, listening } : v))
    })
    return () => es.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, qc])

  if (!data.doc) return <BoardMissing message={data.error ?? 'This board has no content yet.'} />
  return (
    <BoardPage
      key={id}
      view={{ ...data, doc: data.doc }}
      onSubmitted={() => qc.invalidateQueries({ queryKey })}
    />
  )
}
