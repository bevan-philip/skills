#!/usr/bin/env node
// boundary: the agent's side of a board. No dependencies beyond Node >= 22.
//
//   node boundary.mjs new <name> [--kind plan|report] [--title "..."]
//   node boundary.mjs open <board> [--no-browser]
//   node boundary.mjs check <board>
//   node boundary.mjs wait <board> [--timeout 1800]
//   node boundary.mjs feedback <board> [--round N] [--state]
//   node boundary.mjs list | stop | demo | path <board>
//
// Each `new` creates its own board directory under the system temp directory
// (override with --root or BOUNDARY_ROOT), never in the project or this skill.
// The web app in ../app is installed and built on first use.

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const APP = path.join(SKILL, 'app')
const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/

const say = (...a) => process.stderr.write(a.join(' ') + '\n')
const die = (msg, code = 1) => {
  say(`boundary: ${msg}`)
  process.exit(code)
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) out._.push(a)
    else if (a.includes('=')) out[a.slice(2, a.indexOf('='))] = a.slice(a.indexOf('=') + 1)
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i]
    else out[a.slice(2)] = true
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const [cmd, board] = args._

function projectRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : process.cwd()
}

// Boards are working documents for one invocation, so they live apart from
// both the project and the skill, and every command finds them the same way
// whatever directory it runs in.
const ROOT = path.resolve(args.root ?? process.env.BOUNDARY_ROOT ?? path.join(os.tmpdir(), 'boundary-object'))
const INFO = path.join(ROOT, '.server.json')

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true })
}

function needBoard() {
  if (!board) die(`"${cmd}" needs a board id, e.g. \`boundary ${cmd} auth-rewrite\``)
  if (!SLUG.test(board)) die(`board ids are lowercase letters, digits, "-" or "_" (got "${board}")`)
  return path.join(ROOT, board)
}

// ---- app install / build ----

function newestMtime(p) {
  const st = fs.statSync(p)
  if (!st.isDirectory()) return st.mtimeMs
  let m = st.mtimeMs
  for (const f of fs.readdirSync(p)) m = Math.max(m, newestMtime(path.join(p, f)))
  return m
}

function run(bin, argv, what) {
  say(what)
  // Keep stdout clean for the agent; errors still come through on stderr.
  const r = spawnSync(bin, argv, { cwd: APP, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' })
  if (r.status !== 0) die(`${bin} ${argv.join(' ')} failed in ${APP}`)
}

function ensureApp() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  if (!fs.existsSync(path.join(APP, 'node_modules', '.package-lock.json'))) {
    const hasLock = fs.existsSync(path.join(APP, 'package-lock.json'))
    run(npm, [hasLock ? 'ci' : 'install', '--no-audit', '--no-fund', '--loglevel=error'], 'Installing the board app (first run only)…')
  }
  const built = path.join(APP, 'dist', 'server', 'server.js')
  const src = Math.max(
    newestMtime(path.join(APP, 'src')),
    newestMtime(path.join(APP, 'package.json')),
    newestMtime(path.join(APP, 'vite.config.ts')),
    newestMtime(path.join(APP, 'server.mjs')),
  )
  if (!fs.existsSync(built) || fs.statSync(built).mtimeMs < src) {
    run(npm, ['run', 'build', '--silent'], 'Building the board app…')
  }
  return fs.statSync(built).mtimeMs
}

// ---- server ----

async function health(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) })
    const j = await r.json()
    return j.app === 'boundary-object' && path.resolve(j.root) === ROOT ? j : null
  } catch {
    return null
  }
}

function readInfo() {
  try {
    return JSON.parse(fs.readFileSync(INFO, 'utf8'))
  } catch {
    return null
  }
}

function freePort(start) {
  return new Promise((resolve, reject) => {
    const tryPort = (p) => {
      if (p > start + 50) return reject(new Error('no free port'))
      const s = net.createServer()
      s.once('error', () => tryPort(p + 1))
      s.once('listening', () => s.close(() => resolve(p)))
      s.listen(p, '127.0.0.1')
    }
    tryPort(start)
  })
}

function stopPid(pid) {
  try {
    process.kill(pid)
  } catch {}
}

async function ensureServer() {
  ensureRoot()
  const builtAt = ensureApp()
  const info = readInfo()
  if (info && (await health(info.port))) {
    if (info.builtAt >= builtAt) return info.port
    say('The board app was rebuilt; restarting its server…')
    stopPid(info.pid)
    await new Promise((r) => setTimeout(r, 400))
  }
  const port = await freePort(Number(args.port ?? process.env.BOUNDARY_PORT ?? 4317))
  const log = fs.openSync(path.join(ROOT, '.server.log'), 'a')
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: APP,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BOUNDARY_ROOT: ROOT, NODE_ENV: 'production' },
    detached: true,
    stdio: ['ignore', log, log],
  })
  child.unref()
  for (let i = 0; i < 60; i++) {
    if (await health(port)) {
      fs.writeFileSync(INFO, JSON.stringify({ port, pid: child.pid, builtAt, startedAt: new Date().toISOString() }, null, 2))
      return port
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  die(`the board server did not start; see ${path.join(ROOT, '.server.log')}`)
}

const url = (port, id) => `http://127.0.0.1:${port}/b/${id}`

async function api(port, p, opts = {}) {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, opts)
  return r
}

function openBrowser(target) {
  if (args['no-browser'] || process.env.BOUNDARY_NO_BROWSER) return false
  const headless = process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY
  if (headless) return false
  const [bin, argv] =
    process.platform === 'darwin'
      ? ['open', [target]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', target]]
        : ['xdg-open', [target]]
  try {
    spawn(bin, argv, { detached: true, stdio: 'ignore' }).unref()
    return true
  } catch {
    return false
  }
}

// ---- commands ----

const starters = {
  plan: (title) => ({
    title,
    kind: 'plan',
    summary: 'One short paragraph: what you intend to change, why, and what you need from the human.',
    status: 'Drafting the plan.',
    blocks: [{ id: 'context', type: 'markdown', title: 'Where things stand', body: 'Replace this with the current state.' }],
  }),
  report: (title) => ({
    title,
    kind: 'report',
    summary: 'One short paragraph: what you built, whether it matches the plan, and what the human should check.',
    status: 'Writing up the report.',
    blocks: [{ id: 'outcome', type: 'markdown', title: 'What changed', body: 'Replace this with the outcome.' }],
  }),
}

// Every invocation gets a board of its own: the name is a readable prefix and a
// short random suffix keeps it apart from earlier boards with the same name.
async function cmdNew() {
  const kind = args.kind ?? 'plan'
  if (!starters[kind]) die('--kind is "plan" or "report"')
  const name = (board ?? 'board').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'board'
  ensureRoot()
  let id
  do id = `${name}-${Math.random().toString(36).slice(2, 6)}`
  while (fs.existsSync(path.join(ROOT, id)))
  const dir = path.join(ROOT, id)
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ project: projectRoot(), created: new Date().toISOString() }, null, 2) + '\n')
  const doc = path.join(dir, 'doc.json')
  fs.writeFileSync(doc, JSON.stringify(starters[kind](args.title ?? board ?? 'Untitled board'), null, 2) + '\n')
  console.log(`board: ${id}\ndoc:   ${doc}\nassets: ${path.join(dir, 'assets')}`)
  say(`Created a ${kind} board. Write the real content into that doc.json, then run \`open ${id}\`; use the id "${id}" for every later command.`)
}

async function cmdCheck(port) {
  const dir = needBoard()
  if (!fs.existsSync(path.join(dir, 'doc.json'))) die(`no doc.json in ${dir} (run \`new ${board}\` first)`)
  const r = await (await api(port, `/api/boards/${board}/check`)).json()
  if (!r.ok) {
    console.log(`doc.json has problems:\n${r.error}`)
    return false
  }
  console.log(`OK: ${r.blocks} block${r.blocks === 1 ? '' : 's'}, revision ${r.revision}.`)
  return true
}

async function cmdOpen() {
  const port = await ensureServer()
  const ok = await cmdCheck(port)
  const target = url(port, board)
  const opened = ok && openBrowser(target)
  console.log(`${opened ? 'Opened' : 'Board is at'} ${target}`)
  if (!ok) process.exit(1)
}

async function cmdWait() {
  needBoard()
  const total = Number(args.timeout ?? 1800)
  const deadline = Date.now() + total * 1000
  let port = await ensureServer()
  say(`Waiting for feedback on ${url(port, board)} (up to ${total}s)…`)
  while (Date.now() < deadline) {
    const secs = Math.max(1, Math.min(120, Math.round((deadline - Date.now()) / 1000)))
    let r
    try {
      r = await api(port, `/api/boards/${board}/wait?timeout=${secs}`, { headers: { 'x-boundary-agent': '1' } })
    } catch {
      port = await ensureServer()
      continue
    }
    if (r.status === 200) {
      const { digest } = await r.json()
      console.log(digest)
      return
    }
    if (r.status === 404) die(`no board "${board}" in ${ROOT}`)
  }
  console.log(
    `No feedback after ${total}s. The board stays open at ${url(port, board)}; run \`wait ${board}\` again, or carry on and check later with \`feedback ${board}\`.`,
  )
  process.exit(2)
}

async function cmdFeedback() {
  needBoard()
  const port = await ensureServer()
  const q = args.state ? 'state=1' : args.round ? `round=${Number(args.round)}` : ''
  process.stdout.write(await (await api(port, `/api/boards/${board}/digest?${q}`)).text())
}

async function cmdList() {
  const port = await ensureServer()
  const boards = await (await api(port, '/api/boards')).json()
  if (!boards.length) return console.log(`No boards in ${ROOT}.`)
  for (const b of boards) {
    const where = b.project ? `\t${b.project}` : ''
    console.log(`${b.id}\t${b.kind}\trev ${b.revision}\t${b.rounds} round${b.rounds === 1 ? '' : 's'}\t${b.error ? 'INVALID\t' : ''}${b.title}${where}`)
  }
  console.log(`\n${url(port, '').replace(/\/b\/$/, '/')}`)
}

// Copies the bundled example boards into the board directory so you can try the page.
async function cmdDemo() {
  ensureRoot()
  const src = path.join(SKILL, 'examples')
  const ids = fs.readdirSync(src).filter((d) => fs.existsSync(path.join(src, d, 'doc.json')))
  for (const id of ids) {
    const dest = path.join(ROOT, id)
    if (!fs.existsSync(dest)) fs.cpSync(path.join(src, id), dest, { recursive: true })
  }
  const port = await ensureServer()
  for (const id of ids) console.log(url(port, id))
  openBrowser(url(port, ids[0]))
}

async function cmdStop() {
  const info = readInfo()
  if (!info) return console.log('No board server is running.')
  stopPid(info.pid)
  fs.rmSync(INFO, { force: true })
  console.log(`Stopped the board server on port ${info.port}.`)
}

const help = `boundary — share a plan or report with the human as an interactive page

  new <name> [--kind plan|report] [--title T]   start a board for this invocation; prints its id and doc path
  open <board> [--no-browser]                   start the server, validate, open the page
  check <board>                                 validate doc.json after editing it
  wait <board> [--timeout SECS]                 block until the human sends a round (default 1800s)
  feedback <board> [--round N | --state]        reprint a round, or the standing answers
  list                                          all boards, with the project each was started from
  stop                                          stop the board server
  path <board>                                  print the board directory
  demo                                          copy the example boards in and open them

Boards: ${ROOT}`

switch (cmd) {
  case 'new':
    await cmdNew()
    break
  case 'open':
    needBoard()
    await cmdOpen()
    break
  case 'check': {
    needBoard()
    if (!(await cmdCheck(await ensureServer()))) process.exit(1)
    break
  }
  case 'wait':
    await cmdWait()
    break
  case 'feedback':
    await cmdFeedback()
    break
  case 'list':
    await cmdList()
    break
  case 'demo':
    await cmdDemo()
    break
  case 'stop':
    await cmdStop()
    break
  case 'path':
    console.log(needBoard())
    break
  default:
    console.log(help)
    if (cmd && cmd !== 'help' && cmd !== '--help') process.exit(1)
}
