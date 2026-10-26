import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeftRight, Bot, Check, CheckCircle2, CircleDot, MessageSquare, Send } from 'lucide-react'
import type { Board, BoardView, FeedbackItem, Verdict } from '@/lib/schema'
import { openAsks, threadsFor } from '@/lib/state'
import { BoardProvider, useBoard } from '@/components/board/context'
import { BlockView } from '@/components/board/blocks'
import { Markdown } from '@/components/board/markdown'
import { SelectionCommenter } from '@/components/board/selection'
import { BlockThreads } from '@/components/board/threads'
import { ThemeToggle } from '@/components/board/theme'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
      <Card className="gap-2 p-6">
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

function Header({ onSend }: { onSend: () => void }) {
  const { doc, view, draft, saving } = useBoard()
  const count = draft.items.length
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
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
          <Button variant={count ? 'human' : 'outline'} size="sm" onClick={onSend}>
            <Send />
            Send to agent
            {count > 0 && <span className="rounded bg-white/20 px-1.5 text-[11px] tabular-nums">{count}</span>}
          </Button>
        </div>
      </div>
    </header>
  )
}

function Outline({ asks }: { asks: Set<string> }) {
  const { doc, state, changes } = useBoard()
  return (
    <nav className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 xl:block">
      <div className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">On this board</div>
      <ul className="flex flex-col gap-0.5 text-[13px]">
        {doc.blocks.map((b) => {
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
                <span className="truncate">{b.title ?? b.type}</span>
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

function LastRound() {
  const { view } = useBoard()
  const last = view.feedback.rounds.at(-1)
  if (!last) return null
  const verdict = { approve: 'approved', changes: 'asked for changes', comment: 'sent comments' }[last.verdict]
  const revised = view.revision > last.revision
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-card px-3.5 py-2.5 text-[13px]">
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
      {revised && (
        <span className="text-muted-foreground">
          It has since revised the board — look for <Badge variant="changed">updated</Badge> and <Badge variant="added">new</Badge>.
        </span>
      )}
    </div>
  )
}

function Hero({ asks }: { asks: string[] }) {
  const { doc, view } = useBoard()
  const label = doc.kind === 'plan' ? 'Plan for your review' : 'Implementation report'
  return (
    <section className="flex flex-col gap-5 pt-4">
      <div className="flex flex-col gap-3" data-quote-block="summary">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{doc.title}</h1>
        {doc.summary && <Markdown large className="text-foreground/90" body={doc.summary} />}
      </div>
      <BlockThreads block="summary" />
      {view.error && (
        <div className="flex gap-2.5 rounded-lg border border-removed/40 bg-removed-soft/40 p-3.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-removed" />
          <div>
            <div className="font-medium">The agent's latest update has an error, so you're seeing the previous version.</div>
            <pre className="mt-1 font-mono text-xs whitespace-pre-wrap text-muted-foreground">{view.error}</pre>
          </div>
        </div>
      )}
      {doc.status && (
        <div className="flex items-start gap-2.5 rounded-lg bg-muted/70 px-3.5 py-2.5 text-sm">
          <Bot className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{doc.status}</span>
        </div>
      )}
      <LastRound />
      {asks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-human">The agent needs you on:</span>
          {asks.map((id) => {
            const b = doc.blocks.find((x) => x.id === id)
            return (
              <a key={id} href={`#b-${id}`} className="rounded-full border border-human/30 bg-human-soft/50 px-2.5 py-0.5 text-[13px] text-human hover:bg-human-soft">
                {b?.title ?? id}
              </a>
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
      const opt = b?.type === 'decision' ? b.options.find((o) => o.id === it.option)?.label : undefined
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
  }
}

function SendDialog({ open, onOpenChange, asks }: { open: boolean; onOpenChange: (o: boolean) => void; asks: string[] }) {
  const { doc, draft, submit, view } = useBoard()
  const [verdict, setVerdict] = React.useState<Verdict | null>(null)
  const [overall, setOverall] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const options: { value: Verdict; title: string; body: string }[] =
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
        {asks.length > 0 && (
          <div className="flex gap-2 rounded-lg bg-changed-soft/50 px-3 py-2 text-[13px]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-changed" />
            <span>
              Still unanswered: {asks.map((id) => doc.blocks.find((b) => b.id === id)?.title ?? id).join(', ')}. If you approve, the
              agent goes with its recommendation.
            </span>
          </div>
        )}
        <div className="grid gap-2" role="radiogroup">
          {options.map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={verdict === o.value}
              onClick={() => setVerdict(o.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/60',
                verdict === o.value && 'border-human bg-human-soft/40 ring-1 ring-human',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                  verdict === o.value && 'border-human bg-human text-white',
                )}
              >
                {verdict === o.value && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span>
                <span className="block text-sm font-medium">{o.title}</span>
                <span className="block text-[13px] text-muted-foreground">{o.body}</span>
              </span>
            </button>
          ))}
        </div>
        <Textarea placeholder="Anything else the agent should know? (optional)" value={overall} onChange={(e) => setOverall(e.target.value)} />
        {failed && (
          <p className="text-[13px] text-removed">
            Couldn’t reach the board server, so nothing was sent. Your feedback is still here as a draft; try again.
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep editing
          </Button>
          <Button
            variant="human"
            disabled={!verdict || sending}
            onClick={async () => {
              if (!verdict) return
              setSending(true)
              try {
                setFailed(false)
                await submit(verdict, overall)
                setOverall('')
                setVerdict(null)
                onOpenChange(false)
              } catch {
                setFailed(true)
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

function Shell() {
  const { doc, state, view } = useBoard()
  const [sending, setSending] = React.useState(false)
  const asks = openAsks(doc, state)
  const askSet = new Set(asks)
  const last = view.feedback.rounds.at(-1)
  return (
    <div className="min-h-screen pb-24">
      <Header onSend={() => setSending(true)} />
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 xl:grid-cols-[220px_minmax(0,820px)_220px] xl:justify-center">
        <Outline asks={askSet} />
        <main className="flex min-w-0 flex-col gap-5 pt-6">
          <Hero asks={asks} />
          {doc.blocks.map((b) => (
            <BlockView key={b.id} block={b} needsInput={askSet.has(b.id)} />
          ))}
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
            {last?.verdict === 'approve' && view.revision <= last.revision ? (
              <>
                <CheckCircle2 className="size-6 text-added" />
                <p className="text-sm text-muted-foreground">You approved this. The agent takes it from here.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Done reviewing? Send your comments and a verdict to the agent.</p>
                <Button variant="human" onClick={() => setSending(true)}>
                  <Send /> Send to agent
                </Button>
              </>
            )}
          </div>
        </main>
        <div className="hidden xl:block" />
      </div>
      <SelectionCommenter />
      <SendDialog open={sending} onOpenChange={setSending} asks={asks} />
    </div>
  )
}
