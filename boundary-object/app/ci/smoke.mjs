#!/usr/bin/env node
// Smoke test for a packed release. Runs the tarball through npx the way the
// skill does, with a throwaway npm cache and board directory, and checks that
// the bundled server starts, serves the page and validates every example.
//
//   node ci/smoke.mjs boundary-object-0.1.0.tgz

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

class Failure extends Error {}
const fail = (msg) => {
  throw new Failure(msg)
}

const tgz = process.argv[2]
if (!tgz) {
  console.error('usage: node ci/smoke.mjs <boundary-object-X.Y.Z.tgz>')
  process.exit(2)
}
const expected = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boundary-smoke-'))
const env = {
  ...process.env,
  BOUNDARY_ROOT: path.join(tmp, 'boards'),
  BOUNDARY_NO_BROWSER: '1',
  npm_config_cache: path.join(tmp, 'npm-cache'),
  npm_config_update_notifier: 'false',
}

const boundary = (...argv) => {
  console.log(`$ boundary ${argv.join(' ')}`)
  const out = execFileSync('npx', ['-y', '--prefer-offline', `file:${path.resolve(tgz)}`, ...argv], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  process.stdout.write(out)
  return out
}

const get = async (url) => {
  const r = await fetch(url)
  if (r.status !== 200) fail(`GET ${url} returned ${r.status}`)
  return r
}

try {
  const version = boundary('version').trim()
  if (version !== expected) fail(`the CLI reports ${version}, package.json says ${expected}`)

  const urls = boundary('demo').trim().split('\n')
  if (urls.length < 3) fail(`demo printed ${urls.length} board URLs, expected at least 3`)
  const origin = new URL(urls[0]).origin

  const health = await (await get(`${origin}/api/health`)).json()
  if (health.version !== expected) fail(`/api/health reports ${health.version}, expected ${expected}`)

  for (const url of urls) {
    const id = url.split('/b/')[1]
    if (!boundary('check', id).startsWith('OK:')) fail(`example ${id} did not validate`)
    const html = await (await get(url)).text()
    const script = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1]
    if (!script) fail(`the page for ${id} links no script`)
    await get(origin + script)
  }

  const id = boundary('new', 'smoke', '--kind', 'report').match(/^board: (\S+)/m)?.[1]
  if (!id) fail('new did not print a board id')
  if (!boundary('check', id).startsWith('OK:')) fail('a new report board did not validate')

  console.log(`smoke: ${version} OK`)
} catch (e) {
  // A failed command has already printed its own stderr.
  console.error(`smoke: ${e instanceof Failure ? e.message : `failed: ${e.message.split('\n')[0]}`}`)
  const log = path.join(env.BOUNDARY_ROOT, '.server.log')
  if (fs.existsSync(log)) console.error(`--- ${log}\n${fs.readFileSync(log, 'utf8')}`)
  process.exitCode = 1
} finally {
  try {
    boundary('stop')
  } catch {}
  fs.rmSync(tmp, { recursive: true, force: true })
}
