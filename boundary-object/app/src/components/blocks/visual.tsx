import * as React from 'react'
import { Crosshair, RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { BlockOf, Target } from '@/lib/schema'
import { threadsFor } from '@/lib/state'
import { assetUrl, useBoard } from '@/components/board/context'
import { Markdown } from '@/components/board/markdown'
import { Composer, pinNumbers } from '@/components/board/threads'
import { mermaidGraph, type Graph } from '@/lib/graph'
import { GraphView } from '@/components/blocks/graph'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mark } from '@/components/board/marks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'

// ---- Pointing: click a spot on a visual to attach a comment to it ----

type Pending = { x: number; y: number; extra?: Partial<Target> }

export function PointToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Toggle
      size="sm"
      pressed={on}
      onPressedChange={onChange}
      className="text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
    >
      <Crosshair />
      <span className="sr-only sm:not-sr-only">{on ? 'Click to place' : 'Point'}</span>
    </Toggle>
  )
}

function Pins({ block, pending, onCancel, onSave }: {
  block: string
  pending: Pending | null
  onCancel: () => void
  onSave: (text: string) => void
}) {
  const { state } = useBoard()
  const threads = threadsFor(state, block)
  const nums = pinNumbers(threads)
  return (
    <>
      {threads
        .filter((t) => t.root.target.pin)
        .map((t) => (
          <a
            key={t.root.id}
            href={`#c-${t.root.id}`}
            title={t.root.text}
            className="absolute z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-human text-[11px] font-semibold text-white shadow-md transition-transform hover:scale-110"
            style={{ left: `${t.root.target.pin!.x * 100}%`, top: `${t.root.target.pin!.y * 100}%` }}
          >
            {nums.get(t.root.id)}
          </a>
        ))}
      {pending && (
        // Portalled and collision-aware, so a pin near the bottom or edge of
        // a visual doesn't leave the composer clipped by the card.
        <Popover open onOpenChange={(open) => !open && onCancel()}>
          <PopoverAnchor asChild>
            <span
              className="absolute z-20 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-human shadow-md"
              style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }}
            />
          </PopoverAnchor>
          <PopoverContent className="w-72" onClick={(e) => e.stopPropagation()}>
            {pending.extra?.label && (
              <div className="mb-2 truncate text-xs text-muted-foreground">
                On <span className="font-medium text-foreground">{pending.extra.label}</span>
              </div>
            )}
            {pending.extra?.element && (
              <div className="mb-2 truncate font-mono text-[11px] text-muted-foreground">
                &lt;{pending.extra.element.tag}&gt; {pending.extra.element.text}
              </div>
            )}
            <Composer placeholder="What about this spot?" onSubmit={onSave} onCancel={onCancel} />
          </PopoverContent>
        </Popover>
      )}
    </>
  )
}

function usePointing(block: string) {
  const { addComment } = useBoard()
  const [on, setOn] = React.useState(false)
  const [pending, setPending] = React.useState<Pending | null>(null)
  const place = (p: Pending) => {
    setPending(p)
    setOn(false)
  }
  const save = (text: string) => {
    if (!pending) return
    addComment({ block, pin: { x: pending.x, y: pending.y }, ...pending.extra }, text)
    setPending(null)
  }
  return { on, setOn, pending, place, save, cancel: () => setPending(null) }
}

function relative(e: React.MouseEvent, el: HTMLElement) {
  const r = el.getBoundingClientRect()
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
}

// ---- Mermaid, rendered by Pele (https://pele.run) ----

function describePeleError(e: unknown) {
  const err = e as { message?: string; line?: number; column?: number }
  const at = err.line ? ` (line ${err.line}${err.column ? `, column ${err.column}` : ''})` : ''
  return `${err.message ?? String(e)}${at}`
}

// Flowcharts and state diagrams are parsed by Pele but laid out and drawn by
// GraphView, like the agent's own diagrams.
export function MermaidGraph({ block }: { block: BlockOf<'mermaid'> }) {
  const [graph, setGraph] = React.useState<Graph | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    let live = true
    mermaidGraph(block.code)
      .then((g) => live && (setGraph(g), setError(g ? null : 'not a flowchart or state diagram')))
      .catch((e: unknown) => live && setError(describePeleError(e)))
    return () => {
      live = false
    }
  }, [block.code])
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="font-mono text-xs whitespace-pre-wrap">This diagram could not be rendered: {error}</AlertDescription>
      </Alert>
    )
  }
  if (!graph) return <Skeleton className="h-60" />
  return <GraphView blockId={block.id} title={block.title ?? 'Diagram'} graph={graph} />
}

export function MermaidView({ block, point }: { block: BlockOf<'mermaid'>; point: ReturnType<typeof usePointing> }) {
  const [error, setError] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(false)
  const host = React.useRef<HTMLDivElement>(null)
  const target = React.useRef<HTMLDivElement>(null)

  // Pele owns this element's children: it sizes the layout to the container,
  // reads fonts from CSS and re-lays out on resize. Colours come from the
  // --pele-* variables in styles.css, so theme switches need no re-render.
  React.useEffect(() => {
    let live = true
    let mounted: { destroy(): void } | undefined
    import('pele/lazy')
      .then(async ({ mountAsync }) => {
        if (!live || !target.current) return
        const m = await mountAsync(target.current, block.code, {
          idPrefix: `d-${block.id.replace(/[^\w-]/g, '_')}-`,
          onRender: () => live && setError(null),
          onError: (e) => live && setError(describePeleError(e)),
        })
        if (!live) return m.destroy()
        mounted = m
        setError(m.error ? describePeleError(m.error) : null)
        setReady(true)
      })
      .catch((e: unknown) => live && setError(describePeleError(e)))
    return () => {
      live = false
      mounted?.destroy()
    }
  }, [block.code, block.id])

  return (
    <div
      ref={host}
      className={cn('relative rounded-lg border bg-background p-4', point.on && 'cursor-crosshair')}
      onClick={(e) => {
        if (!point.on || !host.current) return
        const t = e.target as Element
        const hit = t.closest('.pele-node, .pele-cluster, .pele-note, .pele-edge-label, .pele-label, text')
        const label = hit?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80)
        point.place({ ...relative(e, host.current), extra: label ? { label } : undefined })
      }}
    >
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription className="font-mono text-xs whitespace-pre-wrap">This diagram could not be rendered: {error}</AlertDescription>
        </Alert>
      )}
      {!ready && !error && <Skeleton className="h-40" />}
      <div ref={target} className="pele-host" />
      <Pins block={block.id} pending={point.pending} onCancel={point.cancel} onSave={point.save} />
    </div>
  )
}

// ---- Image (with optional before/after) ----

export function ImageView({ block, point }: { block: BlockOf<'image'>; point: ReturnType<typeof usePointing> }) {
  const { id, view } = useBoard()
  const [side, setSide] = React.useState<'after' | 'before'>('after')
  const frame = React.useRef<HTMLDivElement>(null)
  const showing = side === 'before' && block.before ? block.before : block.src
  return (
    <figure className="flex flex-col gap-2">
      {block.before && (
        <Tabs value={side} onValueChange={(v) => setSide(v as 'after' | 'before')}>
          <TabsList>
            <TabsTrigger value="before">Before</TabsTrigger>
            <TabsTrigger value="after">After</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <div className="flex justify-center rounded-lg border bg-muted/30 p-2">
        <div
          ref={frame}
          className={cn('relative inline-block', point.on && side === 'after' && 'cursor-crosshair')}
          onClick={(e) => {
            if (!point.on || side !== 'after' || !frame.current) return
            point.place(relative(e, frame.current))
          }}
        >
          <img src={assetUrl(id, showing, view.revision)} alt={block.alt ?? block.title ?? ''} className="block max-h-[70vh] max-w-full rounded" />
          {side === 'after' && <Pins block={block.id} pending={point.pending} onCancel={point.cancel} onSave={point.save} />}
        </div>
      </div>
      {block.caption && (
        <figcaption>
          <Markdown className="text-muted-foreground" body={block.caption} />
        </figcaption>
      )}
    </figure>
  )
}

// ---- Mockup: agent-written HTML in a sandbox; pick elements to comment on ----

const base = `*,*::before,*::after{box-sizing:border-box}body{margin:0;padding:16px;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;color:#18181b;background:#fff}`

const picker = `<script>(() => {
  let on = false, hl = null
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #3b6cf6;background:rgba(59,108,246,.08);border-radius:3px;z-index:2147483647;display:none'
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(box))
  const sel = (el) => {
    const parts = []
    while (el && el.nodeType === 1 && el !== document.body && parts.length < 6) {
      let p = el.tagName.toLowerCase()
      if (el.id) { parts.unshift(p + '#' + CSS.escape(el.id)); break }
      if (el.classList[0]) p += '.' + CSS.escape(el.classList[0])
      const sib = el.parentElement ? [...el.parentElement.children].filter(c => c.tagName === el.tagName) : []
      if (sib.length > 1) p += ':nth-of-type(' + (sib.indexOf(el) + 1) + ')'
      parts.unshift(p); el = el.parentElement
    }
    if (el === document.body) parts.unshift('body')
    return parts.join(' > ')
  }
  addEventListener('message', (e) => { if (e.data && e.data.type === 'boundary-mode') { on = e.data.on; document.body.style.cursor = on ? 'crosshair' : ''; if (!on) box.style.display = 'none' } })
  addEventListener('message', (e) => { if (e.data && e.data.type === 'boundary-vars') for (const [k, v] of Object.entries(e.data.vars)) document.documentElement.style.setProperty(k, v) })
  document.addEventListener('mouseover', (e) => {
    if (!on) return
    hl = e.target; const r = hl.getBoundingClientRect()
    Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' })
  }, true)
  document.addEventListener('click', (e) => {
    if (!on) return
    e.preventDefault(); e.stopPropagation()
    const el = e.target, r = el.getBoundingClientRect()
    const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 80)
    parent.postMessage({ type: 'boundary-pick', selector: sel(el), tag: el.tagName.toLowerCase(), text,
      x: (r.left + r.width / 2) / innerWidth, y: (r.top + Math.min(r.height, 24) / 2) / innerHeight }, '*')
  }, true)
})()</script>`

function wrap(html: string) {
  if (/<html[\s>]/i.test(html)) return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${picker}</body>`) : html + picker
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}</style></head><body>${html}${picker}</body></html>`
}

export function MockupView({ block, point }: { block: BlockOf<'mockup'>; point: ReturnType<typeof usePointing> }) {
  const { id, view } = useBoard()
  const revision = view.revision
  const frame = React.useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = React.useState<string | null>(block.html ?? null)

  React.useEffect(() => {
    if (block.html) return setHtml(block.html)
    if (!block.src) return
    fetch(assetUrl(id, block.src, revision))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
      .then(setHtml)
      .catch(() => setHtml(`<p style="color:#b91c1c">Could not load ${block.src}</p>`))
  }, [block.html, block.src, id, revision])

  React.useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: 'boundary-mode', on: point.on }, '*')
  }, [point.on])

  const controls = block.controls ?? []
  const [vars, setVars] = React.useState<Record<string, string>>({})
  const pushVars = React.useCallback((v: Record<string, string>) => {
    frame.current?.contentWindow?.postMessage({ type: 'boundary-vars', vars: v }, '*')
  }, [])
  React.useEffect(() => pushVars(vars), [vars, pushVars])

  React.useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== 'boundary-pick') return
      const { selector, tag, text, x, y } = e.data
      point.place({ x, y, extra: { element: { selector, tag, text }, label: text || `<${tag}>` } })
    }
    addEventListener('message', onMsg)
    return () => removeEventListener('message', onMsg)
  }, [point])

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <div className="flex items-center gap-1.5 border-b bg-muted px-3 py-1.5">
          <span className="size-2.5 rounded-full bg-removed/50" />
          <span className="size-2.5 rounded-full bg-changed/50" />
          <span className="size-2.5 rounded-full bg-added/50" />
          <span className="ml-2 text-[11px] text-muted-foreground">mockup — not the real app</span>
        </div>
        <div className="relative">
          {html !== null && (
            <iframe
              ref={frame}
              title={block.title ?? 'mockup'}
              sandbox="allow-scripts"
              srcDoc={wrap(html)}
              onLoad={() => {
                frame.current?.contentWindow?.postMessage({ type: 'boundary-mode', on: point.on }, '*')
                pushVars(vars)
              }}
              className="block w-full bg-white"
              style={{ height: block.height }}
            />
          )}
          <Pins block={block.id} pending={point.pending} onCancel={point.cancel} onSave={point.save} />
        </div>
      </div>
      {controls.length > 0 && <Controls block={block} onVars={setVars} />}
    </div>
  )
}

// ---- Mockup controls: the human tunes the design directly ----

type Control = NonNullable<BlockOf<'mockup'>['controls']>[number]

const cssValue = (c: Control, v: string | number) => (c.type === 'range' ? `${v}${c.unit ?? ''}` : String(v))

function Controls({ block, onVars }: { block: BlockOf<'mockup'>; onVars: (v: Record<string, string>) => void }) {
  const { state, tune } = useBoard()
  const controls = block.controls ?? []
  const defaults = React.useMemo(() => Object.fromEntries(controls.map((c) => [c.id, cssValue(c, c.value)])), [controls])
  const chosen = state.tunes.get(block.id)
  // What the sliders show: the agent's values with the human's on top, while
  // they drag; committed to the draft when they let go.
  const [live, setLive] = React.useState<Record<string, string>>(() => ({ ...defaults, ...chosen?.values }))
  React.useEffect(() => setLive({ ...defaults, ...chosen?.values }), [defaults, chosen])
  React.useEffect(() => onVars(Object.fromEntries(controls.map((c) => [c.var, live[c.id] ?? defaults[c.id]]))), [live, controls, defaults, onVars])

  const commit = (next: Record<string, string>) => {
    // Only what differs from the agent's own values goes back to it.
    tune(block.id, Object.fromEntries(Object.entries(next).filter(([id, v]) => defaults[id] !== v)))
  }
  const set = (c: Control, v: string, done: boolean) => {
    const next = { ...live, [c.id]: v }
    setLive(next)
    if (done) commit(next)
  }
  const changed = controls.some((c) => (live[c.id] ?? defaults[c.id]) !== defaults[c.id])

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border bg-muted/30 p-3.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SlidersHorizontal className="size-3.5 text-muted-foreground" />
        <span className="font-medium">Tune it</span>
        <span className="text-muted-foreground">The mockup follows as you move these; the agent gets the values you settle on.</span>
        <span className="ml-auto flex items-center gap-2">
          {chosen && (chosen.round === null ? <Mark tone="human">draft</Mark> : <span className="text-muted-foreground">sent in round {chosen.round}</span>)}
          {changed && (
            <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => commit(defaults)}>
              <RotateCcw /> Agent's values
            </Button>
          )}
        </span>
      </div>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {controls.map((c) => {
          const v = live[c.id] ?? defaults[c.id]
          const mine = v !== defaults[c.id]
          return (
            <div key={c.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <label htmlFor={`ctl-${block.id}-${c.id}`} className={cn('font-medium', mine && 'text-human')}>
                  {c.label}
                </label>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {v}
                  {mine && <span className="ml-1.5 line-through opacity-60">{defaults[c.id]}</span>}
                </span>
              </div>
              {c.type === 'range' && (
                <Slider
                  id={`ctl-${block.id}-${c.id}`}
                  min={c.min}
                  max={c.max}
                  step={c.step ?? 1}
                  value={[parseFloat(v)]}
                  onValueChange={([n]) => set(c, cssValue(c, n), false)}
                  onValueCommit={([n]) => set(c, cssValue(c, n), true)}
                />
              )}
              {c.type === 'select' && (
                <Select value={v} onValueChange={(x) => set(c, x, true)}>
                  <SelectTrigger id={`ctl-${block.id}-${c.id}`} size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {c.options!.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {c.type === 'color' && (
                <Input
                  id={`ctl-${block.id}-${c.id}`}
                  type="color"
                  value={v}
                  className="h-8 w-16 p-1"
                  onChange={(e) => set(c, e.target.value, false)}
                  onBlur={(e) => set(c, e.target.value, true)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { usePointing }
