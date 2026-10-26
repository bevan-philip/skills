import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { render as renderMermaid } from 'pele'
import {
  board as boardSchema,
  draft as draftSchema,
  feedbackFile as feedbackSchema,
  formatIssues,
  type Board,
  type BlockChange,
  type BoardSummary,
  type BoardView,
  type Draft,
  type FeedbackFile,
  type Round,
  type Verdict,
  STALE_REVISION,
} from '@/lib/schema'

// One server per project. Boards live in BOUNDARY_ROOT/<id>/:
//   doc.json       written by the agent
//   feedback.json  written by this server on behalf of the human
//   history/N.json snapshot of doc.json at revision N
//   assets/        anything the doc references (screenshots, mockups)

export const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/

type Listener = (event: string, data: unknown) => void

type Entry = {
  id: string
  dir: string
  doc: Board | null
  error: string | null
  revision: number
  updatedAt: string
  feedback: FeedbackFile
  watcher?: fs.FSWatcher
  reloadTimer?: ReturnType<typeof setTimeout>
  lock: Promise<unknown>
  docLock: Promise<unknown>
}

type Hub = {
  root: string
  entries: Map<string, Promise<Entry>>
  listeners: Map<string, Set<Listener>>
  waiters: Map<string, Set<() => void>>
  lastPoll: Map<string, number>
  rootWatcher?: fs.FSWatcher
}

const g = globalThis as typeof globalThis & { __boundaryHub?: Hub }

function hub(): Hub {
  if (!g.__boundaryHub) {
    const root = path.resolve(process.env.BOUNDARY_ROOT ?? '.boundary')
    fs.mkdirSync(root, { recursive: true })
    g.__boundaryHub = { root, entries: new Map(), listeners: new Map(), waiters: new Map(), lastPoll: new Map() }
    try {
      g.__boundaryHub.rootWatcher = fs.watch(root, () => emit('*', 'boards', null))
    } catch {
      // Watching is a convenience; the index page also refetches on focus.
    }
  }
  return g.__boundaryHub
}

export function rootDir() {
  return hub().root
}

function emit(id: string, event: string, data: unknown) {
  for (const fn of hub().listeners.get(id) ?? []) fn(event, data)
}

export function subscribe(id: string, fn: Listener) {
  const h = hub()
  if (!h.listeners.has(id)) h.listeners.set(id, new Set())
  h.listeners.get(id)!.add(fn)
  return () => h.listeners.get(id)?.delete(fn)
}

const sha = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12)

function blockHashes(doc: Board | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const b of doc?.blocks ?? []) out[b.id] = sha(JSON.stringify(b))
  return out
}

// Turn zod paths like blocks.3.options into blocks[3 "storage"].options so
// the agent can find the offending block without counting.
function describeError(raw: unknown, err: import('zod').ZodError): string {
  const blocks = (raw as { blocks?: { id?: string }[] })?.blocks
  return formatIssues({
    ...err,
    issues: err.issues.map((issue) => {
      const i = issue.path[1]
      if (issue.path[0] !== 'blocks' || typeof i !== 'number' || !blocks?.[i]?.id) return issue
      return { ...issue, path: ['blocks', `${i}(${blocks[i].id})`, ...issue.path.slice(2)] }
    }),
  } as import('zod').ZodError)
}

export function parseDoc(text: string): { doc: Board | null; error: string | null; raw: unknown } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { doc: null, error: `doc.json is not valid JSON: ${(e as Error).message}`, raw: null }
  }
  const r = boardSchema.safeParse(raw)
  if (!r.success) return { doc: null, error: describeError(raw, r.error), raw }
  const diagramErrors = mermaidErrors(r.data)
  if (diagramErrors) return { doc: null, error: diagramErrors, raw }
  return { doc: r.data, error: null, raw }
}

// Pele renders synchronously and needs no DOM, so a diagram that won't render
// is caught here, by `boundary check`, before the human ever sees it.
function mermaidErrors(doc: Board): string | null {
  const out: string[] = []
  doc.blocks.forEach((b, i) => {
    if (b.type !== 'mermaid') return
    try {
      renderMermaid(b.code)
    } catch (e) {
      const err = e as { message?: string; line?: number; column?: number }
      const at = err.line ? `line ${err.line}${err.column ? `, column ${err.column}` : ''}: ` : ''
      const msg = (err.message ?? String(e)).replace(/\s*\n+\s*/g, ' ').trim()
      out.push(`- blocks.${i}(${b.id}).code: ${at}${msg}`)
    }
  })
  return out.length ? out.join('\n') : null
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

async function writeAtomic(file: string, data: string) {
  const tmp = `${file}.${process.pid}.tmp`
  await fsp.writeFile(tmp, data)
  await fsp.rename(tmp, file)
}

function historyDir(e: Entry) {
  return path.join(e.dir, 'history')
}

async function latestSnapshot(e: Entry): Promise<number> {
  try {
    const files = await fsp.readdir(historyDir(e))
    return files.reduce((m, f) => Math.max(m, Number.parseInt(f, 10) || 0), 0)
  } catch {
    return 0
  }
}

async function snapshotAt(e: Entry, rev: number): Promise<Board | null> {
  if (rev <= 0) return null
  try {
    return parseDoc(await fsp.readFile(path.join(historyDir(e), `${rev}.json`), 'utf8')).doc
  } catch {
    return null
  }
}

// Re-read doc.json; when its content differs from the latest snapshot, store
// a new revision. Returns true when the visible doc changed.
async function reload(e: Entry): Promise<boolean> {
  let text: string
  try {
    text = await fsp.readFile(path.join(e.dir, 'doc.json'), 'utf8')
  } catch {
    const changed = e.error === null
    e.doc = null
    e.error = 'doc.json not found'
    return changed
  }
  const { doc, error, raw } = parseDoc(text)
  if (!doc) {
    // Keep showing the last good doc; surface the error alongside it. After a
    // restart the last good doc is the newest snapshot.
    const changed = e.error !== error
    e.error = error
    if (!e.doc) {
      e.revision = await latestSnapshot(e)
      e.doc = await snapshotAt(e, e.revision)
    }
    return changed
  }
  const normal = JSON.stringify(raw, null, 2)
  const rev = await latestSnapshot(e)
  let prev: string | null = null
  if (rev > 0) prev = await fsp.readFile(path.join(historyDir(e), `${rev}.json`), 'utf8').catch(() => null)
  let changed = e.error !== null || e.doc === null
  if (prev !== normal) {
    await fsp.mkdir(historyDir(e), { recursive: true })
    await fsp.writeFile(path.join(historyDir(e), `${rev + 1}.json`), normal)
    e.revision = rev + 1
    e.updatedAt = new Date().toISOString()
    changed = true
  } else {
    e.revision = rev
  }
  e.doc = doc
  e.error = null
  return changed
}

export function boardExists(id: string) {
  return SLUG.test(id) && fs.existsSync(path.join(hub().root, id, 'doc.json'))
}

function entry(id: string): Promise<Entry> {
  const h = hub()
  const existing = h.entries.get(id)
  if (existing) return existing
  if (!SLUG.test(id)) return Promise.reject(new Error(`invalid board id "${id}"`))
  // Cache the promise, not the result, so concurrent first loads share one watcher.
  const p = load(id, path.join(h.root, id))
  h.entries.set(id, p)
  p.catch(() => h.entries.delete(id))
  return p
}

async function load(id: string, dir: string): Promise<Entry> {
  const e: Entry = {
    id,
    dir,
    doc: null,
    error: null,
    revision: 0,
    updatedAt: new Date().toISOString(),
    feedback: { draft: { items: [] }, rounds: [] },
    lock: Promise.resolve(),
    docLock: Promise.resolve(),
  }
  const parsed = feedbackSchema.safeParse(await readJson(path.join(dir, 'feedback.json'), {}))
  if (parsed.success) e.feedback = parsed.data
  try {
    e.updatedAt = (await fsp.stat(path.join(dir, 'doc.json'))).mtime.toISOString()
  } catch {}
  await reload(e)
  try {
    e.watcher = fs.watch(dir, (_ev, file) => {
      if (file !== 'doc.json') return
      clearTimeout(e.reloadTimer)
      // Editors and agents often write in two steps; wait for the file to settle.
      e.reloadTimer = setTimeout(() => void refresh(e), 120)
    })
  } catch {}
  return e
}

// Re-read doc.json and tell open pages when it changed. Every reload after
// the first goes through here (the watcher, `check`, a submission), so
// whichever reload notices a change is the one that announces it.
function refresh(e: Entry): Promise<boolean> {
  const run = () => reload(e)
  const next = e.docLock.then(run, run)
  e.docLock = next.catch(() => {})
  return next.then((changed) => {
    if (changed) {
      emit(e.id, 'doc', { revision: e.revision })
      emit('*', 'boards', null)
    }
    return changed
  })
}

// Serialise read-modify-write on feedback.json per board.
function locked<T>(e: Entry, fn: () => Promise<T>): Promise<T> {
  const next = e.lock.then(fn, fn)
  e.lock = next.catch(() => {})
  return next
}

async function saveFeedback(e: Entry) {
  await writeAtomic(path.join(e.dir, 'feedback.json'), JSON.stringify(e.feedback, null, 2))
}

export function isListening(id: string) {
  const h = hub()
  return (h.waiters.get(id)?.size ?? 0) > 0 || Date.now() - (h.lastPoll.get(id) ?? 0) < 8000
}

export async function getView(id: string): Promise<BoardView> {
  const e = await entry(id)
  const last = e.feedback.rounds.at(-1)
  const changes: Record<string, BlockChange> = {}
  let newReplies: string[] = []
  if (last && last.revision < e.revision) {
    const before = await snapshotAt(e, last.revision)
    const was = blockHashes(before)
    for (const [bid, h] of Object.entries(blockHashes(e.doc))) {
      if (!(bid in was)) changes[bid] = 'new'
      else if (was[bid] !== h) changes[bid] = 'changed'
    }
    const oldReplies = before?.replies ?? {}
    newReplies = Object.keys(e.doc?.replies ?? {}).filter(
      (k) => JSON.stringify(oldReplies[k]) !== JSON.stringify(e.doc?.replies[k]),
    )
  }
  return {
    id,
    doc: e.doc,
    error: e.error,
    revision: e.revision,
    updatedAt: e.updatedAt,
    changes,
    newReplies,
    feedback: e.feedback,
    listening: isListening(id),
  }
}

export async function listBoards(): Promise<BoardSummary[]> {
  const h = hub()
  const dirs = await fsp.readdir(h.root, { withFileTypes: true }).catch(() => [])
  const out: BoardSummary[] = []
  for (const d of dirs) {
    if (!d.isDirectory() || !boardExists(d.name)) continue
    const e = await entry(d.name)
    out.push({
      id: e.id,
      title: e.doc?.title ?? e.id,
      kind: e.doc?.kind ?? 'plan',
      status: e.doc?.status,
      revision: e.revision,
      rounds: e.feedback.rounds.length,
      updatedAt: e.updatedAt,
      error: e.error,
    })
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function check(id: string) {
  const e = await entry(id)
  await refresh(e)
  return { ok: e.error === null, error: e.error, revision: e.revision, blocks: e.doc?.blocks.length ?? 0 }
}

export async function saveDraft(id: string, input: Draft) {
  const e = await entry(id)
  const d = draftSchema.parse(input)
  return locked(e, async () => {
    e.feedback.draft = d
    await saveFeedback(e)
    return { ok: true }
  })
}

// `revision` is the one the human was looking at. Comments and answers about
// an older revision are still worth delivering, so they are recorded against
// it; an approval is not, because it would approve changes nobody saw.
export async function submit(
  id: string,
  input: { verdict: Verdict; overall?: string; draft: Draft; revision: number },
) {
  const e = await entry(id)
  const d = draftSchema.parse(input.draft)
  // Pick up an agent edit the watcher hasn't reloaded yet.
  await refresh(e)
  const round = await locked(e, async () => {
    const reviewed = Math.min(input.revision, e.revision)
    if (input.verdict === 'approve' && reviewed < e.revision) throw new Error(STALE_REVISION)
    const r: Round = {
      n: (e.feedback.rounds.at(-1)?.n ?? 0) + 1,
      at: new Date().toISOString(),
      revision: reviewed,
      verdict: input.verdict,
      overall: input.overall?.trim() || undefined,
      items: d.items,
    }
    e.feedback = { draft: { items: [] }, rounds: [...e.feedback.rounds, r] }
    await saveFeedback(e)
    return r
  })
  for (const wake of hub().waiters.get(id) ?? []) wake()
  emit(id, 'feedback', { round: round.n })
  return round
}

export async function markDelivered(id: string, n: number) {
  const e = await entry(id)
  await locked(e, async () => {
    const r = e.feedback.rounds.find((x) => x.n === n)
    if (!r || r.deliveredAt) return
    r.deliveredAt = new Date().toISOString()
    await saveFeedback(e)
  })
  emit(id, 'feedback', { delivered: n })
}

// Resolve with the oldest round the agent has not received yet, waiting up
// to `ms` for one to arrive. The page shows the agent as "listening" while a
// wait is open.
export async function waitForRound(id: string, ms: number, signal: AbortSignal): Promise<Round | null> {
  const e = await entry(id)
  const h = hub()
  const pending = () => e.feedback.rounds.find((r) => !r.deliveredAt) ?? null
  const now = pending()
  if (now) return now
  if (!h.waiters.has(id)) h.waiters.set(id, new Set())
  const set = h.waiters.get(id)!
  const wasListening = isListening(id)
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>
    const done = () => {
      clearTimeout(timer)
      set.delete(done)
      h.lastPoll.set(id, Date.now())
      signal.removeEventListener('abort', done)
      resolve(pending())
      setTimeout(() => {
        if (!isListening(id)) emit(id, 'presence', { listening: false })
      }, 8500)
    }
    timer = setTimeout(done, ms)
    signal.addEventListener('abort', done)
    set.add(done)
    if (!wasListening) emit(id, 'presence', { listening: true })
  })
}

export async function getRound(id: string, n?: number) {
  const e = await entry(id)
  const rounds = e.feedback.rounds
  return { round: n ? rounds.find((r) => r.n === n) ?? null : rounds.at(-1) ?? null, all: rounds }
}

export async function docFor(id: string) {
  const e = await entry(id)
  return { doc: e.doc, revision: e.revision, feedback: e.feedback }
}

// Files referenced by the doc must sit inside the board directory.
export function resolveAsset(id: string, rel: string): string | null {
  if (!SLUG.test(id)) return null
  const dir = path.join(hub().root, id)
  const p = path.resolve(dir, rel)
  if (!p.startsWith(dir + path.sep)) return null
  if (path.basename(p) === 'feedback.json' || p.includes(`${path.sep}history${path.sep}`)) return null
  return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null
}
