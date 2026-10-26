import * as React from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import {
  Box,
  Cloud,
  Database,
  FileText,
  FunctionSquare,
  HardDrive,
  Layers,
  Monitor,
  StickyNote,
  User,
  type LucideIcon,
} from 'lucide-react'
import type { BlockOf } from '@/lib/schema'
import { threadsFor } from '@/lib/state'
import { useBoard } from '@/components/board/context'
import { Markdown } from '@/components/board/markdown'
import { Composer } from '@/components/board/threads'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/board/theme'
import { cn } from '@/lib/utils'

type DNode = BlockOf<'diagram'>['nodes'][number]

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
  removed: 'border-removed bg-removed-soft opacity-75 [&_.label]:line-through',
  unchanged: '',
}

const edgeColor: Record<string, string> = {
  added: 'var(--added)',
  changed: 'var(--changed)',
  removed: 'var(--removed)',
}

type NodeData = { node: DNode; comments: number; selected: boolean; dir: 'LR' | 'TB' }

function BoxNode({ data }: NodeProps<Node<NodeData>>) {
  const { node, comments, selected, dir } = data
  const Icon = node.kind ? kindIcon[node.kind] : null
  const [tp, sp] = dir === 'LR' ? [Position.Left, Position.Right] : [Position.Top, Position.Bottom]
  return (
    <div
      className={cn(
        'relative flex h-full w-full cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-[13px] shadow-xs transition-shadow hover:shadow-md',
        node.kind === 'note' && 'border-dashed bg-muted/60',
        node.kind === 'actor' && 'rounded-full',
        node.status && statusClass[node.status],
        selected && 'ring-2 ring-human',
      )}
    >
      <Handle type="target" position={tp} className="!border-0 !bg-transparent" />
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <span className="label line-clamp-2 leading-tight font-medium">{node.label}</span>
      {comments > 0 && (
        <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-human text-[10px] font-semibold text-white">
          {comments}
        </span>
      )}
      {node.detail && <span className="absolute right-1.5 bottom-1 size-1 rounded-full bg-muted-foreground/50" />}
      <Handle type="source" position={sp} className="!border-0 !bg-transparent" />
    </div>
  )
}

function GroupNode({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div className="h-full w-full rounded-xl border border-dashed border-foreground/20 bg-muted/30">
      <div className="px-3 pt-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {data.label}
      </div>
    </div>
  )
}

const nodeTypes = { box: BoxNode, group: GroupNode }

function size(n: DNode) {
  const w = Math.min(220, Math.max(120, n.label.length * 7.4 + (n.kind ? 56 : 32)))
  return { w, h: n.label.length * 7.4 > 190 ? 58 : 44 }
}

function layout(block: BlockOf<'diagram'>) {
  const g = new dagre.graphlib.Graph({ compound: true, multigraph: true })
  const lr = block.direction === 'LR'
  g.setGraph({ rankdir: block.direction, nodesep: lr ? 28 : 40, ranksep: lr ? 70 : 56, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const grp of block.groups) g.setNode(grp.id, { label: grp.label })
  for (const n of block.nodes) {
    const s = size(n)
    g.setNode(n.id, { width: s.w, height: s.h })
    if (n.group) g.setParent(n.id, n.group)
  }
  block.edges.forEach((e, i) => {
    // Edge labels need room between ranks.
    g.setEdge(e.from, e.to, { width: e.label ? Math.min(160, e.label.length * 6.5) : 0, height: e.label ? 18 : 0 }, `e${i}`)
  })
  dagre.layout(g)
  let maxX = 0
  let maxY = 0
  const groups: Node[] = block.groups.flatMap((grp) => {
    const box = g.node(grp.id)
    if (!box?.width) return []
    const pad = 14
    const top = 26
    maxX = Math.max(maxX, box.x + box.width / 2 + pad)
    maxY = Math.max(maxY, box.y + box.height / 2 + pad)
    return [
      {
        id: `group:${grp.id}`,
        type: 'group',
        position: { x: box.x - box.width / 2 - pad, y: box.y - box.height / 2 - top },
        data: { label: grp.label },
        style: { width: box.width + pad * 2, height: box.height + top + pad },
        selectable: false,
        draggable: false,
        zIndex: -1,
      },
    ]
  })
  const pos = new Map(
    block.nodes.map((n) => {
      const p = g.node(n.id)
      const s = size(n)
      maxX = Math.max(maxX, p.x + s.w / 2)
      maxY = Math.max(maxY, p.y + s.h / 2)
      return [n.id, { x: p.x - s.w / 2, y: p.y - s.h / 2, ...s }]
    }),
  )
  return { groups, pos, width: maxX + 16, height: maxY + 16 }
}

export function DiagramView({ block }: { block: BlockOf<'diagram'> }) {
  const { state, addComment } = useBoard()
  const theme = useTheme()
  const [selected, setSelected] = React.useState<string | null>(null)
  const [composing, setComposing] = React.useState(false)
  const laid = React.useMemo(() => layout(block), [block])
  const threads = threadsFor(state, block.id)
  const countFor = (id: string) => threads.filter((t) => t.root.target.item === id).length

  const nodes: Node[] = [
    ...laid.groups,
    ...block.nodes.map((n) => {
      const p = laid.pos.get(n.id)!
      return {
        id: n.id,
        type: 'box',
        position: { x: p.x, y: p.y },
        data: { node: n, comments: countFor(n.id), selected: selected === n.id, dir: block.direction },
        style: { width: p.w, height: p.h },
        draggable: false,
        connectable: false,
      } satisfies Node<NodeData>
    }),
  ]
  const edges: Edge[] = block.edges.map((e, i) => {
    const color = e.status ? edgeColor[e.status] : undefined
    return {
      id: `e${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      type: 'smoothstep',
      animated: e.status === 'added',
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: color ?? 'var(--muted-foreground)' },
      style: {
        stroke: color,
        strokeWidth: e.status && e.status !== 'unchanged' ? 2 : 1.25,
        strokeDasharray: e.dashed || e.status === 'removed' ? '5 4' : undefined,
      },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 4,
    }
  })

  const height = Math.round(Math.min(640, Math.max(220, laid.height * (laid.width > 860 ? 860 / laid.width : 1) + 40)))
  const sel = block.nodes.find((n) => n.id === selected)
  const statuses = [...new Set(block.nodes.map((n) => n.status).filter((s) => s && s !== 'unchanged'))]

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border bg-background" style={{ height }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={theme}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1.1 }}
          minZoom={0.3}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnScroll={false}
          panOnScroll={false}
          preventScrolling={false}
          onNodeClick={(_, n) => {
            if (n.type !== 'box') return
            setSelected((s) => (s === n.id ? null : n.id))
            setComposing(false)
          }}
          onPaneClick={() => setSelected(null)}
        >
          <Background gap={18} size={1} color="var(--border)" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {statuses.map((s) => (
          <Badge key={s} variant={s as 'added' | 'changed' | 'removed'}>
            {s}
          </Badge>
        ))}
        <span>Click a box for details or to comment on it.</span>
      </div>
      {sel && (
        <div className="flex flex-col gap-2 rounded-lg border border-human/30 bg-human-soft/20 p-3.5">
          <div className="flex items-center gap-2">
            <span className="font-medium">{sel.label}</span>
            {sel.kind && <Badge variant="outline">{sel.kind}</Badge>}
            {sel.status && sel.status !== 'unchanged' && <Badge variant={sel.status}>{sel.status}</Badge>}
            <div className="ml-auto">
              {!composing && (
                <Button size="xs" variant="outline" onClick={() => setComposing(true)}>
                  Comment on this
                </Button>
              )}
            </div>
          </div>
          {sel.detail ? (
            <Markdown body={sel.detail} />
          ) : (
            <p className="text-sm text-muted-foreground">No extra detail from the agent.</p>
          )}
          {composing && (
            <Composer
              placeholder={`What about “${sel.label}”?`}
              onSubmit={(text) => {
                addComment({ block: block.id, item: sel.id, label: sel.label }, text)
                setComposing(false)
              }}
              onCancel={() => setComposing(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}
