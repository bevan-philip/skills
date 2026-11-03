import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeftRight, Bot, Check, CheckCircle2, CircleDot, Loader2, MessageSquare, Send } from 'lucide-react'
import { Mark, type Tone } from '@/components/board/marks'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { INTERVIEW_OPEN, STALE_REVISION, type Board, type BlockOf, type BoardView, type FeedbackItem, type Verdict } from '@/lib/schema'
import { answered, askNumbers, isChoiceBlock, openAsks, shownByAsks, threadsFor } from '@/lib/state'
import { BoardProvider, useBoard } from '@/components/board/context'
import { BlockView } from '@/components/board/blocks'
import { Markdown } from '@/components/board/markdown'
import { SelectionCommenter } from '@/components/board/selection'
import { BlockThreads } from '@/components/board/threads'
import { ThemeToggle } from '@/components/board/theme'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function BoardMissing({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
      <Card className="gap-2 px-6">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4 text-removed" /> This board can't be shown yet
        </div>
        <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">{message}</pre>
        <p className="text-sm text-muted-foreground">The page refreshes by itself once the agent fixes it.</p>
      </Card>
      <Link to="/" className="text-sm text-human hover:underline">
        ← All boards
      </Link>
    </div>
  )
}

export function BoardPage({ view, onSubmitted }: { view: BoardView & { doc: Board }; onSubmitted: () => void }) {
  return (
    <BoardProvider view={view} onSubmitted={onSubmitted}>
      <Shell />
    </BoardProvider>
  )
}

function Presence() {
  const { view } = useBoard()
  const last = view.feedback.rounds.at(-1)
  const working = last?.deliveredAt && view.revision <= last.revision && last.verdict !== 'approve'
  const label = view.listening
    ? 'Agent is listening'
    : last && !last.deliveredAt
      ? `Agent hasn’t picked up round ${last.n}`
      : working
        ? `Agent is working on round ${last.n}`
        : 'Agent not listening'
  const tip = view.listening
    ? 'The agent is waiting on this board right now. Sending wakes it up immediately.'
    : working
      ? 'The agent has your feedback. The board updates by itself when it revises.'
      : 'The agent is not waiting right now. Anything you send is saved and handed over the next time it checks.'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="hidden items-center gap-2 rounded-full border px-2.5 py-1 text-xs text-muted-foreground md:flex">
          <span className="relative flex size-2">
            {view.listening && <span className="absolute inline-flex size-full animate-ping rounded-full bg-added opacity-60" />}
            <span className={cn('relative inline-flex size-2 rounded-full', view.listening ? 'bg-added' : 'bg-muted-foreground/40')} />
          </span>
          {label}
        </div>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}

function Header({ onSend, grilling, ready }: { onSend: () => void; grilling: boolean; ready: boolean }) {
  const { doc, view, draft, saving } = useBoard()
  const count = draft.items.length
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center gap-3 px-4 xl:px-6">
        <Link to="/" className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground" aria-label="All boards">
          <ArrowLeftRight className="size-4" />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{doc.title}</span>
          <Badge variant="outline">{doc.kind === 'plan' ? 'Plan' : 'Report'}</Badge>
          <span className="hidden text-xs text-muted-foreground sm:inline">rev {view.revision}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Presence />
          <span className="hidden w-14 text-right text-[11px] text-muted-foreground sm:block">{saving ? 'saving…' : count ? 'saved' : ''}</span>
          <ThemeToggle />
          <Button variant={count ? 'default' : 'outline'} size="sm" onClick={onSend} disabled={grilling && !ready}>
            <Send />
            {grilling ? 'Send answers' : 'Send to agent'}
            {count > 0 && <span className="rounded bg-primary-foreground/20 px-1.5 text-[11px] tabular-nums">{count}</span>}
          </Button>
        </div>
      </div>
    </header>
  )
}

function Outline({ asks }: { asks: Set<string> }) {
  const { doc, state, changes } = useBoard()
  const numbers = askNumbers(doc)
  const shown = shownByAsks(doc)
  return (
    <nav className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 xl:block">
      <div className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">On this board</div>
      <ul className="flex flex-col gap-0.5 text-[13px]">
        {doc.blocks.map((b) => {
          if (shown.has(b.id)) return null
          const comments = threadsFor(state, b.id).length
          if (b.type === 'section') {
            return (
              <li key={b.id} className="mt-3 first:mt-0">
                <a href={`#b-${b.id}`} className="block px-2 py-1 text-xs font-semibold text-foreground">
                  {b.title}
                </a>
              </li>
            )
          }
          return (
            <li key={b.id}>
              <a
                href={`#b-${b.id}`}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    asks.has(b.id) ? 'bg-human' : changes[b.id] ? 'bg-changed' : 'bg-transparent',
                  )}
                />
                <span className="truncate">{b.type === 'ask' ? `Q${numbers.get(b.id)} · ${b.title ?? b.question}` : (b.title ?? b.type)}</span>
                {comments > 0 && (
                  <span className="ml-auto flex items-center gap-0.5 text-[11px] text-human">
                    <MessageSquare className="size-3" />
                    {comments}
                  </span>
                )}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function Chip({ href, children, tone }: { href?: string; children: React.ReactNode; tone: Tone }) {
  const c = cn('font-normal', tone === 'removed' && 'line-through decoration-removed/60', href && 'hover:brightness-95')
  return href ? (
    <Mark tone={tone} className={c} asChild>
      <a href={href}>{children}</a>
    </Mark>
  ) : (
    <Mark tone={tone} className={c}>
      {children}
    </Mark>
  )
}

// What happened since the human's last round: whether the agent has it, and
// what it changed, each linking to the place on the board.
function LastRound() {
  const { view, doc, diff } = useBoard()
  const last = view.feedback.rounds.at(-1)
  if (!last) return null
  const verdict = { approve: 'approved', changes: 'asked for changes', comment: 'sent comments', answer: 'answered' }[last.verdict]
  const title = (id: string) => doc.blocks.find((b) => b.id === id)?.title ?? id
  const updated = Object.keys(diff.blocks).filter((id) => diff.blocks[id] === 'changed')
  const added = Object.keys(diff.blocks).filter((id) => diff.blocks[id] === 'new')
  const comments = view.feedback.rounds.flatMap((r) => r.items).filter((i) => i.type === 'comment')
  const replied = diff.newReplies.flatMap((id) => {
    const c = comments.find((x) => x.id === id)
    return c && c.type === 'comment' ? [{ id, thread: c.replyTo ?? c.id, on: c.target.block === 'summary' ? 'the summary' : title(c.target.block) }] : []
  })
  const anything = updated.length + added.length + diff.removedBlocks.length + replied.length > 0
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card px-3.5 py-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <CircleDot className="size-3.5 text-human" />
        <span>
          Round {last.n}: you {verdict} at {new Date(last.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
        </span>
        {last.deliveredAt ? (
          <span className="flex items-center gap-1 text-added">
            <Check className="size-3.5" /> Agent received it
          </span>
        ) : (
          <span className="text-muted-foreground">Waiting for the agent to pick it up.</span>
        )}
      </div>
      {anything && (
        <div className="flex flex-col gap-1.5 border-t pt-2.5">
          <span className="font-medium">Since then the agent has</span>
          {replied.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">replied on</span>
              {replied.map((r) => (
                <Chip key={r.id} href={`#c-${r.thread}`} tone="human">
                  {r.on}
                </Chip>
              ))}
            </div>
          )}
          {updated.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">updated</span>
              {updated.map((id) => (
                <Chip key={id} href={`#b-${id}`} tone="changed">
                  {title(id)}
                </Chip>
              ))}
            </div>
          )}
          {added.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">added</span>
              {added.map((id) => (
                <Chip key={id} href={`#b-${id}`} tone="added">
                  {title(id)}
                </Chip>
              ))}
            </div>
          )}
          {diff.removedBlocks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">removed</span>
              {diff.removedBlocks.map((b) => (
                <Chip key={b.id} tone="removed">
                  {b.title}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}
      {last.verdict !== 'approve' && (
        <p className="text-muted-foreground">
          You're drafting round {last.n + 1}. Anything you already sent shows as sent; change it or add to it, then send again.
        </p>
      )}
    </div>
  )
}

function Hero({ asks, grilling }: { asks: string[]; grilling: boolean }) {
  const { doc, view } = useBoard()
  const numbers = askNumbers(doc)
  const label = grilling ? 'Questions before the plan' : doc.kind === 'plan' ? 'Plan for your review' : 'Implementation report'
  return (
    <section className="flex flex-col gap-5 pt-4">
      <div className="flex flex-col gap-3" data-quote-block="summary">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{doc.title}</h1>
        {doc.summary && <Markdown large className="text-foreground/90" body={doc.summary} />}
      </div>
      <BlockThreads block="summary" />
      {view.error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>The agent's latest update has an error, so you're seeing the previous version.</AlertTitle>
          <AlertDescription>
            <pre className="font-mono text-xs whitespace-pre-wrap">{view.error}</pre>
          </AlertDescription>
        </Alert>
      )}
      {doc.status && (
        <Alert className="bg-muted/70">
          <Bot />
          <AlertDescription className="text-foreground">{doc.status}</AlertDescription>
        </Alert>
      )}
      <LastRound />
      {asks.length > 0 && !grilling && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-human">The agent needs you on:</span>
          {asks.map((id) => {
            const b = doc.blocks.find((x) => x.id === id)
            return (
              <Chip key={id} href={`#b-${id}`} tone="human">
                {b?.type === 'ask' ? `Q${numbers.get(id)} · ${b.title ?? b.question}` : (b?.title ?? id)}
              </Chip>
            )
          })}
        </div>
      )}
    </section>
  )
}

function describe(doc: Board, it: FeedbackItem): string {
  const blk = (id: string) => doc.blocks.find((b) => b.id === id)
  const title = (id: string) => blk(id)?.title ?? id
  switch (it.type) {
    case 'comment':
      return `${it.replyTo ? 'Reply' : 'Comment'} on ${it.target.label ?? title(it.target.block)}: “${it.text}”`
    case 'choice': {
      const b = blk(it.block)
      const opt = isChoiceBlock(b) ? b.options.find((o) => o.id === it.option)?.label : undefined
      if (it.defer) return `${title(it.block)}: ${it.defer === 'explore' ? 'find out first' : 'your call'}`
      return `${title(it.block)}: ${opt ?? (it.other ? `“${it.other}”` : 'cleared')}`
    }
    case 'answer':
      return `${title(it.block)}: “${it.text}”`
    case 'confirm': {
      const b = blk(it.block)
      const text = b?.type === 'confirm' ? b.items.find((x) => x.id === it.item)?.text : it.item
      const words =
        doc.kind === 'report'
          ? { yes: 'works', no: 'doesn’t work', unsure: 'couldn’t check' }
          : { yes: 'right', no: 'wrong', unsure: 'not sure' }
      return `“${text}” — ${words[it.value]}`
    }
    case 'step-strike': {
      const b = blk(it.block)
      const step = b?.type === 'steps' ? b.items.find((x) => x.id === it.item)?.title : undefined
      return `${it.struck ? 'Remove' : 'Keep'} step “${step ?? it.item}”`
    }
    case 'step-edit':
      return `Rename step to “${it.title}”`
    case 'step-add':
      return `Add step “${it.title}”`
    case 'step-order':
      return `Reorder ${title(it.block)}`
    case 'tune': {
      const n = Object.keys(it.values).length
      return n ? `Tune ${title(it.block)}: ${n} value${n === 1 ? '' : 's'}` : `Reset ${title(it.block)} to the agent's values`
    }
  }
}

function SendDialog({
  open,
  onOpenChange,
  asks,
  thinking,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  asks: string[]
  // The interview is still going (questions open, or the agent working
  // through answers): there is no plan to approve yet, so only comments and
  // change requests can go.
  thinking: boolean
}) {
  const { doc, draft, submit, view } = useBoard()
  const [picked, setVerdict] = React.useState<Verdict | null>(null)
  const [overall, setOverall] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [failure, setFailure] = React.useState<string | null>(null)
  const choices: { value: Verdict; title: string; body: string }[] =
    doc.kind === 'plan'
      ? [
          { value: 'approve', title: 'Approve the plan', body: 'The agent starts building, applying your edits and answers.' },
          { value: 'changes', title: 'Request changes', body: 'The agent revises the plan and comes back before building.' },
          { value: 'comment', title: 'Just comments', body: 'Answers and questions only; no verdict yet.' },
        ]
      : [
          { value: 'approve', title: 'Accept the work', body: 'You are happy with it. The agent wraps up.' },
          { value: 'changes', title: 'Request changes', body: 'The agent fixes what you flagged and reports back.' },
          { value: 'comment', title: 'Just comments', body: 'Questions only; no verdict yet.' },
        ]
  const options = thinking ? choices.filter((o) => o.value !== 'approve') : choices
  const verdict = picked && options.some((o) => o.value === picked) ? picked : null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Send to the agent</DialogTitle>
          <DialogDescription>
            {view.listening
              ? 'The agent is listening and will pick this up straight away.'
              : 'The agent is not listening right now. This is saved and delivered when it next checks.'}
          </DialogDescription>
        </DialogHeader>
        {draft.items.length > 0 ? (
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border bg-background p-3 text-[13px]">
            {draft.items.map((it) => (
              <div key={it.id} className="flex gap-2">
                <span className="text-human">•</span>
                <span className="line-clamp-2">{describe(doc, it)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No individual comments or edits — you can still send a verdict.</p>
        )}
        {thinking && (
          <p className="text-[13px] text-muted-foreground">
            The agent is still asking questions or working through your answers, so there is no plan to approve yet.
            Approval opens once it has written one.
          </p>
        )}
        {asks.length > 0 && (
          <Alert className="bg-changed-soft/50">
            <AlertTriangle className="text-changed" />
            <AlertDescription className="text-foreground">
              Still unanswered: {asks.map((id) => doc.blocks.find((b) => b.id === id)?.title ?? id).join(', ')}. If you approve, the
              agent goes with its recommendation.
            </AlertDescription>
          </Alert>
        )}
        <RadioGroup value={verdict ?? ''} onValueChange={(v) => setVerdict(v as Verdict)}>
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/60',
                verdict === o.value && 'border-primary bg-human-soft/40 ring-1 ring-primary',
              )}
            >
              <RadioGroupItem value={o.value} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">{o.title}</span>
                <span className="block text-[13px] text-muted-foreground">{o.body}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
        <Textarea placeholder="Anything else the agent should know? (optional)" value={overall} onChange={(e) => setOverall(e.target.value)} />
        {failure && <p className="text-[13px] text-removed">{failure}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep editing
          </Button>
          <Button
            disabled={!verdict || sending}
            onClick={async () => {
              if (!verdict) return
              setSending(true)
              try {
                setFailure(null)
                await submit(verdict, overall)
                setOverall('')
                setVerdict(null)
                onOpenChange(false)
              } catch (e) {
                setFailure(
                  e instanceof Error && e.message.includes(INTERVIEW_OPEN)
                    ? 'The agent is still asking questions or working through your answers, so there is no plan to approve yet. Nothing was sent.'
                    : e instanceof Error && e.message.includes(STALE_REVISION)
                    ? 'The agent changed the board while you were reviewing it, so nothing was sent. Look over the blocks marked updated or new, then approve again.'
                    : 'Couldn’t reach the board server, so nothing was sent. Your feedback is still here as a draft; try again.',
                )
              } finally {
                setSending(false)
              }
            }}
          >
            <Send /> {sending ? 'Sending…' : `Send round ${(view.feedback.rounds.at(-1)?.n ?? 0) + 1}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The asks still waiting on the human: no answer sent yet, or one the agent
// has since reopened. While there are any, the board is grilling: answers go
// back in a light round with no verdict, and approval waits for the plan.
function usePendingAsks() {
  const { doc, sent } = useBoard()
  return doc.blocks.filter((b): b is BlockOf<'ask'> => b.type === 'ask' && !answered(sent.choices.get(b.id), b))
}

// Sends a grilling round with the bar's note. The note lives here rather than
// in the bar, so the header's button sends it too and it outlives the bar.
function useSendAnswers() {
  const { submit, draft } = useBoard()
  const [sending, setSending] = React.useState(false)
  const [failure, setFailure] = React.useState<string | null>(null)
  const [note, setNote] = React.useState('')
  const ready = draft.items.length > 0 || note.trim().length > 0
  const send = async () => {
    if (sending || !ready) return
    setSending(true)
    setFailure(null)
    try {
      await submit('answer', note)
      setNote('')
    } catch {
      setFailure('Couldn’t reach the board server, so nothing was sent. Your answers are still here; try again.')
    } finally {
      setSending(false)
    }
  }
  return { send, sending, failure, note, setNote, ready }
}

// A grilling round in one click: how many of the open questions have an
// answer, and a button that sends them. Unanswered ones stay open for later.
function RoundBar({ pending, answers }: { pending: ReturnType<typeof usePendingAsks>; answers: ReturnType<typeof useSendAnswers> }) {
  const { doc, state, view } = useBoard()
  const { note, setNote, ready } = answers
  const numbers = askNumbers(doc)
  const done = pending.filter((b) => answered(state.choices.get(b.id), b)).length
  const go = answers.send
  const goRef = React.useRef(go)
  goRef.current = go
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Inside a text field the same keys belong to it (a comment box posts its
      // comment, and an answer only counts once its field loses focus).
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || (e.target as HTMLElement)?.closest('input, textarea')) return
      e.preventDefault()
      void goRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const round = (view.feedback.rounds.at(-1)?.n ?? 0) + 1
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-[820px] flex-col gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm font-medium">
            {done} of {pending.length} answered
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {pending.map((b) => {
              const ok = answered(state.choices.get(b.id), b)
              return (
                <a
                  key={b.id}
                  href={`#b-${b.id}`}
                  title={b.question}
                  className={cn(
                    'rounded-md border px-1.5 py-0.5 text-[11px] font-medium tabular-nums hover:bg-accent',
                    ok ? 'border-primary bg-human-soft text-human' : 'text-muted-foreground',
                  )}
                >
                  {ok && <Check className="-mt-px mr-0.5 inline size-3" />}Q{numbers.get(b.id)}
                </a>
              )
            })}
          </div>
          <Input
            className="h-8 min-w-40 flex-1 text-[13px]"
            placeholder="Anything else? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void go()
            }}
          />
          <Button size="sm" disabled={!ready || answers.sending} onClick={go}>
            {answers.sending ? <Loader2 className="animate-spin" /> : <Send />}
            {done < pending.length && done > 0 ? `Send ${done}, keep ${pending.length - done} open` : `Send round ${round}`}
            <KbdGroup className="ml-1 hidden opacity-70 sm:inline-flex">
              <Kbd className="bg-primary-foreground/15 text-primary-foreground">⌘/Ctrl</Kbd>
              <Kbd className="bg-primary-foreground/15 text-primary-foreground">Enter</Kbd>
            </KbdGroup>
          </Button>
        </div>
        {answers.failure && <p className="text-[13px] text-removed">{answers.failure}</p>}
      </div>
    </div>
  )
}

function Shell() {
  const { doc, state, view } = useBoard()
  const [sending, setSending] = React.useState(false)
  const asks = openAsks(doc, state)
  const askSet = new Set(asks)
  const shown = shownByAsks(doc)
  const last = view.feedback.rounds.at(-1)
  const pending = usePendingAsks()
  const grilling = pending.length > 0
  const answers = useSendAnswers()
  // Answers sent and the agent hasn't revised since: its next round is coming.
  // Any answer round counts, not just the last one, so a comment sent while
  // waiting doesn't open approval of a board with no plan on it.
  const thinking = !grilling && view.feedback.rounds.some((r) => r.verdict === 'answer' && view.revision <= r.revision)
  return (
    <div className={cn('min-h-screen', grilling ? 'pb-40' : 'pb-24')}>
      <Header grilling={grilling} ready={answers.ready} onSend={() => (grilling ? void answers.send() : setSending(true))} />
      {/* The outline sits at the far left; the middle column takes the rest of
          the width and centres the content in it, so wide cards grow into free
          space rather than over the outline. */}
      <div className="grid gap-10 px-4 xl:grid-cols-[220px_minmax(0,1fr)_220px] xl:px-6">
        <Outline asks={askSet} />
        <main className="flex min-w-0 flex-col gap-5 pt-6 wrap-anywhere *:mx-auto *:w-full *:max-w-[820px] [&_button]:wrap-normal [&_table]:wrap-normal">
          <Hero asks={asks} grilling={grilling} />
          {doc.blocks.map((b) => (shown.has(b.id) ? null : <BlockView key={b.id} block={b} needsInput={askSet.has(b.id)} />))}
          {!grilling && (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
            {thinking ? (
              <>
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  The agent is working through your answers. Its next questions, or the plan once nothing is left to ask, appear
                  here by themselves.
                </p>
              </>
            ) : last?.verdict === 'approve' && view.revision <= last.revision ? (
              <>
                <CheckCircle2 className="size-6 text-added" />
                <p className="text-sm text-muted-foreground">You approved this. The agent takes it from here.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Done reviewing? Send your comments and a verdict to the agent.</p>
                <Button onClick={() => setSending(true)}>
                  <Send /> Send to agent
                </Button>
              </>
            )}
          </div>
          )}
        </main>
        <div className="hidden xl:block" />
      </div>
      <SelectionCommenter />
      {grilling && <RoundBar pending={pending} answers={answers} />}
      <SendDialog
        open={sending}
        onOpenChange={setSending}
        asks={asks}
        // An ask left unanswered, the draft included, keeps the interview open.
        thinking={thinking || grilling || asks.some((id) => doc.blocks.find((b) => b.id === id)?.type === 'ask')}
      />
    </div>
  )
}
