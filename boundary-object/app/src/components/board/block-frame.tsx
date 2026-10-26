import * as React from 'react'
import { ChevronDown, MessageSquarePlus } from 'lucide-react'
import type { Block } from '@/lib/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Markdown } from '@/components/board/markdown'
import { BlockThreads, Composer } from '@/components/board/threads'
import { useBoard } from '@/components/board/context'
import { blockMeta } from '@/components/board/block-meta'
import { threadsFor } from '@/lib/state'
import { cn } from '@/lib/utils'

export function BlockFrame({
  block,
  needsInput,
  wide,
  toolbar,
  children,
}: {
  block: Block
  needsInput?: boolean
  wide?: boolean
  toolbar?: React.ReactNode
  children: React.ReactNode
}) {
  const { changes, state, addComment } = useBoard()
  const [open, setOpen] = React.useState(!block.collapsed)
  const [composing, setComposing] = React.useState(false)
  const meta = blockMeta(block)
  const Icon = meta.icon
  const change = changes[block.id]
  const ref = React.useRef<HTMLDivElement>(null)
  const threads = threadsFor(state, block.id).length

  // Flash a block when the agent updates it while you're looking.
  const firstChange = React.useRef(change)
  React.useEffect(() => {
    if (change && change !== firstChange.current) {
      ref.current?.classList.remove('flash')
      void ref.current?.offsetWidth
      ref.current?.classList.add('flash')
    }
    firstChange.current = change
  }, [change, block])

  return (
    <Card
      ref={ref}
      id={`b-${block.id}`}
      data-block={block.id}
      className={cn(
        'scroll-mt-20 overflow-hidden',
        needsInput && 'border-human/40 ring-1 ring-human/15',
        change === 'changed' && 'border-changed/50',
        change === 'new' && 'border-added/50',
        wide && 'lg:-mx-16',
      )}
    >
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] leading-snug font-semibold">{block.title ?? meta.label}</h3>
            {needsInput && <Badge variant="human">needs you</Badge>}
            {change === 'new' && <Badge variant="added">new</Badge>}
            {change === 'changed' && <Badge variant="changed">updated</Badge>}
          </div>
          {block.note && <Markdown className="mt-0.5 text-muted-foreground" body={block.note} />}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {toolbar}
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              setOpen(true)
              setComposing(true)
            }}
          >
            <MessageSquarePlus />
            {threads > 0 ? threads : <span className="sr-only sm:not-sr-only">Comment</span>}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={open ? 'Collapse' : 'Expand'}
            className="text-muted-foreground"
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown className={cn('transition-transform', !open && '-rotate-90')} />
          </Button>
        </div>
      </div>
      {open && (
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div data-quote-block={block.id}>{children}</div>
          <BlockThreads block={block.id} />
          {composing && (
            <Composer
              placeholder={`Comment on “${block.title ?? meta.label}”…`}
              onSubmit={(text) => {
                addComment({ block: block.id }, text)
                setComposing(false)
              }}
              onCancel={() => setComposing(false)}
            />
          )}
        </div>
      )}
    </Card>
  )
}
