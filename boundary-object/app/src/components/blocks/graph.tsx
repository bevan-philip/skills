import * as React from 'react'
import { Controls, ReactFlow, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Box,
  Cloud,
  Database,
  FileText,
  FunctionSquare,
  HardDrive,
  Layers,
  Maximize2,
  Monitor,
  StickyNote,
  User,
  type LucideIcon,
} from 'lucide-react'
import { edgeLabel, nodeLabel, type Direction, type Graph, type Status } from '@/lib/graph'
import { fitZoom, layoutGraph, readability, type LaidEdge, type LaidGroup, type LaidNode, type Layout, type Point } from '@/lib/layout'
import { threadsFor } from '@/lib/state'
import { useBoard } from '@/components/board/context'
import { Markdown } from '@/components/board/markdown'
import { Composer } from '@/components/board/threads'
import { ItemChange } from '@/components/board/block-frame'
import { Mark } from '@/components/board/marks'
import { useTheme } from '@/components/board/theme'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Boxes and arrows, laid out by ELK (see lib/layout.ts) and drawn at a size
// people can read: the diagram is never shrunk below MIN_ZOOM to fit the
// card. When it doesn't fit it pans, and Expand opens it full screen.

const MIN_ZOOM = 0.8
const MAX_HEIGHT = 600

const kindIcon: Record<string, LucideIcon> = {
  service: Box,
  ui: Monitor,
  db: Database,
  store: HardDrive,
  queue: Layers,
  external: Cloud,
  actor: User,
  file: FileText,
  function: FunctionSquare,
  note: StickyNote,
}

const statusClass: Record<string, string> = {
  added: 'border-added bg-added-soft',
  changed: 'border-changed bg-changed-soft',
  removed: 'border-removed bg-removed-soft opacity-80 [&_.label]:line-through',
}

const statusStroke: Record<string, string> = {
  added: 'var(--added)',
  changed: 'var(--changed)',
  removed: 'var(--removed)',
}

type Selection = { kind: 'node' | 'edge'; id: string } | null

type Ctx = {
  selected: Selection
  select: (s: Selection) => void
  comments: (id: string) => number
  changed: (id: string) => 'new' | 'changed' | undefined
  marker: string
}
const GraphCtx = React.createContext<Ctx | null>(null)
const useGraph = () => React.useContext(GraphCtx)!

// ---- Nodes ----

// React Flow turns pointer events off on its node wrappers when nodes are
// neither selectable nor draggable, so each box turns them back on itself.
function NodeBox({ data }: NodeProps<Node<{ laid: LaidNode }>>) {
  const { laid } = data
  const n = laid.node
  const g = useGraph()
  const selected = g.selected?.kind === 'node' && g.selected.id === n.id
  const comments = g.comments(n.id)
  const change = g.changed(n.id)
  const Icon = n.kind ? kindIcon[n.kind] : undefined
  const click = (e: React.MouseEvent) => {
    e.stopPropagation()
    g.select(selected ? null : { kind: 'node', id: n.id })
  }
  const badges = (
    <>
      {comments > 0 && (
        <span className="absolute -top-2 -right-2 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
          {comments}
        </span>
      )}
      {change && (
        <span
          title={change === 'new' ? 'New since your last round' : 'Updated since your last round'}
          className={cn('absolute -top-1 -left-1 z-10 size-2.5 rounded-full ring-2 ring-background', change === 'new' ? 'bg-added' : 'bg-changed')}
        />
      )}
    </>
  )
  const ring = selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'

  if (n.shape === 'start' || n.shape === 'end' || n.shape === 'bar') {
    return (
      <div onClick={click} className={cn('pointer-events-auto relative flex size-full cursor-pointer items-center justify-center', ring, 'rounded-full')}>
        {n.shape === 'start' && <span className="size-full rounded-full bg-foreground" />}
        {n.shape === 'end' && (
          <span className="flex size-full items-center justify-center rounded-full border-2 border-foreground">
            <span className="size-3 rounded-full bg-foreground" />
          </span>
        )}
        {n.shape === 'bar' && <span className="size-full rounded-sm bg-foreground" />}
        {badges}
      </div>
    )
  }

  const text = (
    <span className="label text-center leading-[17px] font-medium">
      {laid.lines.map((l, i) => (
        <span key={i} className="block whitespace-nowrap">
          {l}
        </span>
      ))}
    </span>
  )

  if (n.shape === 'diamond') {
    const fill = n.status && n.status !== 'unchanged' ? `var(--${n.status}-soft)` : 'var(--card)'
    const stroke = n.status && n.status !== 'unchanged' ? statusStroke[n.status] : 'var(--border)'
    return (
      <div onClick={click} className={cn('pointer-events-auto relative flex size-full cursor-pointer items-center justify-center text-[13px]', n.status === 'removed' && 'opacity-80 [&_.label]:line-through')}>
        <svg className="absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${laid.w} ${laid.h}`} aria-hidden>
          <polygon
            points={`${laid.w / 2},1 ${laid.w - 1},${laid.h / 2} ${laid.w / 2},${laid.h - 1} 1,${laid.h / 2}`}
            fill={fill}
            stroke={selected ? 'var(--primary)' : stroke}
            strokeWidth={selected ? 2.5 : 1.25}
            strokeLinejoin="round"
          />
        </svg>
        <span className="relative">{text}</span>
        {badges}
      </div>
    )
  }

  return (
    <div
      onClick={click}
      className={cn(
        'pointer-events-auto relative flex size-full cursor-pointer items-center justify-center gap-2 border bg-card px-3 text-[13px] text-card-foreground shadow-xs transition-shadow hover:shadow-md',
        n.shape === 'box' && 'rounded-md',
        n.shape === 'round' && 'rounded-xl',
        (n.shape === 'pill' || n.shape === 'circle') && 'rounded-full',
        n.shape === 'note' && 'rounded-sm border-dashed bg-muted/70 text-muted-foreground',
        n.status && statusClass[n.status],
        ring,
      )}
    >
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      {text}
      {n.detail && <span className="absolute right-1.5 bottom-1 size-1 rounded-full bg-muted-foreground/60" title="Has details" />}
      {badges}
    </div>
  )
}

function GroupBox({ data }: NodeProps<Node<{ group: LaidGroup }>>) {
  const { group } = data
  return (
    <div className={cn('size-full rounded-xl border border-dashed border-foreground/20', group.depth % 2 ? 'bg-background/60' : 'bg-muted/40')}>
      <div className="truncate px-3 pt-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</div>
    </div>
  )
}

// ---- Edges: one SVG layer under the nodes, drawn from ELK's routes ----

function roundedPath(points: Point[], r = 8) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const [a, b, c] = [points[i - 1], points[i], points[i + 1]]
    const len1 = Math.hypot(b.x - a.x, b.y - a.y)
    const len2 = Math.hypot(c.x - b.x, c.y - b.y)
    const k = Math.min(r, len1 / 2, len2 / 2)
    const p1 = { x: b.x - ((b.x - a.x) / len1) * k, y: b.y - ((b.y - a.y) / len1) * k }
    const p2 = { x: b.x + ((c.x - b.x) / len2) * k, y: b.y + ((c.y - b.y) / len2) * k }
    d += ` L ${p1.x} ${p1.y} Q ${b.x} ${b.y} ${p2.x} ${p2.y}`
  }
  const last = points[points.length - 1]
  return `${d} L ${last.x} ${last.y}`
}

const markerFor = (s?: Status) => (s && s !== 'unchanged' ? s : 'default')

function EdgeLayer({ data }: NodeProps<Node<{ edges: LaidEdge[]; width: number; height: number }>>) {
  const g = useGraph()
  return (
    <div className="pointer-events-none relative" style={{ width: data.width, height: data.height }}>
      <svg className="absolute inset-0 overflow-visible" width={data.width} height={data.height}>
        <defs>
          {(['default', 'added', 'changed', 'removed'] as const).map((s) => (
            <marker
              key={s}
              id={`${g.marker}-${s}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={s === 'default' ? 'var(--muted-foreground)' : statusStroke[s]} />
            </marker>
          ))}
        </defs>
        {data.edges.map(({ edge: e, points }) => {
          const d = roundedPath(points)
          const selected = g.selected?.kind === 'edge' && g.selected.id === e.id
          const color = selected ? 'var(--primary)' : e.status && e.status !== 'unchanged' ? statusStroke[e.status] : 'var(--muted-foreground)'
          return (
            <g key={e.id}>
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeOpacity={e.status && e.status !== 'unchanged' ? 1 : 0.75}
                strokeWidth={selected ? 2.5 : e.thick ? 2.5 : e.status && e.status !== 'unchanged' ? 2 : 1.4}
                strokeDasharray={e.dashed ? '5 4' : undefined}
                markerEnd={e.arrow ? `url(#${g.marker}-${selected ? 'default' : markerFor(e.status)})` : undefined}
              />
              {/* A wide invisible stroke so edges are easy to click. */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                className="pointer-events-auto cursor-pointer"
                onClick={(ev) => {
                  ev.stopPropagation()
                  g.select(selected ? null : { kind: 'edge', id: e.id })
                }}
              >
                <title>{e.label ?? 'Click to comment on this connection'}</title>
              </path>
            </g>
          )
        })}
      </svg>
      {data.edges.map(({ edge: e, label }) => {
        if (!label || !e.label) return null
        const selected = g.selected?.kind === 'edge' && g.selected.id === e.id
        const comments = g.comments(e.id)
        return (
          <button
            key={e.id}
            type="button"
            onClick={(ev) => {
              ev.stopPropagation()
              g.select(selected ? null : { kind: 'edge', id: e.id })
            }}
            className={cn(
              'pointer-events-auto absolute flex items-center justify-center rounded border bg-card px-1 text-[11px] leading-none whitespace-nowrap text-muted-foreground hover:text-foreground',
              selected && 'border-primary text-foreground',
              comments > 0 && 'border-primary/50 text-primary',
            )}
            style={{ left: label.x, top: label.y, width: label.w, height: label.h }}
          >
            {e.label}
          </button>
        )
      })}
    </div>
  )
}

// Not React Flow's built-in 'group' type, which brings its own styles.
const nodeTypes = { box: NodeBox, cluster: GroupBox, edges: EdgeLayer }

function flowNodes(l: Layout): Node[] {
  return [
    ...l.groups.map((grp) => ({
      id: `group:${grp.id}`,
      type: 'cluster',
      position: { x: grp.x, y: grp.y },
      data: { group: grp },
      style: { width: grp.w, height: grp.h },
      selectable: false,
      zIndex: grp.depth,
    })),
    {
      id: '__edges',
      type: 'edges',
      position: { x: 0, y: 0 },
      data: { edges: l.edges, width: l.width, height: l.height },
      selectable: false,
      zIndex: 50,
    },
    ...l.nodes.map((n) => ({
      id: n.node.id,
      type: 'box',
      position: { x: n.x, y: n.y },
      data: { laid: n },
      style: { width: n.w, height: n.h },
      zIndex: 100,
    })),
  ].map((n) => ({ ...n, draggable: false, connectable: false, focusable: false }))
}

function Canvas({ layout, fit, onPane }: { layout: Layout; fit: { zoom: number; x: number } | null; onPane: () => void }) {
  const theme = useTheme()
  const nodes = React.useMemo(() => flowNodes(layout), [layout])
  const free = fit === null
  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      nodeTypes={nodeTypes}
      colorMode={theme}
      defaultViewport={fit ? { x: fit.x, y: 0, zoom: fit.zoom } : undefined}
      fitView={free}
      fitViewOptions={{ padding: 0.06, maxZoom: 1.25 }}
      minZoom={0.25}
      maxZoom={2.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      zoomOnScroll={free}
      zoomOnDoubleClick={free}
      panOnScroll={false}
      preventScrolling={free}
      proOptions={{ hideAttribution: true }}
      onPaneClick={onPane}
    >
      {free && <Controls showInteractive={false} position="bottom-right" />}
    </ReactFlow>
  )
}

// ---- The block ----

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = React.useState(0)
  React.useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return w
}

function useLayouts(graph: Graph | null) {
  const [layouts, setLayouts] = React.useState<Layout[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!graph) return
    let live = true
    const other: Record<Direction, Direction> = { RIGHT: 'DOWN', LEFT: 'DOWN', DOWN: 'RIGHT', UP: 'RIGHT' }
    const dirs: Direction[] = graph.direction ? [graph.direction, other[graph.direction]] : ['RIGHT', 'DOWN']
    // Measure labels only once the page font is in, or boxes come out too small.
    document.fonts.ready
      .then(() => Promise.all(dirs.map((d) => layoutGraph(graph, d))))
      .then((ls) => live && (setLayouts(ls), setError(null)))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [graph])
  return { layouts, error }
}

export function GraphView({ blockId, title, graph }: { blockId: string; title: string; graph: Graph }) {
  const { state, diff, addComment } = useBoard()
  const frame = React.useRef<HTMLDivElement>(null)
  const width = useWidth(frame)
  const { layouts, error } = useLayouts(graph)
  const [selected, setSelected] = React.useState<Selection>(null)
  const [composing, setComposing] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)
  const marker = React.useId().replace(/:/g, '')

  const threads = threadsFor(state, blockId)
  const ctx: Ctx = {
    selected,
    select: (s) => {
      setSelected(s)
      setComposing(false)
    },
    comments: (id) => threads.filter((t) => t.root.target.item === id).length,
    changed: (id) => diff.items[blockId]?.[id],
    marker,
  }

  // Pick the direction that shows most of the diagram at a readable size. The
  // first layout is the one asked for, and the other has to beat it clearly.
  const layout = React.useMemo(() => {
    if (!layouts || !width) return null
    const margin = graph.direction ? 1.25 : 1.05
    return layouts.reduce((best, l) =>
      readability(l, width, MAX_HEIGHT, MIN_ZOOM) > readability(best, width, MAX_HEIGHT, MIN_ZOOM) * margin ? l : best,
    )
  }, [layouts, width, graph.direction])
  const zoom = layout ? fitZoom(layout, width, MAX_HEIGHT, MIN_ZOOM) : 1
  const height = layout ? Math.min(MAX_HEIGHT, Math.ceil(layout.height * zoom)) : 240
  const overflows = layout ? layout.width * zoom > width + 1 || layout.height * zoom > MAX_HEIGHT + 1 : false
  const fit = layout ? { zoom, x: Math.max(0, (width - layout.width * zoom) / 2) } : null

  const selNode = selected?.kind === 'node' ? graph.nodes.find((n) => n.id === selected.id) : undefined
  const selEdge = selected?.kind === 'edge' ? graph.edges.find((e) => e.id === selected.id) : undefined
  const selLabel = selNode ? nodeLabel(graph, selNode.id) : selEdge ? edgeLabel(graph, selEdge) : ''
  const statuses = [...new Set([...graph.nodes, ...graph.edges].map((n) => n.status).filter((s) => s && s !== 'unchanged'))]

  return (
    <GraphCtx.Provider value={ctx}>
      <div className="flex flex-col gap-3">
        <div ref={frame} className="relative overflow-hidden rounded-lg border bg-background" style={{ height }}>
          {error ? (
            <p className="p-4 font-mono text-xs text-destructive">This diagram could not be laid out: {error}</p>
          ) : layout && fit ? (
            // Re-mount when the fit changes so the viewport follows the card's width.
            <Canvas key={`${layout.direction}-${fit.zoom.toFixed(3)}-${Math.round(fit.x)}`} layout={layout} fit={fit} onPane={() => ctx.select(null)} />
          ) : (
            <Skeleton className="size-full rounded-none" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {statuses.map((s) => (
            <Mark key={s} tone={s as 'added' | 'changed' | 'removed'}>
              {s}
            </Mark>
          ))}
          <span>
            Click a box or an arrow to comment on it.
            {overflows && ' Drag to see the rest, or expand it.'}
          </span>
          <Button size="xs" variant="outline" className="ml-auto" onClick={() => setExpanded(true)} disabled={!layout}>
            <Maximize2 /> Expand
          </Button>
        </div>
        {selected && (selNode || selEdge) && (
          <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-human-soft/20 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{selLabel}</span>
              {selNode?.kind && <Badge variant="outline">{selNode.kind}</Badge>}
              {selEdge && <Badge variant="outline">connection</Badge>}
              {(selNode ?? selEdge)?.status && (selNode ?? selEdge)!.status !== 'unchanged' && (
                <Mark tone={(selNode ?? selEdge)!.status as 'added' | 'changed' | 'removed'}>{(selNode ?? selEdge)!.status}</Mark>
              )}
              <ItemChange block={blockId} item={selected.id} />
              <div className="ml-auto">
                {!composing && (
                  <Button size="xs" variant="outline" onClick={() => setComposing(true)}>
                    Comment on this
                  </Button>
                )}
              </div>
            </div>
            {selNode?.detail && <Markdown body={selNode.detail} />}
            {composing && (
              <Composer
                placeholder={`What about “${selLabel}”?`}
                onSubmit={(text) => {
                  addComment({ block: blockId, item: selected.id, label: selLabel }, text)
                  setComposing(false)
                }}
                onCancel={() => setComposing(false)}
              />
            )}
          </div>
        )}
      </div>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[90vh] flex-col gap-3 sm:max-w-[min(96vw,1600px)]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Scroll to zoom, drag to pan. Click a box or an arrow, then close this to comment on it.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
            {layout && <Canvas layout={layout} fit={null} onPane={() => ctx.select(null)} />}
          </div>
        </DialogContent>
      </Dialog>
    </GraphCtx.Provider>
  )
}
