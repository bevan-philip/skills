import type { Block, Board } from './schema'

// What the agent changed between the doc the human last sent a round against
// (the baseline) and the doc now: whole blocks, the items inside them, and its
// replies to the human's comments.

export type Change = 'new' | 'changed'

export type BoardDiff = {
  blocks: Record<string, Change>
  items: Record<string, Record<string, Change>>
  removedItems: Record<string, string[]>
  removedBlocks: { id: string; title: string }[]
  newReplies: string[]
}

export const emptyDiff: BoardDiff = { blocks: {}, items: {}, removedItems: {}, removedBlocks: [], newReplies: [] }

type Item = { id: string; label: string; value: unknown }

// Ids match how the rest of the page addresses items (row-N for plain table
// rows, the path for files).
function itemsOf(b: Block): Item[] {
  switch (b.type) {
    case 'steps':
      return b.items.map((i) => ({ id: i.id, label: i.title, value: i }))
    case 'confirm':
      return b.items.map((i) => ({ id: i.id, label: i.text, value: i }))
    case 'decision':
      return b.options.map((o) => ({ id: o.id, label: o.label, value: o }))
    case 'diagram':
      return b.nodes.map((n) => ({ id: n.id, label: n.label, value: n }))
    case 'files':
      return b.items.map((f) => ({ id: f.path, label: f.path, value: f }))
    case 'table':
      return b.rows.map((r, i) =>
        Array.isArray(r)
          ? { id: `row-${i + 1}`, label: r[0] ?? `row ${i + 1}`, value: r }
          : { id: r.id, label: r.cells[0] ?? r.id, value: r },
      )
    default:
      return []
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function diffBoards(before: Board | null, after: Board): BoardDiff {
  if (!before) return emptyDiff
  const out: BoardDiff = { blocks: {}, items: {}, removedItems: {}, removedBlocks: [], newReplies: [] }
  const prev = new Map(before.blocks.map((b) => [b.id, b]))
  for (const b of after.blocks) {
    const p = prev.get(b.id)
    if (!p) {
      out.blocks[b.id] = 'new'
      continue
    }
    if (same(p, b)) continue
    out.blocks[b.id] = 'changed'
    if (p.type !== b.type) continue
    const was = new Map(itemsOf(p).map((i) => [i.id, i]))
    const now = itemsOf(b)
    const items: Record<string, Change> = {}
    for (const i of now) {
      const w = was.get(i.id)
      if (!w) items[i.id] = 'new'
      else if (!same(w.value, i.value)) items[i.id] = 'changed'
    }
    const kept = new Set(now.map((i) => i.id))
    const removed = [...was.values()].filter((i) => !kept.has(i.id)).map((i) => i.label)
    if (Object.keys(items).length) out.items[b.id] = items
    if (removed.length) out.removedItems[b.id] = removed
  }
  const kept = new Set(after.blocks.map((b) => b.id))
  out.removedBlocks = before.blocks
    .filter((b) => !kept.has(b.id))
    .map((b) => ({ id: b.id, title: b.title ?? ('question' in b ? b.question : b.type) }))
  out.newReplies = Object.keys(after.replies).filter((k) => !same(before.replies[k], after.replies[k]))
  return out
}
