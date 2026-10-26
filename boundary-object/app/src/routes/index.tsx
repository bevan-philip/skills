import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { getBoards } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Mark } from '@/components/board/marks'
import { ThemeToggle } from '@/components/board/theme'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const qc = useQueryClient()
  const { data: boards = [], isLoading } = useQuery({ queryKey: ['boards'], queryFn: () => getBoards() })
  React.useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('boards', () => qc.invalidateQueries({ queryKey: ['boards'] }))
    return () => es.close()
  }, [qc])
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Boards</h1>
          <p className="text-sm text-muted-foreground">Plans and reports your agents have shared with you.</p>
        </div>
        <ThemeToggle />
      </div>
      {!isLoading && boards.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No boards yet</EmptyTitle>
            <EmptyDescription>
              An agent starts one with <code className="font-mono">boundary new &lt;name&gt;</code>.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <div className="flex flex-col gap-2">
        {boards.map((b) => (
          <Link key={b.id} to="/b/$id" params={{ id: b.id }}>
            <Card className="group flex-row items-center gap-4 px-4 transition-colors hover:bg-accent/50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{b.title}</span>
                  <Badge variant="outline">{b.kind === 'plan' ? 'Plan' : 'Report'}</Badge>
                  {b.error && (
                    <Mark tone="removed">
                      <AlertTriangle /> invalid
                    </Mark>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {b.project ? `${b.project.split(/[\\/]/).pop()} · ` : ''}
                  {b.status ?? b.id} · rev {b.revision} · {b.rounds} round{b.rounds === 1 ? '' : 's'} sent ·{' '}
                  {new Date(b.updatedAt).toLocaleString()}
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
