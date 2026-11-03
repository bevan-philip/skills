// What a release of this package is called and where its tarball is served.
// The release workflow uses the same tag and file names.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const APP = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
export const SKILL = path.dirname(APP)
// The files that name the release the skill runs.
export const DOCS = ['SKILL.md', 'README.md']
// Any boundary-object release URL, whatever its repository or version.
export const ANY_RELEASE_URL = /https:\/\/github\.com\/[^\s)`'"]+\/releases\/download\/boundary-object-v[^\s)`'"]+/g

export const readJson = (file) => JSON.parse(fs.readFileSync(path.join(APP, file), 'utf8'))

export function releaseUrl(pkg, version = pkg.version) {
  const repo = pkg.repository.url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/)?.[1]
  if (!repo) throw new Error(`can't find a GitHub repository in ${pkg.repository.url}`)
  return `https://github.com/${repo}/releases/download/boundary-object-v${version}/boundary-object-${version}.tgz`
}
