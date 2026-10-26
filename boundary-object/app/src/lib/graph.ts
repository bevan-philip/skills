import type { FlowchartModel, StateModel } from 'pele'
import type { BlockOf } from './schema'

// One graph model for everything drawn as boxes and arrows: the agent's own
// `diagram` blocks, and Mermaid flowcharts and state diagrams (parsed by Pele,
// laid out here). Sharing it means every graph on a board gets the same layout
// engine, the same change colours and the same click-to-comment nodes.

export type Status = 'added' | 'changed' | 'removed' | 'unchanged'
export type Shape = 'box' | 'round' | 'pill' | 'diamond' | 'circle' | 'start' | 'end' | 'bar' | 'note'
export type Direction = 'RIGHT' | 'DOWN' | 'LEFT' | 'UP'

export type GNode = {
  id: string
  label: string
  shape: Shape
  // Picks an icon; see kindIcon in the view.
  kind?: string
  status?: Status
  detail?: string
  parent?: string
}

export type GGroup = { id: string; label: string; parent?: string; status?: Status }

export type GEdge = {
  // Stable across revisions: from and to, plus a counter for parallel edges.
  id: string
  from: string
  to: string
  label?: string
  status?: Status
  dashed?: boolean
  thick?: boolean
  arrow: boolean
}

export type Graph = {
  // The direction asked for. The view also tries the other one and uses it
  // instead when that reads clearly better at the card's width; null means
  // no preference.
  direction: Direction | null
  nodes: GNode[]
  groups: GGroup[]
  edges: GEdge[]
}

function edgeIds<T extends { from: string; to: string }>(edges: T[]): (T & { id: string })[] {
  const seen = new Map<string, number>()
  return edges.map((e) => {
    const base = `${e.from}->${e.to}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return { ...e, id: n ? `${base}#${n + 1}` : base }
  })
}

const kindShape: Record<string, Shape> = {
  actor: 'pill',
  note: 'note',
  decision: 'diamond',
  start: 'start',
  end: 'end',
  state: 'round',
}

export function fromDiagram(block: BlockOf<'diagram'>): Graph {
  return {
    direction: block.direction === 'LR' ? 'RIGHT' : block.direction === 'TB' ? 'DOWN' : null,
    groups: block.groups.map((g) => ({ id: g.id, label: g.label, parent: g.parent })),
    nodes: block.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      shape: (n.kind ? kindShape[n.kind] : undefined) ?? 'box',
      kind: n.kind,
      status: n.status,
      detail: n.detail,
      parent: n.group,
    })),
    edges: edgeIds(
      block.edges.map((e) => ({
        from: e.from,
        to: e.to,
        label: e.label,
        status: e.status,
        dashed: e.dashed || e.status === 'removed',
        arrow: true,
      })),
    ),
  }
}

// ---- Mermaid, from Pele's parse() ----

const statusClass = (classes: Iterable<string>): Status | undefined => {
  for (const c of classes) if (c === 'added' || c === 'changed' || c === 'removed') return c
  return undefined
}

const mermaidDirection = (d: string | undefined): Direction | null =>
  d === 'LR' ? 'RIGHT' : d === 'RL' ? 'LEFT' : d === 'BT' ? 'UP' : d === 'TB' || d === 'TD' ? 'DOWN' : null

const flowShape: Record<string, Shape> = {
  round: 'round',
  stadium: 'pill',
  diamond: 'diamond',
  circle: 'circle',
  doublecircle: 'circle',
}

const plain = (s: string | undefined) =>
  (s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export function fromFlowchart(m: FlowchartModel): Graph {
  const groups: GGroup[] = []
  const parentOf = new Map<string, string>()
  const subgraphIds = new Set(m.subgraphs.map((s) => s.id))
  // Mermaid lists inner subgraphs first, so the first one to claim a member
  // is its innermost container.
  for (const sg of m.subgraphs) {
    for (const member of sg.nodes) if (!parentOf.has(member)) parentOf.set(member, sg.id)
  }
  for (const sg of m.subgraphs) {
    groups.push({ id: sg.id, label: plain(sg.title) || sg.id, parent: parentOf.get(sg.id), status: statusClass(sg.classes) })
  }
  const nodes: GNode[] = [...m.nodes.values()]
    .filter((n) => !subgraphIds.has(n.id))
    .map((n) => ({
      id: n.id,
      label: plain(n.text) || n.id,
      shape: (n.type ? flowShape[n.type] : undefined) ?? 'box',
      kind: n.type === 'cylinder' ? 'db' : undefined,
      status: statusClass(n.classes),
      parent: parentOf.get(n.id),
    }))
  const edges = edgeIds(
    m.edges
      .filter((e) => e.stroke !== 'invisible')
      .map((e) => ({
        from: e.start,
        to: e.end,
        label: plain(e.text) || undefined,
        status: statusClass(e.classes),
        dashed: e.stroke === 'dotted',
        thick: e.stroke === 'thick',
        arrow: e.type !== 'arrow_open',
      })),
  )
  return { direction: mermaidDirection(m.direction) ?? 'DOWN', nodes, groups, edges }
}

type StateGraphNode = {
  id: string
  shape: string
  label?: string
  cssClasses?: string
  isGroup?: boolean
  parentId?: string
  noteFor?: string
}
type StateGraphEdge = { id: string; start: string; end: string; label?: string; pattern?: string; classes?: string }

export function fromState(m: StateModel): Graph | null {
  const g = (m as StateModel & { graph?: { nodes: StateGraphNode[]; edges: StateGraphEdge[] } }).graph
  if (!g) return null
  const byId = new Map(g.nodes.map((n) => [n.id, n]))
  // Mermaid wraps each note in a group of its own; put the note beside the
  // state it belongs to instead.
  const parent = (n: StateGraphNode): string | undefined => {
    const p = n.parentId ? byId.get(n.parentId) : undefined
    if (p?.shape === 'noteGroup') return n.noteFor ? byId.get(n.noteFor)?.parentId : undefined
    return n.parentId
  }
  const status = (n: StateGraphNode) => statusClass((n.cssClasses ?? '').split(/\s+/))
  const groups: GGroup[] = []
  const nodes: GNode[] = []
  for (const n of g.nodes) {
    if (n.shape === 'noteGroup') continue
    if (n.isGroup) {
      groups.push({ id: n.id, label: plain(n.label) || n.id, parent: parent(n), status: status(n) })
      continue
    }
    const shape: Shape =
      n.shape === 'stateStart'
        ? 'start'
        : n.shape === 'stateEnd'
          ? 'end'
          : n.shape === 'choice'
            ? 'diamond'
            : n.shape === 'fork' || n.shape === 'join'
              ? 'bar'
              : n.shape === 'note'
                ? 'note'
                : 'round'
    const hidden = shape === 'start' || shape === 'end' || shape === 'bar' || (shape === 'diamond' && n.label === n.id)
    nodes.push({ id: n.id, label: hidden ? '' : plain(n.label) || n.id, shape, status: status(n), parent: parent(n) })
  }
  const edges = edgeIds(
    g.edges.map((e) => {
      const note = (e.classes ?? '').includes('note-edge')
      return { from: e.start, to: e.end, label: plain(e.label) || undefined, dashed: note || e.pattern === 'dashed', arrow: !note }
    }),
  )
  return { direction: mermaidDirection(m.direction) ?? 'DOWN', nodes, groups, edges }
}

// Mermaid source → Graph for the types drawn here; null for the rest, which
// Pele renders itself (sequence diagrams, charts, ER, …).
export async function mermaidGraph(code: string): Promise<Graph | null> {
  const pele = await import('pele/lazy')
  const type = pele.detectType(code)
  if (type !== 'flowchart' && type !== 'state') return null
  await pele.load(type)
  const model = pele.parse(code)
  if (model.type === 'flowchart') return fromFlowchart(model)
  if (model.type === 'state') return fromState(model)
  return null
}

export function nodeLabel(g: Graph, id: string): string {
  return g.nodes.find((n) => n.id === id)?.label || g.groups.find((x) => x.id === id)?.label || id
}

export function edgeLabel(g: Graph, e: GEdge): string {
  return `${nodeLabel(g, e.from)} → ${nodeLabel(g, e.to)}${e.label ? ` (${e.label})` : ''}`
}

// Whether a Mermaid source is one of the types drawn by GraphView, judged
// from its header line without loading Pele.
export function isGraphMermaid(code: string): boolean {
  const body = code
    .replace(/^\s*---[\s\S]*?---/, '')
    .replace(/^\s*%%.*$/gm, '')
    .trimStart()
  return /^(flowchart|graph|stateDiagram)\b/.test(body)
}
