import * as React from 'react'
import { Pencil, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export type Sent = { text: string; round: number }

// The human's own words once sent, styled like their comments in a thread.
export function SentBubble({
  text,
  round,
  label,
  onChange,
  className,
}: {
  text: string
  round: number
  label?: string
  onChange?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border bg-background/60 px-3 py-2', className)}>
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-human-soft text-human">
        <UserRound className="size-3" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">You</span>
          {label && ` · ${label}`} · sent in round {round}
        </div>
        <p className="text-sm whitespace-pre-wrap">{text}</p>
      </div>
      {onChange && (
        <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={onChange}>
          <Pencil /> Change
        </Button>
      )}
    </div>
  )
}

// A free-text answer the human may already have sent. Sent text is read-only
// and becomes editable only through Change, so in a later round an old answer
// is never mistaken for an empty box to fill in. A draft that replaces it says
// so and can be taken back.
export function AnswerText({
  value,
  sent,
  label,
  placeholder,
  multiline,
  onCommit,
}: {
  value: string
  sent?: Sent
  label?: string
  placeholder: string
  multiline?: boolean
  onCommit: (v: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(value)
  React.useEffect(() => setText(value), [value])
  const isSent = Boolean(sent?.text) && value === sent?.text
  const replacing = Boolean(sent?.text) && !isSent

  if (isSent && !editing) {
    return <SentBubble text={value} round={sent!.round} label={label} onChange={() => setEditing(true)} />
  }

  const props = {
    value: text,
    placeholder,
    autoFocus: editing,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setText(e.target.value),
    onBlur: () => {
      setEditing(false)
      if (text !== value) onCommit(text)
    },
  }
  return (
    <div className="flex flex-col gap-1.5">
      {replacing && (
        <p className="text-xs text-muted-foreground">
          Replaces what you sent in round {sent!.round}: <span className="line-through">“{sent!.text}”</span>
        </p>
      )}
      {multiline ? <Textarea {...props} className="min-h-16" /> : <Input {...props} />}
      {(editing || replacing) && (
        <div className="flex items-center gap-2">
          {replacing && value && <Badge variant="human">draft</Badge>}
          <Button
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            // Keep focus in the field so its blur doesn't commit what was typed.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setEditing(false)
              setText(sent!.text)
              if (value !== sent!.text) onCommit(sent!.text)
            }}
          >
            Keep what I sent
          </Button>
        </div>
      )}
    </div>
  )
}
