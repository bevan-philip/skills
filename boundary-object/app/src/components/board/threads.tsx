import * as React from 'react'
import { Bot, CornerDownRight, MessageSquarePlus, Pencil, Trash2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { KindBadge, Mark, type MarkKind } from '@/components/board/marks'
import { Markdown } from '@/components/board/markdown'
import { useBoard } from '@/components/board/context'
import { threadsFor, type Comment, type Thread } from '@/lib/state'
import type { Target } from '@/lib/schema'
import { cn } from '@/lib/utils'

export function Composer({
  placeholder = 'Say what you think…',
  initial = '',
  submitLabel = 'Add comment',
  onSubmit,
  onCancel,
  autoFocus = true,
}: {
  placeholder?: string
  initial?: string
  submitLabel?: string
  onSubmit: (text: string) => void
  onCancel?: () => void
  autoFocus?: boolean
}) {
  const [text, setText] = React.useState(initial)
  const ok = text.trim().length > 0
  const send = () => ok && onSubmit(text.trim())
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
          if (e.key === 'Escape') onCancel?.()
        }}
        className="min-h-20"
      />
      <div className="flex items-center justify-between gap-2">
        <KbdGroup className="text-[11px] text-muted-foreground">
          <Kbd>⌘/Ctrl</Kbd>
          <Kbd>Enter</Kbd>
        </KbdGroup>
        <div className="flex gap-2">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button size="sm" disabled={!ok} onClick={send}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function targetLabel(t: Target): string | null {
  if (t.element) return t.element.text ? `“${t.element.text.slice(0, 40)}”` : `<${t.element.tag}>`
  return t.label ?? t.item ?? null
}

function HumanBubble({ c, pinIndex }: { c: Comment; pinIndex?: number }) {
  const { isDraft, removeDraft, editDraft } = useBoard()
  const [editing, setEditing] = React.useState(false)
  const draft = isDraft(c.id)
  const label = targetLabel(c.target)
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-human-soft text-human">
        {pinIndex !== undefined ? <span className="text-[11px] font-semibold">{pinIndex}</span> : <UserRound className="size-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">You</span>
          {label && !c.replyTo && <span className="truncate">on {label}</span>}
          {draft ? <Mark tone="human">draft</Mark> : <span>· round {c.round}</span>}
          {draft && !editing && (
            <span className="ml-auto flex gap-0.5">
              <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => removeDraft(c.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </span>
          )}
        </div>
        {c.target.quote && !c.replyTo && (
          <blockquote className="mt-1 border-l-2 border-human/50 pl-2 text-xs text-muted-foreground italic">
            {c.target.quote.length > 220 ? `${c.target.quote.slice(0, 217)}…` : c.target.quote}
          </blockquote>
        )}
        {editing ? (
          <div className="mt-1.5">
            <Composer
              initial={c.text}
              submitLabel="Save"
              onSubmit={(t) => {
                editDraft(c.id, t)
                setEditing(false)
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.text}</p>
        )}
      </div>
    </div>
  )
}

const replyTone: Record<string, { label: string; kind: MarkKind }> = {
  resolved: { label: 'resolved', kind: 'added' },
  declined: { label: 'declined', kind: 'removed' },
  question: { label: 'asks you', kind: 'changed' },
  noted: { label: 'noted', kind: 'secondary' },
}

function AgentBubble({ commentId }: { commentId: string }) {
  const { doc, diff } = useBoard()
  const r = doc.replies[commentId]
  if (!r) return null
  const tone = r.status ? replyTone[r.status] : null
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bot className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Agent</span>
          {tone && <KindBadge kind={tone.kind}>{tone.label}</KindBadge>}
          {diff.newReplies.includes(commentId) && <Mark tone="changed">new</Mark>}
        </div>
        <Markdown className="mt-0.5" body={r.text} />
      </div>
    </div>
  )
}

function ThreadView({ t, pinIndex }: { t: Thread; pinIndex?: number }) {
  const { addComment, isDraft } = useBoard()
  const [replying, setReplying] = React.useState(false)
  const all = [t.root, ...t.followups]
  const canReply = !isDraft(t.root.id)
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background/60 p-3" id={`c-${t.root.id}`}>
      {all.map((c) => (
        <React.Fragment key={c.id}>
          <HumanBubble c={c} pinIndex={c === t.root ? pinIndex : undefined} />
          <AgentBubble commentId={c.id} />
        </React.Fragment>
      ))}
      {canReply &&
        (replying ? (
          <div className="pl-8">
            <Composer
              placeholder="Reply…"
              submitLabel="Reply"
              onSubmit={(text) => {
                addComment(t.root.target, text, t.root.id)
                setReplying(false)
              }}
              onCancel={() => setReplying(false)}
            />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            className="ml-6 self-start text-muted-foreground"
            onClick={() => setReplying(true)}
          >
            <CornerDownRight /> Reply
          </Button>
        ))}
    </div>
  )
}

// Pins are numbered in creation order across a block so the dots on an image
// match the numbers in its thread list.
export function pinNumbers(threads: Thread[]) {
  const m = new Map<string, number>()
  threads.filter((t) => t.root.target.pin || t.root.target.element).forEach((t, i) => m.set(t.root.id, i + 1))
  return m
}

export function BlockThreads({ block }: { block: string }) {
  const { state } = useBoard()
  const threads = threadsFor(state, block)
  if (!threads.length) return null
  const pins = pinNumbers(threads)
  return (
    <div className="flex flex-col gap-2">
      {threads.map((t) => (
        <ThreadView key={t.root.id} t={t} pinIndex={pins.get(t.root.id)} />
      ))}
    </div>
  )
}

export function itemThreadCount(threads: Thread[], item: string) {
  return threads.filter((t) => t.root.target.item === item).length
}

// A small speech-bubble button for commenting on one item inside a block.
export function ItemComment({
  block,
  item,
  label,
  extra,
  className,
}: {
  block: string
  item?: string
  label: string
  extra?: Partial<Target>
  className?: string
}) {
  const { state, addComment } = useBoard()
  const [open, setOpen] = React.useState(false)
  const count = threadsFor(state, block).filter(
    (t) => t.root.target.item === item && (extra?.line === undefined || t.root.target.line === extra.line),
  ).length
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          aria-label={`Comment on ${label}`}
          className={cn(
            'shrink-0 px-1.5',
            count
              ? 'bg-human-soft text-human hover:bg-human-soft hover:text-human'
              : 'text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <MessageSquarePlus className="size-3.5" />
          {count > 0 && count}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 truncate text-xs text-muted-foreground">
          Comment on <span className="font-medium text-foreground">{label}</span>
        </div>
        <Composer
          onSubmit={(text) => {
            addComment({ block, item, label, ...extra }, text)
            setOpen(false)
          }}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
