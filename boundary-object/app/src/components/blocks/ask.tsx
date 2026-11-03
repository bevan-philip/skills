import type { BlockOf } from '@/lib/schema'
import { useBoard } from '@/components/board/context'
import { Markdown } from '@/components/board/markdown'
import { Button } from '@/components/ui/button'

// One question in a grilling round: the agent's recommended answer, which
// "Yes" accepts, and the alternatives.
export function AskView({ block }: { block: BlockOf<'ask'> }) {
  const { state, choose } = useBoard()
  const current = state.choices.get(block.id)
  const rec = block.options.find((o) => o.recommended)!
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] font-medium">{block.question}</p>
      {block.context && <Markdown className="text-muted-foreground" body={block.context} />}
      <div className="flex items-center gap-2">
        <span className="flex-1">{rec.label}</span>
        <Button size="sm" variant={current?.option === rec.id ? 'default' : 'outline'} onClick={() => choose(block.id, { option: rec.id })}>
          Yes
        </Button>
      </div>
    </div>
  )
}
