import type { Board, BlockOf, FeedbackFile, FeedbackItem, Round } from './schema'

// Folds every submitted round plus the unsent draft into "what the human
// currently thinks". Later entries win. `from` records where each answer came
// from so the page can say "you answered this in round 2".

export type Origin = { round: number | null } // null = draft

type With<T> = T & Origin

export type Comment = With<Extract<FeedbackItem, { type: 'comment' }>>

export type EffectiveState = {
  choices: Map<string, With<Extract<FeedbackItem, { type: 'choice' }>>>
  answers: Map<string, With<Extract<FeedbackItem, { type: 'answer' }>>>
  confirms: Map<string, With<Extract<FeedbackItem, { type: 'confirm' }>>>
  strikes: Map<string, With<Extract<FeedbackItem, { type: 'step-strike' }>>>
  edits: Map<string, With<Extract<FeedbackItem, { type: 'step-edit' }>>>
  adds: Map<string, With<Extract<FeedbackItem, { type: 'step-add' }>>[]>
  orders: Map<string, With<Extract<FeedbackItem, { type: 'step-order' }>>>
  comments: Comment[]
}

export const key = (block: string, item?: string) => (item ? `${block}/${item}` : block)

export function effectiveState(fb: FeedbackFile, revision: number): EffectiveState {
  const s: EffectiveState = {
    choices: new Map(),
    answers: new Map(),
    confirms: new Map(),
    strikes: new Map(),
    edits: new Map(),
    adds: new Map(),
    orders: new Map(),
    comments: [],
  }
  const apply = (items: FeedbackItem[], round: Round | null) => {
    // Plan edits (strike/edit/add/order) are proposals to the agent. Once the
    // agent has revised the doc after receiving them, its doc is the truth and
    // the overlay is dropped; answers and comments stay visible.
    const planEditsLive = round === null || round.revision >= revision
    const origin = { round: round ? round.n : null }
    for (const it of items) {
      switch (it.type) {
        case 'comment':
          s.comments.push({ ...it, ...origin })
          break
        case 'choice':
          s.choices.set(it.block, { ...it, ...origin })
          break
        case 'answer':
          s.answers.set(it.block, { ...it, ...origin })
          break
        case 'confirm':
          s.confirms.set(key(it.block, it.item), { ...it, ...origin })
          break
        case 'step-strike':
          if (planEditsLive) s.strikes.set(key(it.block, it.item), { ...it, ...origin })
          break
        case 'step-edit':
          if (planEditsLive) s.edits.set(key(it.block, it.item), { ...it, ...origin })
          break
        case 'step-add':
          if (planEditsLive) s.adds.set(it.block, [...(s.adds.get(it.block) ?? []), { ...it, ...origin }])
          break
        case 'step-order':
          if (planEditsLive) s.orders.set(it.block, { ...it, ...origin })
          break
      }
    }
  }
  for (const r of fb.rounds) apply(r.items, r)
  apply(fb.draft.items, null)
  return s
}

export type ViewStep = {
  id: string
  title: string
  originalTitle?: string
  detail?: string
  files?: string[]
  status?: BlockOf<'steps'>['items'][number]['status']
  note?: string
  struck: boolean
  strikeReason?: string
  addedByHuman: boolean
  origin?: Origin
}

// The plan as the human currently sees it: agent steps + human additions,
// in the human's order, with strikes and renames overlaid.
export function viewSteps(blk: BlockOf<'steps'>, s: EffectiveState): ViewStep[] {
  const base: ViewStep[] = blk.items.map((it) => {
    const strike = s.strikes.get(key(blk.id, it.id))
    const edit = s.edits.get(key(blk.id, it.id))
    return {
      id: it.id,
      title: edit ? edit.title : it.title,
      originalTitle: edit && edit.title !== it.title ? it.title : undefined,
      detail: it.detail,
      files: it.files,
      status: it.status,
      note: it.note,
      struck: strike?.struck ?? false,
      strikeReason: strike?.struck ? strike.reason : undefined,
      addedByHuman: false,
    }
  })
  const known = new Set(base.map((b) => b.id))
  const adds: ViewStep[] = []
  const anchors = new Map<string, string | null>()
  for (const add of s.adds.get(blk.id) ?? []) {
    // The agent adopts a human-added step by reusing its id.
    if (known.has(add.id)) continue
    known.add(add.id)
    const strike = s.strikes.get(key(blk.id, add.id))
    adds.push({
      id: add.id,
      title: s.edits.get(key(blk.id, add.id))?.title ?? add.title,
      struck: strike?.struck ?? false,
      addedByHuman: true,
      origin: { round: add.round },
    })
    anchors.set(add.id, add.after)
  }
  // Steps the human's saved order mentions go in that order; steps it doesn't
  // (inserted after the last reorder) go straight after the step they were
  // inserted after, so a reorder never sends a later insertion to the end.
  const order = s.orders.get(blk.id)?.order
  const rank = new Map((order ?? []).map((id, i) => [id, i]))
  const list = [...base, ...adds.filter((a) => rank.has(a.id))]
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (rank.get(a.x.id) ?? 1e6 + a.i) - (rank.get(b.x.id) ?? 1e6 + b.i))
    .map(({ x }) => x)
  for (const add of adds) {
    if (rank.has(add.id)) continue
    const after = anchors.get(add.id) ?? null
    const anchor = after === null ? -1 : list.findIndex((x) => x.id === after)
    list.splice(after === null ? 0 : anchor === -1 ? list.length : anchor + 1, 0, add)
  }
  return list
}

export type Thread = { root: Comment; followups: Comment[] }

export function threadsFor(s: EffectiveState, block: string): Thread[] {
  const roots = s.comments.filter((c) => c.target.block === block && !c.replyTo)
  return roots.map((root) => ({ root, followups: s.comments.filter((c) => c.replyTo === root.id) }))
}

// A choice counts only if it names an option or a non-blank answer of the
// human's own; clearing "something else" leaves an empty one behind. Given the
// decision, an option the agent has since removed doesn't count either.
export const answered = (c?: { option?: string; other?: string }, block?: BlockOf<'decision'>) =>
  Boolean(c && ((c.option && (!block || block.options.some((o) => o.id === c.option))) || c.other?.trim()))

// Blocks that ask the human for something and have no answer yet.
export function openAsks(doc: Board, s: EffectiveState): string[] {
  const open: string[] = []
  for (const b of doc.blocks) {
    if (b.type === 'decision' && !answered(s.choices.get(b.id), b)) open.push(b.id)
    if (b.type === 'question' && !s.answers.get(b.id)?.text.trim()) open.push(b.id)
    if (b.type === 'confirm' && b.items.some((it) => !s.confirms.has(key(b.id, it.id)))) open.push(b.id)
  }
  // An agent reply marked "question" stays open until the human follows up.
  s.comments.forEach((c, i) => {
    if (doc.replies[c.id]?.status !== 'question') return
    const thread = c.replyTo ?? c.id
    if (!s.comments.slice(i + 1).some((f) => f.replyTo === thread)) open.push(c.target.block)
  })
  return [...new Set(open)]
}
