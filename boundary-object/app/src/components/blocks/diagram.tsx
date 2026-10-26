import * as React from 'react'
import type { BlockOf } from '@/lib/schema'
import { fromDiagram } from '@/lib/graph'
import { GraphView } from '@/components/blocks/graph'

export function DiagramView({ block }: { block: BlockOf<'diagram'> }) {
  const graph = React.useMemo(() => fromDiagram(block), [block])
  return <GraphView blockId={block.id} title={block.title ?? 'Diagram'} graph={graph} />
}
