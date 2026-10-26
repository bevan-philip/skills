import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// The board's own colour language on top of stock shadcn badges: the human's
// marks in one hue, and the agent's changes in added / changed / removed.
export type Tone = 'human' | 'added' | 'changed' | 'removed'

const tones: Record<Tone, string> = {
  human: 'bg-human-soft text-human',
  added: 'bg-added-soft text-added',
  changed: 'bg-changed-soft text-changed',
  removed: 'bg-removed-soft text-removed',
}

export function Mark({ tone, className, ...props }: React.ComponentProps<typeof Badge> & { tone: Tone }) {
  return <Badge variant="secondary" className={cn(tones[tone], className)} {...props} />
}

// A badge in either a tone or one of shadcn's own variants.
export type MarkKind = Tone | 'outline' | 'secondary'

export function KindBadge({ kind, ...props }: React.ComponentProps<typeof Badge> & { kind: MarkKind }) {
  return kind === 'outline' || kind === 'secondary' ? <Badge variant={kind} {...props} /> : <Mark tone={kind} {...props} />
}
