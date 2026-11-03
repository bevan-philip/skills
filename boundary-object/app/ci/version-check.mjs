#!/usr/bin/env node
// Checks that a change to the app comes with a new version, and that SKILL.md
// and README.md name that version's release. Compares against the merge base
// with <base>, including uncommitted changes.
//
//   node ci/version-check.mjs origin/main

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ANY_RELEASE_URL, APP, DOCS, SKILL, readJson, releaseUrl } from './release.mjs'

const base = process.argv[2]
if (!base) {
  console.error('usage: node ci/version-check.mjs <base ref, e.g. origin/main>')
  process.exit(2)
}

const git = (...argv) => execFileSync('git', argv, { cwd: APP, encoding: 'utf8' }).trim()
const errors = []
const pkg = readJson('package.json')
const lock = readJson('package-lock.json')
const version = pkg.version
const FIX = 'run `npm run bump -- patch` (or `minor`) in boundary-object/app'

if (!/^\d+\.\d+\.\d+$/.test(version)) errors.push(`app/package.json has version "${version}"; releases need X.Y.Z`)
if (lock.version !== version || lock.packages?.['']?.version !== version)
  errors.push(`app/package-lock.json has version ${lock.version}, package.json ${version}; run \`npm install --package-lock-only\` in boundary-object/app`)

const url = releaseUrl(pkg)
for (const doc of DOCS) {
  const found = fs.readFileSync(path.join(SKILL, doc), 'utf8').match(ANY_RELEASE_URL) ?? []
  if (doc === 'SKILL.md' && !found.length) errors.push(`SKILL.md names no release; it should run ${url}`)
  for (const f of new Set(found)) if (f !== url) errors.push(`${doc} names ${f}, but package.json is at ${version}`)
}

// Files that end up in the tarball, or decide what goes into it. The CI
// scripts and .gitignore don't.
const rel = path.relative(git('rev-parse', '--show-toplevel'), APP).split(path.sep).join('/')
const mergeBase = git('merge-base', base, 'HEAD')
const changed = git('diff', '--name-only', mergeBase, '--', `:(top)${rel}`)
  .split('\n')
  .filter((f) => f && !f.startsWith(`${rel}/ci/`) && f !== `${rel}/.gitignore`)
let baseVersion = '0.0.0'
try {
  baseVersion = JSON.parse(git('show', `${mergeBase}:${rel}/package.json`)).version ?? '0.0.0'
} catch {}

const parts = (v) => v.split('.').map(Number)
const newer = (a, b) => {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}
if (changed.length && !newer(version, baseVersion)) {
  const list = changed.slice(0, 3).join(', ') + (changed.length > 3 ? ` and ${changed.length - 3} more` : '')
  errors.push(`the app changed (${list}) but its version is ${version}, not newer than ${baseVersion} on ${base}; ${FIX}`)
}

if (errors.length) {
  for (const e of errors) console.error(`version-check: ${e}`)
  process.exit(1)
}
console.log(
  changed.length
    ? `version-check: ${baseVersion} -> ${version}; SKILL.md names ${url}`
    : `version-check: the app is unchanged at ${version}; SKILL.md names its release`,
)
