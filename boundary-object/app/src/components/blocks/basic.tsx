import * as React from 'react'
import {
  Bot,
  Check,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleHelp,
  FlaskConical,
  Hand,
  History,
  Lock,
  Pencil,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  X,
} from 'lucide-react'
import type { BlockOf, Reopened } from '@/lib/schema'
import { answered, choiceLabel, key, pendingReopen } from '@/lib/state'
import { useBoard } from '@/components/board/context'
import { Markdown } from '@/components/board/markdown'
import { AnswerText } from '@/components/board/answer'
import { ItemChange } from '@/components/board/block-frame'
import { ItemComment } from '@/components/board/threads'
import { Mark } from '@/components/board/marks'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

export function Origin({ round }: { round: number | null | undefined }) {
  if (round === undefined) return null
  return round === null ? (
    <Mark tone="human">draft</Mark>
  ) : (
    <span className="text-[11px] text-muted-foreground">sent in round {round}</span>
  )
}

export function MarkdownView({ block }: { block: BlockOf<'markdown'> }) {
  return <Markdown body={block.body} />
}

export function CalloutView({ block }: { block: BlockOf<'callout'> }) {
  const tone = {
    info: 'border-l-ring',
    warning: 'border-l-changed bg-changed-soft/50',
    risk: 'border-l-removed bg-removed-soft/50',
    success: 'border-l-added bg-added-soft/50',
  }[block.tone]
  return (
    <Alert className={cn('border-l-4', tone)}>
      <AlertDescription className="text-foreground">
        <Markdown body={block.body} />
      </AlertDescription>
    </Alert>
  )
}

// Where the human's choice stands: sent, or a draft that changes what was sent.
function ChoiceStatus({ block }: { block: BlockOf<'decision'> }) {
  const { state, sent } = useBoard()
  const current = state.choices.get(block.id)
  const before = sent.choices.get(block.id)
  const name = (c?: { option?: string; other?: string; defer?: string }) =>
    c?.other && !c.option && !c.defer ? 'your own answer' : choiceLabel(c ?? {}, block)
  if (!current) return null
  if (current.round !== null) {
    return answered(current, block) ? (
      <span className="text-[11px] text-muted-foreground">Sent in round {current.round}</span>
    ) : null
  }
  if (!answered(current)) {
    return before ? (
      <span className="text-[11px] text-muted-foreground">
        <Mark tone="human">draft</Mark> clears what you sent in round {before.round} ({name(before)})
      </span>
    ) : null
  }
  const same =
    before && answered(before) && before.option === current.option && before.other === current.other && before.defer === current.defer
  // Only the note changed: the choice itself still stands as sent.
  if (same) return <span className="text-[11px] text-muted-foreground">Sent in round {before.round}</span>
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Mark tone="human">draft</Mark>
      {before && answered(before) && `changes your round ${before.round} choice (${name(before)})`}
    </span>
  )
}

// Options side by side on whatever the agent measured, so the human compares
// results rather than predictions.
function MetricsTable({ block }: { block: BlockOf<'decision'> }) {
  const names = [...new Set(block.options.flatMap((o) => Object.keys(o.metrics ?? {})))]
  if (!names.length) return null
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead className="text-xs font-semibold text-muted-foreground">Measured</TableHead>
            {block.options.map((o) => (
              <TableHead key={o.id} className={cn('text-xs font-semibold', o.recommended ? 'text-foreground' : 'text-muted-foreground')}>
                {o.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {names.map((n) => (
            <TableRow key={n}>
              <TableCell className="whitespace-normal text-muted-foreground">{n}</TableCell>
              {block.options.map((o) => (
                <TableCell key={o.id} className={cn('font-mono text-[13px] tabular-nums', o.recommended && 'bg-human-soft/20')}>
                  {o.metrics?.[n] ?? '—'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DecisionHeading({ block, badge, context }: { block: BlockOf<'decision'>; badge?: React.ReactNode; context?: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[15px] font-medium">{block.question}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {block.reversible !== undefined &&
            (block.reversible ? (
              <Badge variant="outline">
                <Undo2 /> easy to change later
              </Badge>
            ) : (
              <Mark tone="changed">
                <Lock /> hard to undo
              </Mark>
            ))}
          {badge}
        </div>
      </div>
      {context && block.context && <Markdown className="mt-1 text-muted-foreground" body={block.context} />}
    </div>
  )
}

// One option's content. `lead` is the control (or mark) in front of the label.
function OptionBody({
  block,
  option: o,
  labelId,
  lead,
}: {
  block: BlockOf<'decision'>
  option: BlockOf<'decision'>['options'][number]
  labelId: string
  lead: React.ReactNode
}) {
  return (
    <>
      <div className="flex items-start gap-2.5">
        {lead}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span id={labelId} className="font-medium">
              {o.label}
            </span>
            <ItemChange block={block.id} item={o.id} />
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
      {o.evidence && (
        <div className="ml-6.5 flex gap-2 rounded-md bg-muted/70 px-2.5 py-2 text-[13px]">
          <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">What I found</span>
            <Markdown body={o.evidence} />
          </div>
        </div>
      )}
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
    </>
  )
}

function Quote({ label, text }: { label: string; text: string }) {
  return (
    <div className="border-l-2 border-human pl-3 text-[13px]">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  )
}

// An answered decision: what the human picked, with the other options folded
// away until they want to look again.
function SettledDecision({ block, onChange }: { block: BlockOf<'decision'>; onChange: () => void }) {
  const { sent } = useBoard()
  const c = sent.choices.get(block.id)!
  const pick =
    c.defer === 'delegate' ? block.options.find((o) => o.recommended) : block.options.find((o) => o.id === c.option)
  const others = block.options.filter((o) => o !== pick)
  return (
    <>
      <DecisionHeading
        block={block}
        badge={
          <Mark tone="added">
            <Check /> decided in round {c.round}
          </Mark>
        }
      />
      {c.defer === 'delegate' && (
        <p className="text-[13px] text-muted-foreground">
          You left this to the agent{pick ? '. It goes with its recommendation:' : '.'}
        </p>
      )}
      {pick && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary bg-human-soft/40 p-3.5 ring-1 ring-primary">
          <OptionBody
            block={block}
            option={pick}
            labelId={`opt-${block.id}-${pick.id}`}
            lead={<CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-label="your pick" />}
          />
        </div>
      )}
      {c.other && !c.option && <Quote label="Your own answer" text={c.other} />}
      {c.note && <Quote label="Your note" text={c.note} />}
      <Collapsible>
        <div className="flex flex-wrap items-center gap-2">
          {others.length > 0 && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="group -ml-2 text-muted-foreground">
                <ChevronRight className="transition-transform group-data-[state=open]:rotate-90" />
                {others.length} other option{others.length === 1 ? '' : 's'} considered
              </Button>
            </CollapsibleTrigger>
          )}
          <span className="flex-1" />
          <Button variant="outline" size="sm" onClick={onChange}>
            <Pencil /> Change answer
          </Button>
        </div>
        <CollapsibleContent className="mt-2 flex flex-col gap-2.5">
          {others.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 rounded-lg border bg-background p-3.5 opacity-80">
              <OptionBody
                block={block}
                option={o}
                labelId={`opt-${block.id}-${o.id}`}
                lead={<Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" aria-hidden />}
              />
            </div>
          ))}
          <MetricsTable block={block} />
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}

// The picker: an unanswered decision, one the agent reopened, or a settled one
// the human is changing (`onKeep` puts their sent answer back).
function OpenDecision({ block, onKeep }: { block: BlockOf<'decision'>; onKeep?: () => void }) {
  const { state, sent, view, choose } = useBoard()
  const current = state.choices.get(block.id)
  const before = sent.choices.get(block.id)
  const explored = state.explored.get(block.id)
  const reopened = pendingReopen(block, view.reopened, sent)
  const [otherOpen, setOtherOpen] = React.useState(Boolean(current?.other))
  const defer = current?.defer
  return (
    <>
      <DecisionHeading
        block={block}
        context
        badge={
          reopened && (
            <Mark tone="changed">
              <RotateCcw /> reopened
            </Mark>
          )
        }
      />
      {reopened && (
        <Alert className="border-changed/40 bg-changed-soft/30">
          <RotateCcw className="text-changed" />
          <AlertDescription className="text-foreground">
            <p>
              You picked <span className="font-medium">{reopened.answer}</span> in round {reopened.round}. The agent has
              changed this decision since, so it needs a fresh answer.
            </p>
            {reopened.reason && (
              <div className="mt-1.5 flex gap-2">
                <Bot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <Markdown body={reopened.reason} />
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
      {explored && !current && (
        <Alert className="border-primary/30 bg-human-soft/30">
          <FlaskConical className="text-primary" />
          <AlertDescription className="text-foreground">
            You asked the agent to find out first in round {explored.round}. What it found is on the options below; pick one now.
          </AlertDescription>
        </Alert>
      )}
      <RadioGroup
        className="grid gap-2.5 sm:grid-cols-2"
        aria-label={block.question}
        value={current?.option ?? ''}
        onValueChange={(option) => {
          setOtherOpen(false)
          choose(block.id, { option, note: current?.note })
        }}
      >
        {block.options.map((o) => {
          const selected = current?.option === o.id
          const labelId = `opt-${block.id}-${o.id}`
          return (
            <div
              key={o.id}
              // The whole card picks the option; the radio inside is the
              // keyboard control.
              onClick={() => {
                if (selected) return
                setOtherOpen(false)
                choose(block.id, { option: o.id, note: current?.note })
              }}
              className={cn(
                'group relative flex cursor-pointer flex-col gap-2 rounded-lg border bg-background p-3.5 text-left transition-all hover:border-foreground/25 has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                selected && 'border-primary bg-human-soft/40 ring-1 ring-primary hover:border-primary',
              )}
            >
              <OptionBody
                block={block}
                option={o}
                labelId={labelId}
                lead={
                  <RadioGroupItem value={o.id} aria-labelledby={labelId} className="mt-0.5" onClick={(e) => e.stopPropagation()} />
                }
              />
            </div>
          )
        })}
      </RadioGroup>
      <MetricsTable block={block} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Not ready to pick?</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={1}
          value={defer ?? ''}
          onValueChange={(v) => {
            setOtherOpen(false)
            choose(block.id, v ? { defer: v as 'explore' | 'delegate', note: current?.note } : {})
          }}
        >
          <ToggleGroupItem
            value="explore"
            className="text-xs data-[state=on]:bg-human-soft data-[state=on]:text-human"
            title="The agent tries the options for real (a spike, a prototype, a measurement) and asks you again with what it found."
          >
            <FlaskConical /> Find out first
          </ToggleGroupItem>
          <ToggleGroupItem
            value="delegate"
            className="text-xs data-[state=on]:bg-human-soft data-[state=on]:text-human"
            title="You don't mind either way; the agent decides."
          >
            <Hand /> Your call
          </ToggleGroupItem>
        </ToggleGroup>
        {onKeep && (
          <Button variant="link" size="sm" className="ml-auto px-0" onClick={onKeep}>
            Keep my answer
          </Button>
        )}
      </div>
      <ChoiceStatus block={block} />
      {block.allowOther &&
        (otherOpen || current?.other ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Something else</span>
            <AnswerText
              multiline
              label="your own answer"
              value={current?.other ?? ''}
              sent={before?.other ? { text: before.other, round: before.round! } : undefined}
              placeholder="Describe what you'd rather do…"
              onCommit={(other) => choose(block.id, other.trim() ? { other, note: current?.note } : {})}
            />
          </div>
        ) : (
          <Button variant="link" size="sm" className="self-start px-0" onClick={() => setOtherOpen(true)}>
            None of these — suggest something else
          </Button>
        ))}
      {current && answered(current, block) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {defer === 'explore' ? 'What should the agent find out?' : 'Why, or anything to change about it (optional)'}
          </span>
          <AnswerText
            label="note"
            value={current.note ?? ''}
            sent={before?.note ? { text: before.note, round: before.round! } : undefined}
            placeholder={defer === 'explore' ? 'e.g. how many call sites each one touches, and the p95 latency' : 'e.g. we already run Postgres in prod'}
            onCommit={(note) =>
              choose(block.id, { option: current.option, other: current.other, defer: current.defer, note: note || undefined })
            }
          />
        </div>
      )}
    </>
  )
}

// Answers the agent made obsolete by changing the decision, one line each.
function DecisionHistory({ entries }: { entries: Reopened[] }) {
  return (
    <ul className="flex flex-col gap-1 border-t pt-2.5">
      {entries.map((r) => (
        <Collapsible key={r.item} asChild>
          <li>
            <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-sm text-left text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
              <History className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate line-through decoration-muted-foreground/60">{r.answer}</span>
              <span className="shrink-0">· decided in round {r.round} · reopened by the agent</span>
              <ChevronRight className="ml-auto size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1.5 mb-1 ml-5.5 flex flex-col gap-1.5">
              {r.note && <Quote label="Your note" text={r.note} />}
              <div className="flex gap-2 text-[13px]">
                <Bot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                {r.reason ? <Markdown body={r.reason} /> : <span className="text-muted-foreground">No reason given.</span>}
              </div>
            </CollapsibleContent>
          </li>
        </Collapsible>
      ))}
    </ul>
  )
}

export function DecisionView({ block }: { block: BlockOf<'decision'> }) {
  const { state, sent, view, choose } = useBoard()
  const before = sent.choices.get(block.id)
  const settled = Boolean(before && answered(before, block) && before.defer !== 'explore')
  // A draft change to a settled answer keeps the picker open until it's sent
  // or undone.
  const drafting = state.choices.get(block.id)?.round === null
  const [changing, setChanging] = React.useState(false)
  React.useEffect(() => setChanging(false), [before?.id])
  const history = view.reopened[block.id] ?? []
  return (
    <div className="flex flex-col gap-3">
      {settled && !changing && !drafting ? (
        <SettledDecision block={block} onChange={() => setChanging(true)} />
      ) : (
        <OpenDecision
          block={block}
          onKeep={
            settled && before
              ? () => {
                  choose(block.id, { option: before.option, other: before.other, defer: before.defer, note: before.note })
                  setChanging(false)
                }
              : undefined
          }
        />
      )}
      {history.length > 0 && <DecisionHistory entries={history} />}
    </div>
  )
}

export function QuestionView({ block }: { block: BlockOf<'question'> }) {
  const { state, sent, answer } = useBoard()
  const current = state.answers.get(block.id)
  const before = sent.answers.get(block.id)
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[15px] font-medium">{block.prompt}</p>
        {block.context && <Markdown className="mt-1 text-muted-foreground" body={block.context} />}
      </div>
      {block.suggestions && (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="flex-wrap"
          value={block.suggestions.includes(current?.text ?? '') ? current!.text : ''}
          onValueChange={(s) => s && answer(block.id, s)}
        >
          {block.suggestions.map((s) => (
            <ToggleGroupItem key={s} value={s} className="data-[state=on]:bg-human-soft data-[state=on]:text-human">
              {s}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <AnswerText
        multiline
        value={current?.text ?? ''}
        sent={before?.text ? { text: before.text, round: before.round! } : undefined}
        placeholder={block.placeholder ?? 'Your answer…'}
        onCommit={(text) => answer(block.id, text)}
      />
    </div>
  )
}

// Plans confirm assumptions; reports ask the human to check the work.
const verdicts = [
  { value: 'yes', label: { plan: 'Right', report: 'Works' }, icon: Check, on: 'data-[state=on]:bg-added-soft data-[state=on]:text-added' },
  { value: 'no', label: { plan: 'Wrong', report: 'Doesn’t work' }, icon: X, on: 'data-[state=on]:bg-removed-soft data-[state=on]:text-removed' },
  {
    value: 'unsure',
    label: { plan: 'Not sure', report: 'Couldn’t check' },
    icon: CircleHelp,
    on: 'data-[state=on]:bg-changed-soft data-[state=on]:text-changed',
  },
] as const

export function ConfirmView({ block }: { block: BlockOf<'confirm'> }) {
  const { state, sent, confirm, doc } = useBoard()
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {block.items.map((it) => {
        const c = state.confirms.get(key(block.id, it.id))
        const before = sent.confirms.get(key(block.id, it.id))
        return (
          <li key={it.id} className="group flex flex-col gap-2 px-3.5 py-3" data-quote-item={it.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className={cn(c?.value === 'no' && 'text-muted-foreground line-through decoration-removed/60')}>
                    {it.text}
                  </span>{' '}
                  <ItemChange block={block.id} item={it.id} />
                </p>
                {it.detail && <Markdown className="mt-0.5 text-muted-foreground" body={it.detail} />}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  spacing={1}
                  value={c?.value ?? ''}
                  onValueChange={(v) => v && confirm(block.id, it.id, v as (typeof verdicts)[number]['value'], c?.note)}
                >
                  {verdicts.map((v) => (
                    <ToggleGroupItem key={v.value} value={v.value} className={cn('text-xs', v.on)}>
                      <v.icon />
                      {v.label[doc.kind]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <ItemComment block={block.id} item={it.id} label={it.text} />
              </div>
            </div>
            {c && c.value !== 'yes' && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <AnswerText
                    label="note"
                    value={c.note ?? ''}
                    sent={before?.note ? { text: before.note, round: before.round! } : undefined}
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
    <div className="rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/60">
          <TableRow>
            {block.columns.map((c) => (
              <TableHead key={c} className="text-xs font-semibold text-muted-foreground">
                {c}
              </TableHead>
            ))}
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {block.rows.map((r, i) => {
            const row = Array.isArray(r) ? { id: `row-${i + 1}`, cells: r, highlight: false } : r
            return (
              <TableRow key={row.id} className={cn('group align-top', row.highlight && 'bg-human-soft/30')} data-quote-item={row.id}>
                {row.cells.map((cell, j) => (
                  <TableCell key={j} className={cn('py-2.5 whitespace-normal', j === 0 && 'font-medium')}>
                    <Markdown body={cell} />
                    {j === 0 && <ItemChange block={block.id} item={row.id} />}
                  </TableCell>
                ))}
                <TableCell className="px-1">
                  <ItemComment block={block.id} item={row.id} label={row.cells[0] ?? row.id} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
