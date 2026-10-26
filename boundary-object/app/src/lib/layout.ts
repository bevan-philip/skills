import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api'
import type { Direction, GEdge, GNode, Graph } from './graph'

// Lays a Graph out with ELK's layered algorithm: orthogonal edges routed
// around nodes, edge labels given their own space, groups nested properly.
// Node sizes come from measuring each label in the page's font, so boxes fit
// their text and nothing overlaps.

export type Point = { x: number; y: number }
export type Box = { x: number; y: number; w: number; h: number }
export type LaidNode = Box & { node: GNode; lines: string[] }
export type LaidGroup = Box & { id: string; label: string; depth: number }
export type LaidEdge = { edge: GEdge; points: Point[]; label?: Box }
export type Layout = { direction: Direction; width: number; height: number; nodes: LaidNode[]; groups: LaidGroup[]; edges: LaidEdge[] }

const FONT = '500 13px "Geist Variable", ui-sans-serif, system-ui, sans-serif'
const LABEL_FONT = '400 11px "Geist Variable", ui-sans-serif, system-ui, sans-serif'
const LINE = 17
const MAX_TEXT = 190

let ctx: CanvasRenderingContext2D | null = null
function measure(text: string, font: string) {
  ctx ??= document.createElement('canvas').getContext('2d')
  if (!ctx) return text.length * 7
  ctx.font = font
  return ctx.measureText(text).width
}

// Greedy word wrap; a single word longer than the line stays whole.
function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (line && measure(next, FONT) > max) {
      lines.push(line)
      line = w
    } else line = next
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function sizeOf(n: GNode): { w: number; h: number; lines: string[] } {
  if (n.shape === 'start') return { w: 18, h: 18, lines: [] }
  if (n.shape === 'end') return { w: 22, h: 22, lines: [] }
  if (n.shape === 'bar') return { w: 72, h: 8, lines: [] }
  const lines = n.label ? wrap(n.label, MAX_TEXT) : []
  const text = Math.max(0, ...lines.map((l) => measure(l, FONT)))
  const icon = n.kind ? 22 : 0
  const textH = lines.length * LINE
  if (n.shape === 'diamond') {
    if (!lines.length) return { w: 28, h: 28, lines }
    // A diamond's inscribed rectangle is half its width and height.
    return { w: Math.max(96, text * 1.6 + 36), h: Math.max(56, textH * 2 + 20), lines }
  }
  if (n.shape === 'circle') {
    const d = Math.max(48, Math.max(text, textH) + 28)
    return { w: d, h: d, lines }
  }
  const padX = n.shape === 'pill' ? 20 : 14
  return { w: Math.max(72, Math.ceil(text + icon + padX * 2)), h: Math.max(38, textH + 20), lines }
}

const layered = (direction: Direction) => ({
  'elk.algorithm': 'layered',
  'elk.direction': direction,
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.spacing.nodeNodeBetweenLayers': '56',
  'elk.spacing.nodeNode': '28',
  'elk.spacing.edgeNode': '18',
  'elk.spacing.edgeEdge': '12',
  'elk.spacing.edgeLabel': '4',
  'elk.layered.spacing.edgeNodeBetweenLayers': '18',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  // Keep the agent's order where the layout allows, so the picture matches
  // the order things were described in.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  // In a cycle, the arrow that points back to something declared earlier is
  // the one drawn going backwards (Idle -> Active, not Active -> Idle).
  'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
  'elk.edgeLabels.placement': 'CENTER',
  'elk.json.shapeCoords': 'ROOT',
  'elk.json.edgeCoords': 'ROOT',
})

type Elk = { layout: (g: ElkNode) => Promise<ElkNode> }
let elk: Promise<Elk> | null = null
const getElk = () =>
  (elk ??= import('elkjs/lib/elk.bundled.js').then(({ default: ELK }) => new ELK() as unknown as Elk))

export async function layoutGraph(g: Graph, direction: Direction): Promise<Layout> {
  const sizes = new Map(g.nodes.map((n) => [n.id, sizeOf(n)]))
  const containers = new Map<string, ElkNode>()
  const root: ElkNode = {
    id: '__root',
    layoutOptions: { ...layered(direction), 'elk.padding': '[top=12,left=12,bottom=12,right=12]' },
    children: [],
    edges: [],
  }
  for (const grp of g.groups) {
    containers.set(grp.id, {
      id: grp.id,
      // Room at the top for the group's title.
      layoutOptions: { 'elk.padding': '[top=34,left=14,bottom=14,right=14]' },
      children: [],
    })
  }
  const into = (parent: string | undefined) => (parent && containers.get(parent)) || root
  for (const grp of g.groups) into(grp.parent).children!.push(containers.get(grp.id)!)
  for (const n of g.nodes) {
    const s = sizes.get(n.id)!
    into(n.parent).children!.push({ id: n.id, width: s.w, height: s.h })
  }
  // Groups with nothing in them still need a size.
  for (const c of containers.values()) {
    if (!c.children!.length) Object.assign(c, { width: Math.max(96, measure(g.groups.find((x) => x.id === c.id)!.label, FONT) + 28), height: 48 })
  }
  const known = new Set([...sizes.keys(), ...containers.keys()])
  const edges = g.edges.filter((e) => known.has(e.from) && known.has(e.to))
  root.edges = edges.map(
    (e): ElkExtendedEdge => ({
      id: e.id,
      sources: [e.from],
      targets: [e.to],
      labels: e.label
        ? [
            {
              text: e.label,
              width: Math.ceil(measure(e.label, LABEL_FONT)) + 12,
              height: 18,
              // The line runs through its label, so every label is visibly on its arrow.
              layoutOptions: { 'elk.edgeLabels.inline': 'true' },
            },
          ]
        : [],
    }),
  )

  const out = await (await getElk()).layout(root)

  const nodes: LaidNode[] = []
  const groups: LaidGroup[] = []
  const walk = (n: ElkNode, depth: number) => {
    for (const c of n.children ?? []) {
      const box = { x: c.x ?? 0, y: c.y ?? 0, w: c.width ?? 0, h: c.height ?? 0 }
      if (containers.has(c.id)) {
        groups.push({ ...box, id: c.id, label: g.groups.find((x) => x.id === c.id)!.label, depth })
        walk(c, depth + 1)
      } else {
        const node = g.nodes.find((x) => x.id === c.id)!
        nodes.push({ ...box, node, lines: sizes.get(c.id)!.lines })
      }
    }
  }
  walk(out, 0)

  // With INCLUDE_CHILDREN, ELK moves each edge into the container it ends up
  // routed in, so collect them from every level.
  const laidEdges: LaidEdge[] = []
  const byId = new Map(edges.map((e) => [e.id, e]))
  const collect = (n: ElkNode) => {
    for (const e of (n.edges ?? []) as ElkExtendedEdge[]) {
      const edge = byId.get(e.id)
      const sec = e.sections?.[0]
      if (!edge || !sec) continue
      const l = e.labels?.[0]
      laidEdges.push({
        edge,
        points: [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint],
        label: l && edge.label ? { x: l.x ?? 0, y: l.y ?? 0, w: l.width ?? 0, h: l.height ?? 0 } : undefined,
      })
    }
    for (const c of n.children ?? []) collect(c)
  }
  collect(out)

  return { direction, width: out.width ?? 0, height: out.height ?? 0, nodes, groups, edges: laidEdges }
}

// The zoom a layout is shown at in a frame: shrunk to fit, never below
// `minZoom`, never enlarged.
export function fitZoom(l: Layout, width: number, maxHeight: number, minZoom: number) {
  return Math.max(minZoom, Math.min(1, width / l.width, maxHeight / l.height))
}

// How much of a layout is readable in a frame: its zoom, times the share of it
// that fits without panning.
export function readability(l: Layout, width: number, maxHeight: number, minZoom: number) {
  const zoom = fitZoom(l, width, maxHeight, minZoom)
  const visibleW = Math.min(1, width / (l.width * zoom))
  const visibleH = Math.min(1, maxHeight / (l.height * zoom))
  return zoom * visibleW * visibleH
}
