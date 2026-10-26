import * as React from 'react'
import { Check, CircleHelp, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import type { BlockOf } from '@/lib/schema'
import { key } from '@/lib/state'
import { useBoard } from '@/components/board/context'
import { Markdown } from '@/components/board/markdown'
import { ItemComment } from '@/components/board/threads'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export function Origin({ round }: { round: number | null | undefined }) {
  if (round === undefined) return null
  return round === null ? (
    <Badge variant="human">draft</Badge>
  ) : (
    <span className="text-[11px] text-muted-foreground">sent in round {round}</span>
  )
}

export function MarkdownView({ block }: { block: BlockOf<'markdown'> }) {
  return <Markdown body={block.body} />
}

export function CalloutView({ block }: { block: BlockOf<'callout'> }) {
  const tone = {
    info: 'border-l-ring bg-accent/50',
    warning: 'border-l-changed bg-changed-soft/50',
    risk: 'border-l-removed bg-removed-soft/50',
    success: 'border-l-added bg-added-soft/50',
  }[block.tone]
  return (
    <div className={cn('rounded-md border-l-4 px-4 py-3', tone)}>
      <Markdown body={block.body} />
    </div>
  )
}

// A note field that saves on blur, so typing doesn't create a draft per keystroke.
function LazyText({
  value,
  onCommit,
  placeholder,
  multiline,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder: string
  multiline?: boolean
}) {
  const [v, setV] = React.useState(value)
  React.useEffect(() => setV(value), [value])
  const props = {
    value: v,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setV(e.target.value),
    onBlur: () => v !== value && onCommit(v),
  }
  return multiline ? <Textarea {...props} className="min-h-16" /> : <Input {...props} />
}

export function DecisionView({ block }: { block: BlockOf<'decision'> }) {
  const { state, choose } = useBoard()
  const current = state.choices.get(block.id)
  const [otherOpen, setOtherOpen] = React.useState(Boolean(current?.other))
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[15px] font-medium">{block.question}</p>
        {block.context && <Markdown className="mt-1 text-muted-foreground" body={block.context} />}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label={block.question}>
        {block.options.map((o) => {
          const selected = current?.option === o.id
          return (
            <div
              key={o.id}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={() => {
                setOtherOpen(false)
                choose(block.id, { option: o.id, note: current?.note })
              }}
              onKeyDown={(e) => {
                // Keys typed in the option's comment popover bubble here through
                // the portal; only a key pressed on the option itself selects it.
                if (e.target !== e.currentTarget) return
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  choose(block.id, { option: o.id, note: current?.note })
                }
              }}
              className={cn(
                'group relative flex cursor-pointer flex-col gap-2 rounded-lg border bg-background p-3.5 text-left transition-all outline-none hover:border-foreground/25 focus-visible:ring-[3px] focus-visible:ring-ring/40',
                selected && 'border-human bg-human-soft/40 ring-1 ring-human hover:border-human',
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                    selected && 'border-human bg-human text-white',
                  )}
                >
                  {selected && <Check className="size-3" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{o.label}</span>
                    {o.recommended && (
                      <Badge variant="secondary">
                        <Sparkles /> agent recommends
                      </Badge>
                    )}
                  </div>
                  {o.summary && <Markdown className="mt-1 text-muted-foreground" body={o.summary} />}
                </div>
                <ItemComment block={block.id} item={o.id} label={o.label} />
              </div>
              {(o.pros?.length || o.cons?.length) && (
                <ul className="ml-6.5 flex flex-col gap-1 text-[13px]">
                  {o.pros?.map((p) => (
                    <li key={p} className="flex gap-1.5">
                      <ThumbsUp className="mt-0.5 size-3.5 shrink-0 text-added" />
                      {p}
                    </li>
                  ))}
                  {o.cons?.map((c) => (
                    <li key={c} className="flex gap-1.5">
                      <ThumbsDown className="mt-0.5 size-3.5 shrink-0 text-removed" />
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
      {block.allowOther &&
        (otherOpen || current?.other ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Something else</span>
            <LazyText
              multiline
              value={current?.other ?? ''}
              placeholder="Describe what you'd rather do…"
              onCommit={(other) => choose(block.id, other.trim() ? { other, note: current?.note } : {})}
            />
          </div>
        ) : (
          <Button variant="link" size="sm" className="self-start px-0" onClick={() => setOtherOpen(true)}>
            None of these — suggest something else
          </Button>
        ))}
      {current && (current.option || current.other) && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Why, or any constraints (optional)</span>
            <Origin round={current.round} />
          </div>
          <LazyText
            value={current.note ?? ''}
            placeholder="e.g. we already run Postgres in prod"
            onCommit={(note) => choose(block.id, { option: current.option, other: current.other, note: note || undefined })}
          />
        </div>
      )}
    </div>
  )
}

export function QuestionView({ block }: { block: BlockOf<'question'> }) {
  const { state, answer } = useBoard()
  const current = state.answers.get(block.id)
  const [text, setText] = React.useState(current?.text ?? '')
  React.useEffect(() => setText(current?.text ?? ''), [current?.text])
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[15px] font-medium">{block.prompt}</p>
        {block.context && <Markdown className="mt-1 text-muted-foreground" body={block.context} />}
      </div>
      {block.suggestions && (
        <div className="flex flex-wrap gap-1.5">
          {block.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setText(s)
                answer(block.id, s)
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-[13px] transition-colors hover:bg-accent',
                current?.text === s && 'border-human bg-human-soft text-human',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <Textarea
        value={text}
        placeholder={block.placeholder ?? 'Your answer…'}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== (current?.text ?? '') && answer(block.id, text)}
      />
      {current && (
        <div className="-mt-1">
          <Origin round={current.round} />
        </div>
      )}
    </div>
  )
}

// Plans confirm assumptions; reports ask the human to check the work.
const verdicts = [
  { value: 'yes', label: { plan: 'Right', report: 'Works' }, icon: Check, on: 'border-added bg-added-soft text-added' },
  { value: 'no', label: { plan: 'Wrong', report: 'Doesn’t work' }, icon: X, on: 'border-removed bg-removed-soft text-removed' },
  {
    value: 'unsure',
    label: { plan: 'Not sure', report: 'Couldn’t check' },
    icon: CircleHelp,
    on: 'border-changed bg-changed-soft text-changed',
  },
] as const

export function ConfirmView({ block }: { block: BlockOf<'confirm'> }) {
  const { state, confirm, doc } = useBoard()
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {block.items.map((it) => {
        const c = state.confirms.get(key(block.id, it.id))
        return (
          <li key={it.id} className="group flex flex-col gap-2 px-3.5 py-3" data-quote-item={it.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm', c?.value === 'no' && 'text-muted-foreground line-through decoration-removed/60')}>
                  {it.text}
                </p>
                {it.detail && <Markdown className="mt-0.5 text-muted-foreground" body={it.detail} />}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {verdicts.map((v) => (
                  <button
                    key={v.value}
                    aria-pressed={c?.value === v.value}
                    onClick={() => confirm(block.id, it.id, v.value, c?.note)}
                    className={cn(
                      'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs transition-colors hover:bg-accent',
                      c?.value === v.value && v.on,
                    )}
                  >
                    <v.icon className="size-3.5" />
                    {v.label[doc.kind]}
                  </button>
                ))}
                <ItemComment block={block.id} item={it.id} label={it.text} />
              </div>
            </div>
            {c && c.value !== 'yes' && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <LazyText
                    value={c.note ?? ''}
                    placeholder={
                      doc.kind === 'report'
                        ? c.value === 'no'
                          ? 'What happened instead?'
                          : 'What got in the way?'
                        : c.value === 'no'
                          ? "What's actually true?"
                          : 'What would help you decide?'
                    }
                    onCommit={(note) => confirm(block.id, it.id, c.value, note || undefined)}
                  />
                </div>
                <Origin round={c.round} />
              </div>
            )}
            {c && c.value === 'yes' && <Origin round={c.round} />}
          </li>
        )
      })}
    </ul>
  )
}

export function TableView({ block }: { block: BlockOf<'table'> }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            {block.columns.map((c) => (
              <th key={c} className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground">
                {c}
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {block.rows.map((r, i) => {
            const row = Array.isArray(r) ? { id: `row-${i + 1}`, cells: r, highlight: false } : r
            return (
              <tr key={row.id} className={cn('group align-top', row.highlight && 'bg-human-soft/30')} data-quote-item={row.id}>
                {row.cells.map((cell, j) => (
                  <td key={j} className={cn('px-3 py-2.5', j === 0 && 'font-medium')}>
                    <Markdown body={cell} />
                  </td>
                ))}
                <td className="px-1 py-2">
                  <ItemComment block={block.id} item={row.id} label={row.cells[0] ?? row.id} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
