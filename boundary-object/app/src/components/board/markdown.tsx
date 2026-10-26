import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { assetUrl, useOptionalBoard } from '@/components/board/context'
import { cn } from '@/lib/utils'

export function Markdown({ body, className, large }: { body: string; className?: string; large?: boolean }) {
  const board = useOptionalBoard()
  return (
    <div className={cn('md', large && 'md-lg', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _n, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          img: ({ node: _n, src, ...props }) => (
            <img {...props} src={board && typeof src === 'string' ? assetUrl(board.id, src) : (src as string)} />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}
