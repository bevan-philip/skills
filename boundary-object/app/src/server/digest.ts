import path from 'node:path'
import type { Block, Board, FeedbackFile, FeedbackItem, Round, Target } from '@/lib/schema'
import { answered, effectiveState, openAsks, viewSteps } from '@/lib/state'
import { edgeLabel, fromDiagram } from '@/lib/graph'

// Renders one round of human feedback as plain text for the agent. Every
// line carries the ids the agent needs to act on it, and labels resolved
// against the doc so the agent doesn't have to cross-reference.

// Labels come from the doc the agent wrote, so shortening them loses nothing.
// Anything the human wrote is quoted in full: it may carry the one constraint
// that matters.
const label = (s: string) => JSON.stringify(s.length > 240 ? `${s.slice(0, 237)}...` : s)
const q = (s: string) => JSON.stringify(s)

function blockName(b: Block | undefined, id: string) {
  if (id === 'summary') return 'the summary'
  if (!b) return `[${id}] (block no longer in doc)`
  const title = b.title ?? ('question' in b ? b.question : 'prompt' in b ? b.prompt : undefined)
  return title ? `${b.type} [${id}] ${label(title)}` : `${b.type} [${id}]`
}

function itemName(b: Block | undefined, item: string, fallback?: string) {
  let name: string | undefined
  if (b?.type === 'steps') name = b.items.find((x) => x.id === item)?.title
  if (b?.type === 'confirm') name = b.items.find((x) => x.id === item)?.text
  if (b?.type === 'decision') name = b.options.find((x) => x.id === item)?.label
  // Arrows are addressed as "from->to" (plus "#2" and so on for parallel ones).
  const edge = (b?.type === 'diagram' || b?.type === 'mermaid') && item.includes('->')
  if (b?.type === 'diagram') {
    const g = fromDiagram(b)
    const e = g.edges.find((x) => x.id === item)
    name = edge ? (e ? edgeLabel(g, e) : undefined) : b.nodes.find((x) => x.id === item)?.label
  }
  if (b?.type === 'table') {
    const rows = b.rows.map((r, i) => (Array.isArray(r) ? { id: `row-${i + 1}`, cells: r } : r))
    name = rows.find((r) => r.id === item)?.cells[0]
  }
  if (b?.type === 'files') name = item
  name ??= fallback
  const kind =
    b?.type === 'steps'
      ? 'step'
      : edge
        ? 'arrow'
        : b?.type === 'diagram' || b?.type === 'mermaid'
          ? 'node'
        : b?.type === 'files'
          ? 'file'
          : b?.type === 'table'
            ? 'row'
            : b?.type === 'decision'
              ? 'option'
              : 'item'
  if (kind === 'file') return `file ${item}`
  return name ? `${kind} [${item}] ${label(name)}` : `${kind} [${item}]`
}

function describeTarget(doc: Board, t: Target, boardDir: string) {
  const b = doc.blocks.find((x) => x.id === t.block)
  const parts = [`on ${blockName(b, t.block)}`]
  // The label is a human-readable stand-in; skip it when something more precise follows.
  if (t.item) parts.push(itemName(b, t.item, t.label))
  else if (t.label && !t.element && t.line === undefined) parts.push(`at ${label(t.label)}`)
  if (t.line !== undefined) parts.push(`line ${t.line}`)
  if (t.quote) parts.push(`quoting ${q(t.quote)}`)
  if (t.element) {
    const el = t.element
    parts.push(`element <${el.tag ?? '?'}>${el.text ? ` ${label(el.text)}` : ''} (selector: ${el.selector})`)
  }
  if (t.pin && !t.element) {
    const at = `at (${Math.round(t.pin.x * 100)}% from left, ${Math.round(t.pin.y * 100)}% from top)`
    const src = b?.type === 'image' ? b.src : undefined
    const file = src && !/^https?:/.test(src) ? ` of ${path.resolve(boardDir, src)}` : ''
    parts.push(`${at}${file}`)
  }
  return parts.join(', ')
}

const verdictLine: Record<Round['verdict'], Record<Board['kind'], string>> = {
  approve: {
    plan: 'APPROVED. Proceed with implementation, applying every answer and plan edit below.',
    report: 'ACCEPTED. The human is satisfied with the work. Handle any comments below, then wrap up.',
  },
  changes: {
    plan: 'CHANGES REQUESTED. Do not start implementing. Revise doc.json to address everything below, then wait again.',
    report: 'CHANGES REQUESTED. Make the fixes below, update the report, then wait again.',
  },
  comment: {
    plan: 'COMMENTS ONLY (no verdict yet). Answer in doc.json, adjust the plan if needed, then wait again.',
    report: 'COMMENTS ONLY (no verdict yet). Answer in doc.json, then wait again.',
  },
}

// `doc` is the snapshot the human reviewed (round.revision); opts.revision is
// the doc's current revision, used only to say the doc has moved on since.
export function renderDigest(
  doc: Board | null,
  fb: FeedbackFile,
  round: Round,
  opts: { boardId: string; boardDir: string; revision: number },
): string {
  if (!doc) return `Round ${round.n} arrived but doc.json is currently invalid; run check and fix it first.`
  const out: string[] = []
  const of = <T extends FeedbackItem['type']>(t: T) =>
    round.items.filter((i): i is Extract<FeedbackItem, { type: T }> => i.type === t)
  const blk = (id: string) => doc.blocks.find((b) => b.id === id)
  // What the page showed when the human sent this round: every round up to
  // this one still live at the revision they reviewed, and no unsent draft.
  const sent = effectiveState({ draft: { items: [] }, rounds: fb.rounds.filter((r) => r.n <= round.n) }, round.revision)

  out.push(`# Round ${round.n} on board "${opts.boardId}" — ${label(doc.title)}`)
  out.push(
    `The human reviewed revision ${round.revision}${round.revision < opts.revision ? ` (the doc is now at ${opts.revision})` : ''}.`,
  )
  out.push(`Verdict: ${verdictLine[round.verdict][doc.kind]}`)
  if (round.overall) out.push(`Overall note: ${q(round.overall)}`)

  const choices = of('choice')
  if (choices.length) {
    out.push('', '## Decisions')
    for (const c of choices) {
      const b = blk(c.block)
      if (!answered(c)) {
        out.push(`- ${blockName(b, c.block)} → cleared their earlier answer (now unanswered)`)
        continue
      }
      if (c.defer === 'explore') {
        out.push(`- ${blockName(b, c.block)} → FIND OUT FIRST. Don't decide this yet: try the options for real, record what you found, and ask again.`)
        if (c.note) out.push(`  what they want to know: ${q(c.note)}`)
        continue
      }
      if (c.defer === 'delegate') {
        const rec = b?.type === 'decision' ? b.options.find((o) => o.recommended) : undefined
        out.push(`- ${blockName(b, c.block)} → YOUR CALL. The human leaves this to you${rec ? `; your recommendation is [${rec.id}]` : ''}.`)
        if (c.note) out.push(`  note: ${q(c.note)}`)
        continue
      }
      const picked = c.option
        ? itemName(b, c.option)
        : `their own answer: ${q(c.other ?? '')}`
      const rec = b?.type === 'decision' ? b.options.find((o) => o.recommended) : undefined
      const vs = rec ? (rec.id === c.option ? ' (your recommendation)' : ` (you recommended [${rec.id}])`) : ''
      out.push(`- ${blockName(b, c.block)} → ${picked}${vs}`)
      if (c.note) out.push(`  note: ${q(c.note)}`)
    }
  }

  const tunes = of('tune')
  if (tunes.length) {
    out.push('', '## Tuned values')
    for (const t of tunes) {
      const b = blk(t.block)
      const controls = b?.type === 'mockup' ? (b.controls ?? []) : []
      const set = Object.entries(t.values)
      if (!set.length) {
        out.push(`- ${blockName(b, t.block)} → back to your values (cancels what they tuned before)`)
        continue
      }
      out.push(`- ${blockName(b, t.block)}:`)
      for (const [id, value] of set) {
        const c = controls.find((x) => x.id === id)
        const was = c ? `${c.value}${c.type === 'range' && c.unit ? c.unit : ''}` : undefined
        out.push(`  - ${c ? `${c.var} (${label(c.label)})` : `[${id}]`} = ${q(value)}${was ? ` (you proposed ${q(was)})` : ''}`)
      }
    }
  }

  const answers = of('answer')
  if (answers.length) {
    out.push('', '## Answers')
    for (const a of answers) out.push(`- ${blockName(blk(a.block), a.block)} → ${q(a.text)}`)
  }

  const confirms = of('confirm')
  if (confirms.length) {
    out.push('', '## Confirmations')
    const word =
      doc.kind === 'report'
        ? { yes: 'WORKS', no: 'DOES NOT WORK', unsure: 'COULD NOT CHECK' }
        : { yes: 'YES, correct', no: 'NO, wrong', unsure: 'UNSURE' }
    for (const c of confirms) {
      out.push(`- ${blockName(blk(c.block), c.block)}, ${itemName(blk(c.block), c.item)} → ${word[c.value]}`)
      if (c.note) out.push(`  note: ${q(c.note)}`)
    }
  }

  const edits = round.items.filter(
    (i): i is Extract<FeedbackItem, { type: `step-${string}` }> => i.type.startsWith('step-'),
  )
  if (edits.length) {
    out.push('', '## Plan edits')
    for (const i of edits) {
      const b = blk(i.block)
      const where = `in ${blockName(b, i.block)}:`
      if (i.type === 'step-strike') {
        out.push(
          i.struck
            ? `- ${where} REMOVE ${itemName(b, i.item)}${i.reason ? ` — reason: ${q(i.reason)}` : ''}`
            : `- ${where} keep ${itemName(b, i.item)} (un-struck)`,
        )
      }
      if (i.type === 'step-edit') {
        const current = b?.type === 'steps' ? b.items.find((x) => x.id === i.item)?.title : undefined
        out.push(
          current === i.title
            ? `- ${where} keep the title of ${itemName(b, i.item)} (cancels an earlier rename)`
            : `- ${where} rename ${itemName(b, i.item)} → ${q(i.title)}`,
        )
      }
      if (i.type === 'step-add') {
        const after = i.after ? `after [${i.after}]` : 'at the start'
        out.push(`- ${where} ADD step [${i.id}] ${q(i.title)} ${after} (reuse id "${i.id}" if you adopt it)`)
      }
    }
    // Insertions and reorders interact, so state the order the human ended up
    // with, worked out exactly as the page laid it out when they sent it.
    const moved = new Set(edits.filter((i) => i.type === 'step-order' || i.type === 'step-add').map((i) => i.block))
    for (const id of moved) {
      const b = blk(id)
      if (b?.type !== 'steps') continue
      const steps = viewSteps(b, sent)
      const order = steps.map((x) => (x.struck ? `${x.id} (removed)` : x.id)).join(', ')
      out.push(`- in ${blockName(b, id)}: resulting order: ${order}`)
    }
  }

  const comments = of('comment')
  if (comments.length) {
    out.push('', '## Comments')
    const everyComment = [...fb.rounds.flatMap((r) => r.items), ...fb.draft.items].filter(
      (i): i is Extract<FeedbackItem, { type: 'comment' }> => i.type === 'comment',
    )
    for (const c of comments) {
      if (c.replyTo) {
        const root = everyComment.find((x) => x.id === c.replyTo)
        const prev = [root, ...everyComment.filter((x) => x.replyTo === c.replyTo && x.id !== c.id)]
          .filter(Boolean)
          .map((x) => doc.replies[x!.id]?.text)
          .filter(Boolean)
          .at(-1)
        out.push(`- [${c.id}] follow-up in thread [${c.replyTo}]${prev ? ` (your last reply: ${label(prev)})` : ''}:`)
      } else {
        out.push(`- [${c.id}] ${describeTarget(doc, c.target, opts.boardDir)}:`)
      }
      out.push(`  ${q(c.text)}`)
    }
  }

  if (!round.items.length && !round.overall) out.push('', '(No individual items in this round.)')

  const still = openAsks(doc, sent)
  if (still.length && round.verdict !== 'approve') {
    out.push('', `Still unanswered on the board: ${still.map((id) => `[${id}]`).join(', ')}.`)
  } else if (still.length) {
    out.push('', `Left unanswered (use your recommendation): ${still.map((id) => `[${id}]`).join(', ')}.`)
  }

  const qualified = choices.some((c) => c.option && c.note)
  const exploring = choices.some((c) => c.defer === 'explore')
  out.push(
    '',
    '## How to respond',
    '- Reply to each comment by adding `"replies": { "<comment id>": { "text": "...", "status": "resolved" | "declined" | "question" | "noted" } }` to doc.json.',
    round.verdict === 'approve'
      ? doc.kind === 'plan'
        ? '- Set "status" to what you are building now, then build it. When you are done, report back on a new board with kind "report".'
        : '- Set "status" to say you are wrapping up. No need to wait again unless you change something.'
      : '- Update blocks in place and keep their ids so the human sees what changed. Set "status" to say what changed, run check, then wait again.',
  )
  if (exploring)
    out.push(
      '- For each FIND OUT FIRST decision: spike the options (a scratch branch, a worktree or a subagent each, when it needs code), measure what the human asked about, and put the results on each option as `evidence` (what you tried and saw) and `metrics` (numbers to compare). Keep the option ids, set `changeNote` on the decision, and ask again; the decision reopens on the board.',
    )
  if (tunes.length)
    out.push(
      "- Treat tuned values as the human's answer for those properties: use them in the build, and set each control's `value` to match so the mockup shows what was agreed.",
    )
  if (qualified)
    out.push(
      '- A decision above came with a note. If the note changes what the picked option means, rewrite that option in place (label, summary, pros, cons) so it names what you will actually build. Keep its id so the human\'s choice stays on it; don\'t add a new option for it.',
    )
  return out.join('\n')
}

export function renderState(doc: Board | null, fb: FeedbackFile, revision: number): string {
  if (!doc) return 'doc.json is currently invalid.'
  // Only what the human has sent counts as decided; the draft is still theirs.
  const s = effectiveState({ ...fb, draft: { items: [] } }, revision)
  const n = fb.rounds.length
  const out: string[] = [`# Current answers on ${label(doc.title)} (${n} round${n === 1 ? '' : 's'} sent)`]
  for (const b of doc.blocks) {
    if (b.type === 'decision') {
      const c = s.choices.get(b.id)
      const explored = s.explored.get(b.id)
      const ans =
        c && answered(c, b)
          ? c.defer === 'explore'
            ? 'find out first (waiting for your findings)'
            : c.defer === 'delegate'
              ? 'your call'
              : c.option
                ? itemName(b, c.option)
                : `own answer ${q(c.other ?? '')}`
          : explored
            ? `unanswered (you reported findings after they asked you to find out first in round ${explored.round})`
            : 'unanswered'
      out.push(`- ${blockName(b, b.id)} → ${ans}${c?.note ? `; note ${q(c.note)}` : ''}`)
    }
    if (b.type === 'question') {
      const a = s.answers.get(b.id)
      out.push(`- ${blockName(b, b.id)} → ${a ? q(a.text) : 'unanswered'}`)
    }
    if (b.type === 'mockup' && s.tunes.get(b.id)) {
      const t = s.tunes.get(b.id)!
      const set = Object.entries(t.values)
      out.push(`- ${blockName(b, b.id)} → ${set.length ? set.map(([id, v]) => `${b.controls?.find((x) => x.id === id)?.var ?? id} = ${q(v)}`).join(', ') : 'your values'}`)
    }
    if (b.type === 'confirm') {
      for (const it of b.items) {
        const c = s.confirms.get(`${b.id}/${it.id}`)
        out.push(`- ${blockName(b, b.id)}, ${itemName(b, it.id)} → ${c ? c.value : 'unanswered'}${c?.note ? `; note ${q(c.note)}` : ''}`)
      }
    }
  }
  const unreplied = s.comments.filter((c) => c.round !== null && !doc.replies[c.id])
  if (unreplied.length) out.push('', `Comments with no reply yet: ${unreplied.map((c) => `[${c.id}]`).join(', ')}`)
  return out.join('\n')
}
