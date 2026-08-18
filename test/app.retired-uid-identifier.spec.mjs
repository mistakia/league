/* global describe it */

// The uid retirement (task/league/retire-uid-surrogate-key-column.md) renamed
// the surrogate key on every league table to <entity>_id and moved the SPA's
// reads with it. A read that survived the sweep gets `undefined` from the wire
// and the UI silently renders blank, or passes a null id into a write --
// invisible to the server suite, which drives the API over HTTP and never loads
// a component or a reducer.
//
// The 2026-08-18 batch-4 deploy shipped exactly this class: the Poach Record
// still declared and read `uid`, the poach-notice confirm passed
// `poach.get('uid')` (undefined, so processing a claim sent a null id), and the
// restricted-free-agency auction winner check read `bid.get('uid')` against a
// `bid_id` wire, so no bid ever matched `winning_bid_id`. Three live defects
// behind a green suite and every server-side gate.
//
// So this spec scans the SPA source for a READ of the retired identifier --
// `.get('uid')`, `['uid']`, `.uid`, and `hasIn([...'uid'])` -- and fails on
// any. The retired column has no legitimate reader left in app/, so a hit is a
// defect until someone records an adjudication. Prose naming the old column is
// not a read and is deliberately not matched.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const expect = (await import('chai')).expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', 'app')
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage'])

// The accessor shapes this codebase reads a surrogate key through. Each matched
// a live site that shipped behind the rename; the list is the class, not the
// instance.
const READ_PATTERNS = [
  /\.get\(\s*['"]uid['"]\s*\)/,
  /\['uid'\]/,
  /\.uid\b/,
  /hasIn\(\s*\[[^\]]*['"]uid['"]/
]

const collect_source_files = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collect_source_files(full, out)
    } else if (/\.(js|mjs)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

describe('retired uid identifier reads in the SPA', () => {
  it('finds no read of the retired `uid` identifier in app/', () => {
    const files = collect_source_files(ROOT)
    expect(files.length).to.be.greaterThan(0)
    const hits = []
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      for (const pattern of READ_PATTERNS) {
        const lines = source.split('\n')
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            hits.push(
              `${path.relative(path.resolve(__dirname, '..'), file)}:${index + 1} ${pattern}`
            )
          }
        })
      }
    }
    expect(hits, hits.join('\n')).to.deep.equal([])
  })
})
