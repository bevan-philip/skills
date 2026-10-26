import * as React from 'react'
import { MessageSquareQuote } from 'lucide-react'
import { useBoard } from '@/components/board/context'
import { Composer } from '@/components/board/threads'

type Sel = { block: string; item?: string; quote: string; x: number; y: number }

// Select any text the agent wrote, then comment on exactly that passage.
export function SelectionCommenter() {
  const { addComment, doc } = useBoard()
  const [sel, setSel] = React.useState<Sel | null>(null)
  const [composing, setComposing] = React.useState(false)

  React.useEffect(() => {
    const onUp = (e: MouseEvent | KeyboardEvent) => {
      if ((e.target as Element)?.closest?.('[data-selection-ui]')) return
      setTimeout(() => {
        const s = window.getSelection()
        const text = s?.toString().trim() ?? ''
        if (!s || s.isCollapsed || text.length < 2) {
          if (!composing) setSel(null)
          return
        }
        const anchor = s.anchorNode instanceof Element ? s.anchorNode : s.anchorNode?.parentElement
        const host = anchor?.closest('[data-quote-block]')
        if (!host || (e.target as Element)?.closest?.('input, textarea, [contenteditable]')) return
        const block = host.getAttribute('data-quote-block')!
        const item = anchor?.closest('[data-quote-item]')?.getAttribute('data-quote-item') ?? undefined
        const r = s.getRangeAt(0).getBoundingClientRect()
        setComposing(false)
        setSel({ block, item, quote: text.slice(0, 600), x: r.left + r.width / 2, y: r.bottom })
      }, 0)
    }
    document.addEventListener('mouseup', onUp)
    document.addEventListener('keyup', onUp)
    return () => {
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('keyup', onUp)
    }
  }, [composing])

  if (!sel) return null
  const blk = doc.blocks.find((b) => b.id === sel.block)
  const left = Math.min(Math.max(12, sel.x - (composing ? 160 : 50)), window.innerWidth - (composing ? 332 : 112))
  return (
    <div data-selection-ui className="fixed z-50" style={{ left, top: Math.min(sel.y + 8, window.innerHeight - 220) }}>
      {composing ? (
        <div className="w-80 rounded-lg border bg-popover p-3 shadow-lg">
          <blockquote className="mb-2 line-clamp-3 border-l-2 border-human/50 pl-2 text-xs text-muted-foreground italic">
            {sel.quote}
          </blockquote>
          <Composer
            onSubmit={(text) => {
              addComment({ block: sel.block, item: sel.item, quote: sel.quote, label: blk?.title }, text)
              window.getSelection()?.removeAllRanges()
              setSel(null)
              setComposing(false)
            }}
            onCancel={() => {
              setSel(null)
              setComposing(false)
            }}
          />
        </div>
      ) : (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 rounded-full bg-human px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-human/90"
        >
          <MessageSquareQuote className="size-3.5" /> Comment on selection
        </button>
      )}
    </div>
  )
}
