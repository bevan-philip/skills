import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronRight, GripVertical, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { BlockOf } from '@/lib/schema'
import { key, viewSteps, type ViewStep } from '@/lib/state'
import { AnswerText } from '@/components/board/answer'
import { ItemChange } from '@/components/board/block-frame'
import { useBoard } from '@/components/board/context'
import { Markdown } from '@/components/board/markdown'
import { ItemComment } from '@/components/board/threads'
import { KindBadge, Mark, type MarkKind } from '@/components/board/marks'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const statusBadge: Record<string, { label: string; kind: MarkKind }> = {
  todo: { label: 'to do', kind: 'outline' },
  doing: { label: 'in progress', kind: 'changed' },
  done: { label: 'done', kind: 'added' },
  skipped: { label: 'skipped', kind: 'secondary' },
  changed: { label: 'done differently', kind: 'changed' },
  blocked: { label: 'blocked', kind: 'removed' },
}

function InlineInput({
  initial,
  placeholder,
  onDone,
}: {
  initial: string
  placeholder?: string
  onDone: (v: string | null) => void
}) {
  const [v, setV] = React.useState(initial)
  return (
    <Input
      autoFocus
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(v.trim() || null)
        if (e.key === 'Escape') onDone(null)
      }}
      onBlur={() => onDone(v.trim() || null)}
      className="h-8"
    />
  )
}

export function StepsView({ block }: { block: BlockOf<'steps'> }) {
  const { state, sent, reorder, strike, rename, addStep } = useBoard()
  const sentReason = (id: string) => {
    const s = sent.strikes.get(key(block.id, id))
    return s?.struck && s.reason ? { text: s.reason, round: s.round! } : undefined
  }
  const steps = viewSteps(block, state)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [inserting, setInserting] = React.useState<string | null | undefined>(undefined)
  const [open, setOpen] = React.useState<Set<string>>(new Set())
  const [drag, setDrag] = React.useState<{ id: string; over: string | null } | null>(null)
  const [armed, setArmed] = React.useState<string | null>(null)
  const ids = steps.map((s) => s.id)
  const editable = block.editable

  const move = (id: string, to: number) => {
    const next = ids.filter((x) => x !== id)
    next.splice(Math.max(0, Math.min(to, next.length)), 0, id)
    if (next.join() !== ids.join()) reorder(block.id, next)
  }

  const row = (s: ViewStep, i: number) => {
    const status = s.status ? statusBadge[s.status] : null
    const expanded = open.has(s.id)
    return (
      <li
        key={s.id}
        data-quote-item={s.id}
        draggable={armed === s.id}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          setDrag({ id: s.id, over: null })
        }}
        onDragOver={(e) => {
          if (!drag) return
          e.preventDefault()
          if (drag.over !== s.id) setDrag({ ...drag, over: s.id })
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (drag && drag.id !== s.id) move(drag.id, ids.indexOf(s.id))
          setDrag(null)
        }}
        onDragEnd={() => {
          setDrag(null)
          setArmed(null)
        }}
        className={cn(
          'group relative flex flex-wrap gap-x-3 gap-y-1 px-3 py-3 transition-colors sm:flex-nowrap',
          s.addedByHuman && 'bg-human-soft/40',
          drag?.over === s.id && drag.id !== s.id && 'bg-accent',
          drag?.id === s.id && 'opacity-50',
        )}
      >
        <div className="flex w-7 shrink-0 flex-col items-center gap-1 pt-0.5">
          {editable && (
            <GripVertical
              aria-hidden
              onMouseDown={() => setArmed(s.id)}
              onMouseUp={() => setArmed(null)}
              className="size-3.5 cursor-grab text-muted-foreground/60 opacity-0 group-hover:opacity-100 pointer-coarse:hidden"
            />
          )}
          <span
            className={cn(
              'flex size-6 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
              s.status === 'done' && 'border-added bg-added-soft text-added',
              s.struck && 'text-muted-foreground',
            )}
          >
            {i + 1}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {editing === s.id ? (
              <div className="w-full">
                <InlineInput
                  initial={s.title}
                  onDone={(v) => {
                    if (v && v !== s.title) rename(block.id, s.id, v)
                    setEditing(null)
                  }}
                />
              </div>
            ) : (
              <span className={cn('font-medium', s.struck && 'text-muted-foreground line-through decoration-removed/70')}>
                {s.title}
              </span>
            )}
            {status && <KindBadge kind={status.kind}>{status.label}</KindBadge>}
            <ItemChange block={block.id} item={s.id} />
            {s.addedByHuman && <Mark tone="human">you added</Mark>}
            {s.originalTitle && (
              <Mark tone="human" title={`was: ${s.originalTitle}`}>
                you renamed
              </Mark>
            )}
            {s.struck && <Mark tone="removed">you removed</Mark>}
          </div>
          {s.originalTitle && (
            <p className="mt-0.5 text-xs text-muted-foreground line-through">{s.originalTitle}</p>
          )}
          {s.files && s.files.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {s.files.map((f) => (
                <code key={f} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {f}
                </code>
              ))}
            </div>
          )}
          {s.note && (
            <div className="mt-2 rounded-md border-l-2 border-changed bg-changed-soft/40 px-2.5 py-1.5">
              <Markdown body={s.note} />
            </div>
          )}
          {s.detail && (
            <Collapsible
              open={expanded}
              onOpenChange={(on) =>
                setOpen((o) => {
                  const n = new Set(o)
                  if (on) n.add(s.id)
                  else n.delete(s.id)
                  return n
                })
              }
            >
              <CollapsibleTrigger asChild>
                <Button variant="link" size="xs" className="mt-1 h-auto px-0 text-muted-foreground hover:text-foreground">
                  <ChevronRight className={cn('transition-transform', expanded && 'rotate-90')} />
                  {expanded ? 'Hide details' : 'Details'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Markdown className="mt-1.5 text-muted-foreground" body={s.detail} />
              </CollapsibleContent>
            </Collapsible>
          )}
          {s.struck && (
            <div className="mt-1.5">
              <AnswerText
                label="why remove it"
                value={s.strikeReason ?? ''}
                sent={sentReason(s.id)}
                placeholder="Why remove it? (optional)"
                onCommit={(reason) => strike(block.id, s.id, true, reason.trim() || undefined)}
              />
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-0.5 max-sm:basis-full max-sm:justify-end">
          {editable && (
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
              <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(s.id, i - 1)}>
                <ArrowUp />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Move down"
                disabled={i === steps.length - 1}
                onClick={() => move(s.id, i + 1)}
              >
                <ArrowDown />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Rename" onClick={() => setEditing(s.id)}>
                <Pencil />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Insert step after" onClick={() => setInserting(s.id)}>
                <Plus />
              </Button>
              {s.struck ? (
                <Button size="icon-sm" variant="ghost" aria-label="Restore" onClick={() => strike(block.id, s.id, false)}>
                  <RotateCcw />
                </Button>
              ) : (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove step"
                  onClick={() => strike(block.id, s.id, true)}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          )}
          <ItemComment block={block.id} item={s.id} label={s.title} />
        </div>
      </li>
    )
  }

  const inserter = (after: string | null) => (
    <li key={`ins-${after}`} className="flex gap-3 bg-human-soft/30 px-3 py-2.5">
      <div className="w-7 shrink-0" />
      <div className="flex-1">
        <InlineInput
          initial=""
          placeholder="Describe the new step, then press Enter"
          onDone={(v) => {
            if (v) addStep(block.id, after, v)
            setInserting(undefined)
          }}
        />
      </div>
    </li>
  )

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col divide-y rounded-lg border">
        {inserting === null && inserter(null)}
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            {row(s, i)}
            {inserting === s.id && inserter(s.id)}
          </React.Fragment>
        ))}
      </ol>
      {editable && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setInserting(ids.at(-1) ?? null)}>
            <Plus /> Add a step
          </Button>
          <span className="hidden text-[11px] text-muted-foreground sm:block">
            Drag the handle to reorder · edits go to the agent as proposals
          </span>
        </div>
      )}
    </div>
  )
}
