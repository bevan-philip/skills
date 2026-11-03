#!/usr/bin/env node
// Bumps the app's version and points SKILL.md and README.md at the release
// the merge will make.
//
//   npm run bump -- patch|minor|major

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { DOCS, SKILL, APP, readJson, releaseUrl } from './release.mjs'

const level = process.argv[2]
if (!['patch', 'minor', 'major'].includes(level)) {
  console.error('usage: npm run bump -- patch|minor|major')
  process.exit(2)
}

const before = readJson('package.json')
execFileSync('npm', ['version', level, '--no-git-tag-version', '--loglevel=error'], {
  cwd: APP,
  stdio: ['ignore', 'ignore', 'inherit'],
  shell: process.platform === 'win32',
})
const after = readJson('package.json')
const [from, to] = [releaseUrl(before), releaseUrl(after)]

let missing = false
for (const doc of DOCS) {
  const file = path.join(SKILL, doc)
  const text = fs.readFileSync(file, 'utf8')
  if (!text.includes(from)) {
    if (doc === 'SKILL.md') missing = true
    continue
  }
  fs.writeFileSync(file, text.replaceAll(from, to))
}

console.log(`${before.version} -> ${after.version}: ${to}`)
if (missing) {
  console.error(`SKILL.md didn't name ${from}; point it at ${to} by hand.`)
  process.exit(1)
}
