import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import type { BlockOf } from '@/lib/schema'
import { threadsFor } from '@/lib/state'
import { useBoard } from '@/components/board/context'
import { Markdown } from '@/components/board/markdown'
import { ItemComment } from '@/components/board/threads'
import { ItemChange } from '@/components/board/block-frame'
import { KindBadge, type MarkKind } from '@/components/board/marks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Line = { text: string; kind: 'add' | 'del' | 'ctx' | 'hunk'; n?: number }

// File headers (`--- a/x`, `+++ b/x`, `index …`) only appear before a hunk;
// inside one, a line like `--- old comment` is a removed `-- old comment`.
const FILE_HEADER = /^(diff --git |index |--- |\+\+\+ |new file mode|deleted file mode|old mode|new mode|similarity index|rename from|rename to|Binary files)/

function parseDiff(diff: string): Line[] {
  let oldN = 1
  let newN = 1
  let inHunk = false
  const out: Line[] = []
  for (const l of diff.replace(/\n$/, '').split('\n')) {
    if (l.startsWith('diff --git ')) {
      inHunk = false
      continue
    }
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l)
    if (h) {
      oldN = Number(h[1])
      newN = Number(h[2])
      inHunk = true
      out.push({ text: l, kind: 'hunk' })
      continue
    }
    if (!inHunk && FILE_HEADER.test(l)) continue
    if (l.startsWith('\\')) continue // "\ No newline at end of file"
    if (l.startsWith('+')) out.push({ text: l.slice(1), kind: 'add', n: newN++ })
    else if (l.startsWith('-')) out.push({ text: l.slice(1), kind: 'del', n: oldN++ })
    else {
      oldN++
      out.push({ text: l.slice(1), kind: 'ctx', n: newN++ })
    }
  }
  return out
}

function Lines({
  block,
  item,
  label,
  lines,
  highlight,
}: {
  block: string
  item?: string
  label: string
  lines: Line[]
  highlight?: Set<number>
}) {
  const { state } = useBoard()
  const commented = new Set(
    threadsFor(state, block)
      .filter((t) => t.root.target.item === item && t.root.target.line !== undefined)
      .map((t) => t.root.target.line),
  )
  return (
    <div className="overflow-x-auto rounded-md border bg-background font-mono text-[12.5px] leading-[1.6]">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((l, i) =>
            l.kind === 'hunk' ? (
              <tr key={i} className="bg-muted/60 text-muted-foreground">
                <td colSpan={3} className="px-3 py-0.5 text-[11px]">
                  {l.text}
                </td>
              </tr>
            ) : (
              <tr
                key={i}
                className={cn(
                  'group',
                  l.kind === 'add' && 'bg-added-soft/60',
                  l.kind === 'del' && 'bg-removed-soft/60',
                  l.n !== undefined && highlight?.has(l.n) && 'bg-changed-soft/70',
                )}
              >
                <td className="w-10 px-2 text-right align-top text-muted-foreground/70 select-none">
                  {l.kind === 'del' ? '' : l.n}
                </td>
                <td className="w-full px-2 align-top whitespace-pre">
                  <span className={cn('mr-2 select-none', l.kind === 'ctx' && 'invisible')}>
                    {l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}
                  </span>
                  {l.text || ' '}
                </td>
                <td className="w-8 pr-1 align-top">
                  {l.n !== undefined && (
                    <ItemComment
                      block={block}
                      item={item}
                      label={`${label}:${l.n}${l.kind === 'del' ? ' (removed line)' : ''}`}
                      extra={{ line: l.n, quote: l.text.trim().slice(0, 200) }}
                      className={cn('h-5', commented.has(l.n) && 'opacity-100')}
                    />
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

const changeBadge: Record<string, { short: string; kind: MarkKind }> = {
  added: { short: 'A', kind: 'added' },
  modified: { short: 'M', kind: 'changed' },
  deleted: { short: 'D', kind: 'removed' },
  renamed: { short: 'R', kind: 'secondary' },
}

export function FilesView({ block }: { block: BlockOf<'files'> }) {
  const [open, setOpen] = React.useState<Set<string>>(new Set())
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {block.items.map((f) => {
        const b = changeBadge[f.change]
        const expanded = open.has(f.path)
        const stats = f.diff ? parseDiff(f.diff) : []
        const adds = stats.filter((l) => l.kind === 'add').length
        const dels = stats.filter((l) => l.kind === 'del').length
        return (
          <li key={f.path} className="group flex flex-col gap-2 px-3.5 py-3" data-quote-item={f.path}>
            <div className="flex items-start gap-2.5">
              <KindBadge kind={b.kind} className="mt-0.5 w-5 px-0 font-mono" title={f.change}>
                {b.short}
              </KindBadge>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 font-mono text-[13px]">
                  {f.from && <span className="text-muted-foreground line-through">{f.from}</span>}
                  {f.from && <span className="text-muted-foreground">→</span>}
                  <span className="font-medium break-all">{f.path}</span>
                  <ItemChange block={block.id} item={f.path} />
                  {f.diff && (
                    <span className="text-[11px]">
                      <span className="text-added">+{adds}</span> <span className="text-removed">−{dels}</span>
                    </span>
                  )}
                </div>
                {f.summary && <Markdown className="mt-1 text-muted-foreground" body={f.summary} />}
                {f.diff && (
                  <Button
                    variant="link"
                    size="xs"
                    className="mt-1 h-auto px-0 text-muted-foreground hover:text-foreground"
                    aria-expanded={expanded}
                    onClick={() =>
                      setOpen((o) => {
                        const n = new Set(o)
                        if (n.has(f.path)) n.delete(f.path)
                        else n.add(f.path)
                        return n
                      })
                    }
                  >
                    <ChevronRight className={cn('transition-transform', expanded && 'rotate-90')} />
                    {expanded ? 'Hide diff' : 'Show diff'}
                  </Button>
                )}
              </div>
              <ItemComment block={block.id} item={f.path} label={f.path} />
            </div>
            {expanded && f.diff && <Lines block={block.id} item={f.path} label={f.path} lines={stats} />}
          </li>
        )
      })}
    </ul>
  )
}

export function CodeView({ block }: { block: BlockOf<'code'> }) {
  const lines: Line[] = block.code
    .replace(/\n$/, '')
    .split('\n')
    .map((text, i) => ({ text, kind: 'ctx', n: block.startLine + i }))
  return (
    <div className="flex flex-col gap-1.5">
      {(block.path || block.language) && (
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          {block.path && <span>{block.path}</span>}
          {block.language && <Badge variant="outline">{block.language}</Badge>}
        </div>
      )}
      <Lines
        block={block.id}
        label={block.path ?? block.title ?? 'code'}
        lines={lines}
        highlight={new Set(block.highlight ?? [])}
      />
    </div>
  )
}
