import { z } from 'zod'

// The board is the boundary object. The agent writes `doc.json` (Board);
// the page writes `feedback.json` (FeedbackFile). Neither side edits the
// other's file, so there are no write races.

const id = z
  .string()
  .regex(/^[A-Za-z0-9][\w.-]*$/, 'ids use letters, digits, "-", "_" or "." and start with a letter or digit')

const md = z.string()

const base = {
  id,
  title: z.string().optional(),
  note: md.optional(),
  collapsed: z.boolean().optional(),
  // What the agent changed in this block and why; shown only while the block
  // differs from what the human saw when they last sent a round.
  changeNote: md.optional(),
}

export const changeStatus = z.enum(['added', 'changed', 'removed', 'unchanged'])

export const markdownBlock = z.object({ ...base, type: z.literal('markdown'), body: md })

export const sectionBlock = z.object({ ...base, type: z.literal('section'), title: z.string(), body: md.optional() })

export const calloutBlock = z.object({
  ...base,
  type: z.literal('callout'),
  tone: z.enum(['info', 'warning', 'risk', 'success']).default('info'),
  body: md,
})

export const decisionOption = z.object({
  id,
  label: z.string(),
  summary: md.optional(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
  recommended: z.boolean().optional(),
  // What the agent found by actually trying this option (a spike, a
  // prototype, a measurement), as opposed to what it predicts.
  evidence: md.optional(),
  // Measured or counted results, compared across options in one table.
  metrics: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
})

export const decisionBlock = z.object({
  ...base,
  type: z.literal('decision'),
  question: z.string(),
  context: md.optional(),
  options: z.array(decisionOption).min(2, 'a decision needs at least two options'),
  allowOther: z.boolean().default(true),
  // Whether this is cheap to change later, so the human knows where their
  // attention matters most.
  reversible: z.boolean().optional(),
})

export const questionBlock = z.object({
  ...base,
  type: z.literal('question'),
  prompt: z.string(),
  context: md.optional(),
  suggestions: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
})

export const confirmBlock = z.object({
  ...base,
  type: z.literal('confirm'),
  items: z.array(z.object({ id, text: z.string(), detail: md.optional() })).min(1),
})

export const stepStatus = z.enum(['todo', 'doing', 'done', 'skipped', 'changed', 'blocked'])

export const stepsBlock = z.object({
  ...base,
  type: z.literal('steps'),
  editable: z.boolean().default(true),
  items: z
    .array(
      z.object({
        id,
        title: z.string(),
        detail: md.optional(),
        files: z.array(z.string()).optional(),
        status: stepStatus.optional(),
        note: md.optional(),
      }),
    )
    .min(1),
})

export const nodeKind = z.enum([
  'service',
  'ui',
  'db',
  'store',
  'queue',
  'external',
  'actor',
  'file',
  'function',
  'note',
  'decision',
  'state',
  'start',
  'end',
])

export const diagramBlock = z.object({
  ...base,
  type: z.literal('diagram'),
  // auto: whichever of LR and TB reads best at the width of the page.
  direction: z.enum(['auto', 'LR', 'TB']).default('auto'),
  nodes: z
    .array(
      z.object({
        id,
        label: z.string(),
        kind: nodeKind.optional(),
        status: changeStatus.optional(),
        detail: md.optional(),
        group: z.string().optional(),
      }),
    )
    .min(1),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().optional(),
        status: changeStatus.optional(),
        dashed: z.boolean().optional(),
      }),
    )
    .default([]),
  groups: z.array(z.object({ id, label: z.string(), parent: z.string().optional() })).default([]),
})

export const mermaidBlock = z.object({ ...base, type: z.literal('mermaid'), code: z.string() })

export const imageBlock = z.object({
  ...base,
  type: z.literal('image'),
  src: z.string(),
  alt: z.string().optional(),
  caption: md.optional(),
  before: z.string().optional(),
})

// A knob on a mockup: the page sets the CSS custom property `var` on the
// mockup's root as the human moves it, and sends back the values they settle on.
export const mockupControl = z
  .object({
    id,
    label: z.string(),
    var: z.string().regex(/^--[\w-]+$/, 'a CSS custom property name such as "--shadow-blur"'),
    type: z.enum(['range', 'select', 'color']).default('range'),
    value: z.union([z.string(), z.number()]),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    unit: z.string().optional(),
    options: z.array(z.string()).optional(),
  })
  .refine((c) => c.type !== 'range' || (c.min !== undefined && c.max !== undefined), {
    message: 'a range control needs "min" and "max"',
  })
  .refine((c) => c.type !== 'select' || (c.options?.length ?? 0) > 1, { message: 'a select control needs two or more "options"' })

export const mockupBlock = z
  .object({
    ...base,
    type: z.literal('mockup'),
    html: z.string().optional(),
    src: z.string().optional(),
    height: z.number().int().min(120).max(2000).default(420),
    controls: z.array(mockupControl).optional(),
  })
  .refine((b) => Boolean(b.html) !== Boolean(b.src), { message: 'a mockup needs exactly one of "html" or "src"' })

export const filesBlock = z.object({
  ...base,
  type: z.literal('files'),
  items: z
    .array(
      z.object({
        path: z.string(),
        change: z.enum(['added', 'modified', 'deleted', 'renamed']),
        from: z.string().optional(),
        summary: md.optional(),
        diff: z.string().optional(),
      }),
    )
    .min(1),
})

export const codeBlock = z.object({
  ...base,
  type: z.literal('code'),
  code: z.string(),
  language: z.string().optional(),
  path: z.string().optional(),
  startLine: z.number().int().min(1).default(1),
  highlight: z.array(z.number().int()).optional(),
})

export const tableRow = z.union([
  z.array(z.string()),
  z.object({ id, cells: z.array(z.string()), highlight: z.boolean().optional() }),
])

export const tableBlock = z.object({
  ...base,
  type: z.literal('table'),
  columns: z.array(z.string()).min(1),
  rows: z.array(tableRow).min(1),
})

export const block = z.discriminatedUnion('type', [
  markdownBlock,
  sectionBlock,
  calloutBlock,
  decisionBlock,
  questionBlock,
  confirmBlock,
  stepsBlock,
  diagramBlock,
  mermaidBlock,
  imageBlock,
  mockupBlock,
  filesBlock,
  codeBlock,
  tableBlock,
])

export const replyStatus = z.enum(['resolved', 'declined', 'question', 'noted'])

export const board = z
  .object({
    $schema: z.string().optional(),
    title: z.string(),
    kind: z.enum(['plan', 'report']).default('plan'),
    summary: md.optional(),
    status: z.string().optional(),
    blocks: z.array(block),
    replies: z.record(z.string(), z.object({ text: md, status: replyStatus.optional() })).default({}),
  })
  .superRefine((b, ctx) => {
    const seen = new Set<string>()
    b.blocks.forEach((blk, i) => {
      if (seen.has(blk.id)) {
        ctx.addIssue({ code: 'custom', path: ['blocks', i, 'id'], message: `duplicate block id "${blk.id}"` })
      }
      seen.add(blk.id)
      const dupes = (ids: string[], path: (string | number)[]) => {
        const s = new Set<string>()
        ids.forEach((x, j) => {
          if (s.has(x)) ctx.addIssue({ code: 'custom', path: ['blocks', i, ...path, j], message: `duplicate id "${x}"` })
          s.add(x)
        })
      }
      if (blk.type === 'steps' || blk.type === 'confirm') dupes(blk.items.map((x) => x.id), ['items'])
      if (blk.type === 'decision') dupes(blk.options.map((x) => x.id), ['options'])
      if (blk.type === 'mockup' && blk.controls) dupes(blk.controls.map((x) => x.id), ['controls'])
      if (blk.type === 'diagram') {
        dupes(blk.nodes.map((n) => n.id), ['nodes'])
        const nodes = new Set(blk.nodes.map((n) => n.id))
        const groups = new Set(blk.groups.map((g) => g.id))
        blk.edges.forEach((e, j) => {
          for (const end of ['from', 'to'] as const) {
            if (!nodes.has(e[end])) {
              ctx.addIssue({ code: 'custom', path: ['blocks', i, 'edges', j, end], message: `no node with id "${e[end]}"` })
            }
          }
        })
        blk.nodes.forEach((n, j) => {
          if (n.group && !groups.has(n.group)) {
            ctx.addIssue({ code: 'custom', path: ['blocks', i, 'nodes', j, 'group'], message: `no group with id "${n.group}" in "groups"` })
          }
        })
        const parentOf = new Map(blk.groups.map((g) => [g.id, g.parent]))
        blk.groups.forEach((g, j) => {
          if (g.parent && !groups.has(g.parent)) {
            ctx.addIssue({ code: 'custom', path: ['blocks', i, 'groups', j, 'parent'], message: `no group with id "${g.parent}"` })
          }
          const chain = new Set([g.id])
          for (let p = g.parent; p; p = parentOf.get(p)) {
            if (chain.has(p)) {
              ctx.addIssue({ code: 'custom', path: ['blocks', i, 'groups', j, 'parent'], message: 'groups nest in a cycle' })
              break
            }
            chain.add(p)
          }
        })
      }
    })
  })

export type Board = z.infer<typeof board>
export type Block = z.infer<typeof block>
export type BlockOf<T extends Block['type']> = Extract<Block, { type: T }>
export type ReplyStatus = z.infer<typeof replyStatus>

// ---- Feedback (written by the page) ----

export const target = z.object({
  block: z.string(),
  item: z.string().optional(),
  label: z.string().optional(),
  quote: z.string().optional(),
  pin: z.object({ x: z.number(), y: z.number() }).optional(),
  element: z.object({ selector: z.string(), tag: z.string().optional(), text: z.string().optional() }).optional(),
  line: z.number().int().optional(),
})

export const confirmValue = z.enum(['yes', 'no', 'unsure'])

export const feedbackItem = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('comment'), target, text: z.string().min(1), replyTo: z.string().optional() }),
  z.object({
    id: z.string(),
    type: z.literal('choice'),
    block: z.string(),
    option: z.string().optional(),
    other: z.string().optional(),
    note: z.string().optional(),
    // Instead of picking: "find out first" (explore the options for real and
    // ask again) or "your call" (the agent decides).
    defer: z.enum(['explore', 'delegate']).optional(),
  }),
  z.object({ id: z.string(), type: z.literal('answer'), block: z.string(), text: z.string() }),
  z.object({
    id: z.string(),
    type: z.literal('confirm'),
    block: z.string(),
    item: z.string(),
    value: confirmValue,
    note: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('step-strike'),
    block: z.string(),
    item: z.string(),
    struck: z.boolean(),
    reason: z.string().optional(),
  }),
  z.object({ id: z.string(), type: z.literal('step-edit'), block: z.string(), item: z.string(), title: z.string().min(1) }),
  z.object({
    id: z.string(),
    type: z.literal('step-add'),
    block: z.string(),
    after: z.string().nullable(),
    title: z.string().min(1),
  }),
  z.object({ id: z.string(), type: z.literal('step-order'), block: z.string(), order: z.array(z.string()) }),
  // The values the human settled on for a mockup's controls, by control id.
  z.object({ id: z.string(), type: z.literal('tune'), block: z.string(), values: z.record(z.string(), z.string()) }),
])

export const verdict = z.enum(['approve', 'changes', 'comment'])

export const draft = z.object({
  items: z.array(feedbackItem).default([]),
  verdict: verdict.optional(),
  overall: z.string().optional(),
})

export const round = z.object({
  n: z.number().int(),
  at: z.string(),
  revision: z.number().int(),
  verdict,
  overall: z.string().optional(),
  items: z.array(feedbackItem),
  deliveredAt: z.string().optional(),
})

export const feedbackFile = z.object({
  draft: draft.default({ items: [] }),
  rounds: z.array(round).default([]),
})

export type Target = z.infer<typeof target>
export type FeedbackItem = z.infer<typeof feedbackItem>
export type Draft = z.infer<typeof draft>
export type Round = z.infer<typeof round>
export type Verdict = z.infer<typeof verdict>
export type FeedbackFile = z.infer<typeof feedbackFile>

// Thrown when the human approves a revision older than the current doc.
export const STALE_REVISION = 'STALE_REVISION'

export type BoardView = {
  id: string
  doc: Board | null
  error: string | null
  revision: number
  updatedAt: string
  baseline: Board | null
  feedback: FeedbackFile
  listening: boolean
}

export type BoardSummary = {
  id: string
  title: string
  kind: 'plan' | 'report'
  status?: string
  revision: number
  rounds: number
  updatedAt: string
  error: string | null
  project?: string
}

export function formatIssues(err: z.ZodError): string {
  return err.issues
    .map((i) => {
      const path = i.path.length ? i.path.join('.') : '(root)'
      return `- ${path}: ${i.message}`
    })
    .join('\n')
}
