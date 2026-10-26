import type { Block } from '@/lib/schema'
import { BlockFrame } from '@/components/board/block-frame'
import { Markdown } from '@/components/board/markdown'
import { BlockThreads } from '@/components/board/threads'
import { CalloutView, ConfirmView, DecisionView, MarkdownView, QuestionView, TableView } from '@/components/blocks/basic'
import { StepsView } from '@/components/blocks/steps'
import { DiagramView } from '@/components/blocks/diagram'
import { ImageView, MermaidGraph, MermaidView, MockupView, PointToggle, usePointing } from '@/components/blocks/visual'
import { isGraphMermaid } from '@/lib/graph'
import { CodeView, FilesView } from '@/components/blocks/code'

function Visual({ block, needsInput }: { block: Extract<Block, { type: 'mermaid' | 'image' | 'mockup' }>; needsInput: boolean }) {
  const point = usePointing(block.id)
  return (
    <BlockFrame
      block={block}
      needsInput={needsInput}
      wide={block.type === 'mockup'}
      toolbar={<PointToggle on={point.on} onChange={point.setOn} />}
    >
      {block.type === 'mermaid' && <MermaidView block={block} point={point} />}
      {block.type === 'image' && <ImageView block={block} point={point} />}
      {block.type === 'mockup' && <MockupView block={block} point={point} />}
    </BlockFrame>
  )
}

export function Section({ block }: { block: Extract<Block, { type: 'section' }> }) {
  return (
    <div id={`b-${block.id}`} className="flex scroll-mt-20 flex-col gap-3 pt-6">
      <div data-quote-block={block.id}>
        <h2 className="text-xl font-semibold tracking-tight">{block.title}</h2>
        {block.body && <Markdown className="mt-1.5 text-muted-foreground" body={block.body} />}
      </div>
      <BlockThreads block={block.id} />
    </div>
  )
}

export function BlockView({ block, needsInput }: { block: Block; needsInput: boolean }) {
  switch (block.type) {
    case 'section':
      return <Section block={block} />
    case 'mermaid':
      if (isGraphMermaid(block.code)) {
        return (
          <BlockFrame block={block} needsInput={needsInput} wide>
            <MermaidGraph block={block} />
          </BlockFrame>
        )
      }
      return <Visual block={block} needsInput={needsInput} />
    case 'image':
    case 'mockup':
      return <Visual block={block} needsInput={needsInput} />
    case 'diagram':
      return (
        <BlockFrame block={block} needsInput={needsInput} wide>
          <DiagramView block={block} />
        </BlockFrame>
      )
  }
  const body = (() => {
    switch (block.type) {
      case 'markdown':
        return <MarkdownView block={block} />
      case 'callout':
        return <CalloutView block={block} />
      case 'decision':
        return <DecisionView block={block} />
      case 'question':
        return <QuestionView block={block} />
      case 'confirm':
        return <ConfirmView block={block} />
      case 'steps':
        return <StepsView block={block} />
      case 'files':
        return <FilesView block={block} />
      case 'code':
        return <CodeView block={block} />
      case 'table':
        return <TableView block={block} />
    }
  })()
  return (
    <BlockFrame block={block} needsInput={needsInput}>
      {body}
    </BlockFrame>
  )
}
