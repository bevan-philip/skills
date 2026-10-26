import * as React from 'react'
import { Bot, ChevronDown, MessageSquarePlus } from 'lucide-react'
import type { Block } from '@/lib/schema'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Mark } from '@/components/board/marks'
import { Markdown } from '@/components/board/markdown'
import { BlockThreads, Composer } from '@/components/board/threads'
import { useBoard } from '@/components/board/context'
import { blockMeta } from '@/components/board/block-meta'
import { pendingReopen, threadsFor } from '@/lib/state'
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
  const { changes, diff, state, sent, view, addComment } = useBoard()
  const [open, setOpen] = React.useState(!block.collapsed)
  const [composing, setComposing] = React.useState(false)
  const meta = blockMeta(block)
  const Icon = meta.icon
  const change = changes[block.id]
  // A reopened decision shows its change note where the human's answer was.
  const reopenedHere = block.type === 'decision' && pendingReopen(block, view.reopened, sent) !== null
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
    <Collapsible open={open} onOpenChange={setOpen} asChild>
    <Card
      ref={ref}
      id={`b-${block.id}`}
      data-block={block.id}
      className={cn(
        'scroll-mt-20 gap-0 py-0',
        needsInput && 'ring-human/40',
        change === 'changed' && 'ring-changed/50',
        change === 'new' && 'ring-added/50',
        // Diagrams and mockups get more room than text where the page has it.
        wide && 'max-w-[1040px]!',
      )}
    >
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] leading-snug font-semibold">{block.title ?? meta.label}</h3>
            {needsInput && <Mark tone="human">needs you</Mark>}
            {change === 'new' && <Mark tone="added">new</Mark>}
            {change === 'changed' && <Mark tone="changed">updated</Mark>}
          </div>
          {block.note && <Markdown className="mt-0.5 text-muted-foreground" body={block.note} />}
          {change && block.changeNote && !reopenedHere && (
            <div
              className={cn(
                'mt-2 flex gap-2 rounded-md border-l-2 px-2.5 py-1.5 text-[13px]',
                change === 'new' ? 'border-added bg-added-soft/40' : 'border-changed bg-changed-soft/40',
              )}
            >
              <Bot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <Markdown body={block.changeNote} />
            </div>
          )}
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
          <CollapsibleTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={open ? 'Collapse' : 'Expand'} className="text-muted-foreground">
              <ChevronDown className={cn('transition-transform', !open && '-rotate-90')} />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div data-quote-block={block.id}>{children}</div>
          {diff.removedItems[block.id] && (
            <p className="text-xs text-muted-foreground">
              Removed since your last round:{' '}
              {diff.removedItems[block.id].map((label, i) => (
                <React.Fragment key={i}>
                  {i > 0 && ', '}
                  <span className="line-through decoration-removed/60">{label}</span>
                </React.Fragment>
              ))}
            </p>
          )}
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
      </CollapsibleContent>
    </Card>
    </Collapsible>
  )
}

// "new" or "updated" next to an item the agent added or changed since the
// human's last round.
export function ItemChange({ block, item }: { block: string; item: string }) {
  const { diff } = useBoard()
  const c = diff.items[block]?.[item]
  if (!c) return null
  return <Mark tone={c === 'new' ? 'added' : 'changed'}>{c === 'new' ? 'new' : 'updated'}</Mark>
}
