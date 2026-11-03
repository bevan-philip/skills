import * as React from 'react'
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleCheck,
  CornerDownRight,
  FlaskConical,
  Lock,
  Pencil,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Undo2,
} from 'lucide-react'
import type { BlockOf } from '@/lib/schema'
import { answered, askNumbers, choiceLabel, pendingReopen } from '@/lib/state'
import { useBoard } from '@/components/board/context'
import { Markdown } from '@/components/board/markdown'
import { AnswerText } from '@/components/board/answer'
import { ItemChange } from '@/components/board/block-frame'
import { ItemComment } from '@/components/board/threads'
import { Mark } from '@/components/board/marks'
import { ChoiceStatus, DecisionHistory, MetricsTable, Quote } from '@/components/blocks/basic'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

type Ask = BlockOf<'ask'>
type Option = Ask['options'][number]

// "Q3 · Session storage": asks are numbered in board order.
export function useAskLabel(block: Ask) {
  const { doc } = useBoard()
  return `Q${askNumbers(doc).get(block.id)} · ${block.title ?? 'Question'}`
}

// One question in a grilling round. The agent's recommended answer comes
// first, and "Yes" accepts it; the alternatives are a click each. Once the
// answer is sent the question folds to one line, so a long interview reads as
// a record of what was settled with the open questions below it.
export function AskView({ block }: { block: Ask }) {
  const { state, sent, view, choose } = useBoard()
  const before = sent.choices.get(block.id)
  const settled = Boolean(before && answered(before, block) && before.defer !== 'explore')
  // A draft change to a settled answer keeps the question open until it's
  // sent or undone.
  const drafting = state.choices.get(block.id)?.round === null
  const [changing, setChanging] = React.useState(false)
  React.useEffect(() => setChanging(false), [before?.id])
  const history = view.reopened[block.id] ?? []
  return (
    <div className="flex flex-col gap-3">
      <FollowsFrom block={block} />
      {settled && !changing && !drafting ? (
        <SettledAsk block={block} onChange={() => setChanging(true)} />
      ) : (
        <OpenAsk
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

// The branch this question hangs off: the earlier questions it builds on, with
// the answer each one has now.
function FollowsFrom({ block }: { block: Ask }) {
  const { doc, state } = useBoard()
  if (!block.after.length) return null
  const numbers = askNumbers(doc)
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <CornerDownRight className="size-3.5" />
      <span>Follows from</span>
      {block.after.map((id) => {
        const parent = doc.blocks.find((b) => b.id === id)
        const c = state.choices.get(id)
        const answer = parent?.type === 'ask' && answered(c, parent) ? choiceLabel(c!, parent) : 'not answered yet'
        return (
          <a key={id} href={`#b-${id}`} className="rounded-md border px-1.5 py-0.5 hover:bg-accent hover:text-foreground">
            <span className="font-medium text-foreground">Q{numbers.get(id)}</span> · {answer}
          </a>
        )
      })}
    </div>
  )
}

function Heading({ block, badge }: { block: Ask; badge?: React.ReactNode }) {
  return (
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
  )
}

// Why the agent would pick an option: its summary, what it found by trying
// it, and the trade-offs. Kept small; the question is the point.
function OptionDetail({ option: o, className }: { option: Option; className?: string }) {
  if (!o.summary && !o.evidence && !o.pros?.length && !o.cons?.length) return null
  return (
    <div className={cn('flex flex-col gap-1.5 text-[13px]', className)}>
      {o.summary && <Markdown className="text-muted-foreground" body={o.summary} />}
      {o.evidence && (
        <div className="flex gap-2 rounded-md bg-muted/70 px-2.5 py-2">
          <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">What I found</span>
            <Markdown body={o.evidence} />
          </div>
        </div>
      )}
      {(o.pros?.length || o.cons?.length) && (
        <ul className="flex flex-col gap-1">
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
}

function OpenAsk({ block, onKeep }: { block: Ask; onKeep?: () => void }) {
  const { state, sent, view, choose } = useBoard()
  const current = state.choices.get(block.id)
  const before = sent.choices.get(block.id)
  const explored = state.explored.get(block.id)
  const reopened = pendingReopen(block, view.reopened, sent)
  const rec = block.options.find((o) => o.recommended) ?? block.options[0]
  const alternatives = block.options.filter((o) => o !== rec)
  const [otherOpen, setOtherOpen] = React.useState(Boolean(current?.other))
  const [noteOpen, setNoteOpen] = React.useState(false)
  const yes = current?.option === rec.id
  const picked = alternatives.find((o) => o.id === current?.option)
  const pick = (c: { option?: string; defer?: 'explore' }) => {
    setOtherOpen(false)
    choose(block.id, { ...c, note: current?.note })
  }
  return (
    <>
      <Heading
        block={block}
        badge={
          reopened && (
            <Mark tone="changed">
              <RotateCcw /> reopened
            </Mark>
          )
        }
      />
      {block.context && <Markdown className="-mt-1 text-muted-foreground" body={block.context} />}
      {reopened && (
        <Alert className="border-changed/40 bg-changed-soft/30">
          <RotateCcw className="text-changed" />
          <AlertDescription className="text-foreground">
            <p>
              You answered <span className="font-medium">{reopened.answer}</span> in round {reopened.round}. The agent has
              changed this question since, so it needs a fresh answer.
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
            You asked the agent to find out first in round {explored.round}. What it found is below; answer now.
          </AlertDescription>
        </Alert>
      )}
      <div
        className={cn(
          'flex flex-col gap-2 rounded-lg border bg-background p-3.5 transition-all',
          yes && 'border-primary bg-human-soft/40 ring-1 ring-primary',
        )}
      >
        <div className="flex items-start gap-2.5">
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-human" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">I recommend</span>
              <ItemChange block={block.id} item={rec.id} />
            </div>
            <p className="font-medium">{rec.label}</p>
          </div>
          <ItemComment block={block.id} item={rec.id} label={rec.label} />
          <Button
            size="sm"
            variant={yes ? 'default' : 'outline'}
            aria-pressed={yes}
            onClick={() => (yes ? choose(block.id, {}) : pick({ option: rec.id }))}
          >
            <Check /> Yes
          </Button>
        </div>
        <OptionDetail option={rec} className="ml-6.5" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(alternatives.length > 0 || block.allowOther) && <span className="text-xs text-muted-foreground">Or</span>}
        {alternatives.length > 0 && (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={1}
            className="flex-wrap"
            value={picked?.id ?? ''}
            onValueChange={(v) => (v ? pick({ option: v }) : choose(block.id, {}))}
          >
            {alternatives.map((o) => (
              <ToggleGroupItem key={o.id} value={o.id} className="text-xs data-[state=on]:bg-human-soft data-[state=on]:text-human">
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        {block.allowOther && !otherOpen && !current?.other && (
          <Button variant="link" size="sm" className="px-0" onClick={() => setOtherOpen(true)}>
            something else…
          </Button>
        )}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className={cn('text-xs text-muted-foreground', current?.defer === 'explore' && 'bg-human-soft text-human')}
          aria-pressed={current?.defer === 'explore'}
          title="The agent looks into it (a spike, a measurement, a read of the code) and asks you again with what it found."
          onClick={() => (current?.defer === 'explore' ? choose(block.id, {}) : pick({ defer: 'explore' }))}
        >
          <FlaskConical /> Not sure — find out first
        </Button>
        {onKeep && (
          <Button variant="link" size="sm" className="px-0" onClick={onKeep}>
            Keep my answer
          </Button>
        )}
      </div>
      {picked && (
        <div className="flex items-start gap-1.5">
          <ItemChange block={block.id} item={picked.id} />
          <OptionDetail option={picked} className="flex-1 border-l-2 border-human pl-3" />
          <ItemComment block={block.id} item={picked.id} label={picked.label} />
        </div>
      )}
      <MetricsTable block={block} />
      {block.allowOther && (otherOpen || current?.other) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Your own answer</span>
          <AnswerText
            multiline
            label="your own answer"
            value={current?.other ?? ''}
            sent={before?.other ? { text: before.other, round: before.round! } : undefined}
            placeholder="What would you rather do?"
            onCommit={(other) => choose(block.id, other.trim() ? { other, note: current?.note } : {})}
          />
        </div>
      )}
      {current && answered(current, block) && !noteOpen && !current.note && current.defer !== 'explore' && (
        <Button variant="link" size="sm" className="self-start px-0 text-muted-foreground" onClick={() => setNoteOpen(true)}>
          Add a note
        </Button>
      )}
      {current && answered(current, block) && (noteOpen || current.note || current.defer === 'explore') && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {current.defer === 'explore' ? 'What should the agent find out?' : 'Anything to add? (optional)'}
          </span>
          <AnswerText
            label="note"
            value={current.note ?? ''}
            sent={before?.note ? { text: before.note, round: before.round! } : undefined}
            placeholder={current.defer === 'explore' ? 'e.g. how many callers each option touches' : 'e.g. but keep the old path for a release'}
            onCommit={(note) =>
              choose(block.id, { option: current.option, other: current.other, defer: current.defer, note: note || undefined })
            }
          />
        </div>
      )}
      <ChoiceStatus block={block} />
    </>
  )
}

// A sent answer: the question and what the human said, with the rest folded.
function SettledAsk({ block, onChange }: { block: Ask; onChange: () => void }) {
  const { sent } = useBoard()
  const c = sent.choices.get(block.id)!
  const option = block.options.find((o) => o.id === c.option)
  const others = block.options.filter((o) => o !== option)
  return (
    <>
      <Heading block={block} />
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-human-soft/30 px-3 py-2">
        <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="font-medium">{option ? option.label : choiceLabel(c, block)}</span>
        {option?.recommended && <span className="text-xs text-muted-foreground">(the recommendation)</span>}
        <span className="text-xs text-muted-foreground">· round {c.round}</span>
        <span className="flex-1" />
        <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={onChange}>
          <Pencil /> Change
        </Button>
      </div>
      {c.note && <Quote label="Your note" text={c.note} />}
      {(block.context || option || others.length > 0) && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="group -ml-2 self-start text-muted-foreground">
              <ChevronRight className="transition-transform group-data-[state=open]:rotate-90" />
              Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 flex flex-col gap-2.5">
            {block.context && <Markdown className="text-muted-foreground" body={block.context} />}
            {option && <OptionDetail option={option} />}
            {others.length > 0 && (
              <ul className="flex flex-col gap-2 text-[13px]">
                {others.map((o) => (
                  <li key={o.id} className="flex flex-col gap-1 rounded-md border px-3 py-2 opacity-80">
                    <span className="font-medium">
                      {o.label}
                      {o.recommended && <span className="ml-1.5 font-normal text-muted-foreground">(recommended)</span>}
                    </span>
                    <OptionDetail option={o} />
                  </li>
                ))}
              </ul>
            )}
            <MetricsTable block={block} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  )
}
