import * as React from 'react'
import type { Block, Board, BoardView, Draft, FeedbackItem, Target, Verdict } from '@/lib/schema'
import { effectiveState, key, viewSteps, type EffectiveState } from '@/lib/state'
import { putDraft, sendRound } from '@/lib/api'
import { newId } from '@/lib/utils'

type Ctx = {
  id: string
  view: BoardView
  doc: Board
  state: EffectiveState
  draft: Draft
  changes: Record<string, 'new' | 'changed'>
  saving: boolean
  addComment: (target: Target, text: string, replyTo?: string) => void
  editDraft: (id: string, text: string) => void
  removeDraft: (id: string) => void
  choose: (block: string, choice: { option?: string; other?: string; note?: string }) => void
  answer: (block: string, text: string) => void
  confirm: (block: string, item: string, value: 'yes' | 'no' | 'unsure', note?: string) => void
  strike: (block: string, item: string, struck: boolean, reason?: string) => void
  rename: (block: string, item: string, title: string) => void
  addStep: (block: string, after: string | null, title: string) => string
  reorder: (block: string, order: string[]) => void
  submit: (verdict: Verdict, overall: string) => Promise<void>
  isDraft: (id: string) => boolean
}

const BoardCtx = React.createContext<Ctx | null>(null)

export function useBoard() {
  const c = React.useContext(BoardCtx)
  if (!c) throw new Error('useBoard outside BoardProvider')
  return c
}

// Items that represent a current value rather than an event: a new one
// replaces the old one with the same slot.
function slot(it: FeedbackItem): string | null {
  switch (it.type) {
    case 'choice':
    case 'answer':
      return `${it.type}:${it.block}`
    case 'confirm':
    case 'step-strike':
    case 'step-edit':
      return `${it.type}:${key(it.block, it.item)}`
    case 'step-order':
      return `${it.type}:${it.block}`
    default:
      return null
  }
}

function blockSignature(b: Block) {
  return JSON.stringify(b)
}

export function BoardProvider({
  view,
  onSubmitted,
  children,
}: {
  view: BoardView & { doc: Board }
  onSubmitted: () => void
  children: React.ReactNode
}) {
  const [draft, setDraft] = React.useState<Draft>(view.feedback.draft)
  const [saving, setSaving] = React.useState(false)
  const dirty = React.useRef(false)
  const inflight = React.useRef<Promise<unknown>>(Promise.resolve())
  const pendingSave = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const submitting = React.useRef(false)

  // Blocks the agent changed while the page was open get a "changed" badge,
  // on top of what the server reports as changed since the last round.
  const seen = React.useRef<Map<string, string> | null>(null)
  const [live, setLive] = React.useState<Record<string, 'new' | 'changed'>>({})
  React.useEffect(() => {
    const now = new Map(view.doc.blocks.map((b) => [b.id, blockSignature(b)]))
    if (seen.current) {
      const next: Record<string, 'new' | 'changed'> = {}
      for (const [id, sig] of now) {
        if (!seen.current.has(id)) next[id] = 'new'
        else if (seen.current.get(id) !== sig) next[id] = 'changed'
      }
      if (Object.keys(next).length) setLive((l) => ({ ...l, ...next }))
    }
    seen.current = now
  }, [view.doc])

  // Draft saves run one at a time, in the order they were made, so an older
  // draft can never land after a newer one or after a send. `inflight` is the
  // tail of that chain; awaiting it waits for every save already started.
  const save = React.useCallback(
    (d: Draft) => {
      const next = inflight.current.catch(() => {}).then(() => putDraft({ data: { id: view.id, draft: d } }))
      inflight.current = next
      return next
    },
    [view.id],
  )

  React.useEffect(() => {
    if (!dirty.current || submitting.current) return
    setSaving(true)
    const t = setTimeout(() => {
      pendingSave.current = undefined
      if (submitting.current) return
      const p = save(draft)
      p.catch(() => {}).finally(() => inflight.current === p && setSaving(false))
    }, 400)
    pendingSave.current = t
    return () => clearTimeout(t)
  }, [draft, save])

  const mutate = React.useCallback((fn: (items: FeedbackItem[]) => FeedbackItem[]) => {
    dirty.current = true
    setDraft((d) => ({ ...d, items: fn(d.items) }))
  }, [])

  const put = React.useCallback(
    (it: FeedbackItem) =>
      mutate((items) => {
        const s = slot(it)
        return s ? [...items.filter((x) => slot(x) !== s), it] : [...items, it]
      }),
    [mutate],
  )

  // Drop a draft value when it just restates what was already sent.
  const submittedState = React.useMemo(
    () => effectiveState({ ...view.feedback, draft: { items: [] } }, view.revision),
    [view.feedback, view.revision],
  )

  const value = React.useMemo<Ctx>(() => {
    const state = effectiveState({ ...view.feedback, draft }, view.revision)
    const drafted = new Set(draft.items.map((i) => i.id))
    return {
      id: view.id,
      view,
      doc: view.doc,
      state,
      draft,
      saving,
      changes: { ...view.changes, ...live },
      isDraft: (id) => drafted.has(id),
      addComment: (target, text, replyTo) => put({ id: newId(), type: 'comment', target, text, replyTo }),
      editDraft: (id, text) =>
        mutate((items) => items.map((i) => (i.id === id && i.type === 'comment' ? { ...i, text } : i))),
      removeDraft: (id) => mutate((items) => items.filter((i) => i.id !== id)),
      choose: (block, c) => {
        const prev = submittedState.choices.get(block)
        if (prev && prev.option === c.option && prev.other === c.other && (prev.note ?? '') === (c.note ?? '')) {
          mutate((items) => items.filter((i) => !(i.type === 'choice' && i.block === block)))
        } else put({ id: newId(), type: 'choice', block, ...c })
      },
      answer: (block, text) => {
        const prev = submittedState.answers.get(block)
        if (prev && prev.text === text) mutate((items) => items.filter((i) => !(i.type === 'answer' && i.block === block)))
        else put({ id: newId(), type: 'answer', block, text })
      },
      confirm: (block, item, v, note) => {
        const prev = submittedState.confirms.get(key(block, item))
        if (prev && prev.value === v && (prev.note ?? '') === (note ?? '')) {
          mutate((items) => items.filter((i) => !(i.type === 'confirm' && i.block === block && i.item === item)))
        } else put({ id: newId(), type: 'confirm', block, item, value: v, note })
      },
      strike: (block, item, struck, reason) => {
        // Striking a step you added yourself just removes the addition.
        const own = draft.items.find((i) => i.type === 'step-add' && i.id === item)
        if (own && struck) {
          mutate((items) => items.filter((i) => i.id !== item && !('item' in i && i.item === item)))
          return
        }
        // A new reason on a removal already sent is still news for the agent.
        const prev = submittedState.strikes.get(key(block, item))
        const same = (prev?.struck ?? false) === struck && (!struck || (prev?.reason ?? '') === (reason ?? ''))
        if (same) {
          mutate((items) => items.filter((i) => !(i.type === 'step-strike' && i.block === block && i.item === item)))
        } else put({ id: newId(), type: 'step-strike', block, item, struck, reason })
      },
      rename: (block, item, title) => {
        const own = draft.items.find((i) => i.type === 'step-add' && i.id === item)
        if (own) {
          mutate((items) => items.map((i) => (i.id === item && i.type === 'step-add' ? { ...i, title } : i)))
          return
        }
        // Compare with the title already sent, not the doc's: putting the doc's
        // title back after a submitted rename is an edit of its own.
        const blk = view.doc.blocks.find((b) => b.id === block)
        const sent = blk?.type === 'steps' ? viewSteps(blk, submittedState).find((x) => x.id === item)?.title : undefined
        if (sent === title) {
          mutate((items) => items.filter((i) => !(i.type === 'step-edit' && i.block === block && i.item === item)))
        } else put({ id: newId(), type: 'step-edit', block, item, title })
      },
      addStep: (block, after, title) => {
        const id = newId()
        put({ id, type: 'step-add', block, after, title })
        return id
      },
      reorder: (block, order) => put({ id: newId(), type: 'step-order', block, order }),
      submit: async (verdict, overall) => {
        // A draft save that lands after the send would resurrect the sent
        // items as an unsent draft, so cancel the queued save, wait out every
        // save already started, and allow no new ones until the send settles.
        submitting.current = true
        clearTimeout(pendingSave.current)
        pendingSave.current = undefined
        try {
          await inflight.current.catch(() => {})
          await sendRound({ data: { id: view.id, verdict, overall, draft, revision: view.revision } })
        } catch (e) {
          // The round wasn't recorded; make sure the draft we held back is saved,
          // and fetch the board in case it moved on underneath the human.
          save(draft).catch(() => {})
          onSubmitted()
          throw e
        } finally {
          submitting.current = false
          setSaving(false)
        }
        dirty.current = false
        setDraft({ items: [] })
        setLive({})
        onSubmitted()
      },
    }
  }, [view, draft, saving, live, put, mutate, submittedState, onSubmitted, save])

  return <BoardCtx.Provider value={value}>{children}</BoardCtx.Provider>
}

export function useOptionalBoard() {
  return React.useContext(BoardCtx)
}

// Paths in the doc are relative to the board directory unless they are URLs.
// The board revision is part of the URL so an asset the agent rewrote in place
// is fetched again when the doc changes, instead of being served from memory.
export function assetUrl(boardId: string, src: string, revision: number) {
  if (/^(https?:|data:)/.test(src)) return src
  const file = src.replace(/^\.\//, '').split('/').map(encodeURIComponent).join('/')
  return `/api/boards/${boardId}/file/${file}?v=${revision}`
}
