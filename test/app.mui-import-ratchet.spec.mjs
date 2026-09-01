/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app_dir = path.join(__dirname, '../app')

chai.should()

// THE RATCHET FOR MOVING THE SPA OFF MATERIAL-UI. The conversion runs over many
// sessions, one primitive and its call sites at a time, so the thing that has
// to survive between them is the direction of travel: a new `@mui` import in
// `app/` is a regression whatever else it does, and nothing else in the repo
// would notice one.
//
// LOWER THE BUDGET AS EACH SLICE LANDS. It is a ceiling, not a target, and it
// ends at zero. The plan lives at
// user:task/league/move-league-spa-off-material-ui.md.
//
// This governs `app/` ONLY, and it cannot be extended to the package manifest.
// `react-table` is a git dependency built from source and carries its own
// `@mui` imports, so the packages stay in package.json — with the
// `.button` :not(.Mui...) chain and the z-index pins in general.styl — until
// that repo is converted too. A green run here is not evidence that MUI has
// left the bundle.
const import_budget = {
  '@mui/material': 352,
  '@mui/base': 7,
  '@mui/lab': 1,
  '@mui/icons-material': 0,
  '@mui/x-date-pickers': 0,
  '@mui/styled-engine': 0
}

const collect_source_files = (dir) => {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...collect_source_files(full))
    else if (/\.(js|mjs)$/.test(entry.name)) found.push(full)
  }
  return found
}

// Anchored on the import specifier rather than on the bare string `@mui`, so a
// comment naming the package — this file's own header, and several in app/ that
// record why a workaround exists — is not counted as a dependency.
const import_re =
  /(?:^|\n)\s*(?:import|export)[^\n]*?from\s+'(@mui\/[a-z-]+)[^']*'/g

const count_imports_by_package = (files) => {
  const counts = {}
  for (const file of files) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(import_re)) {
      counts[match[1]] = (counts[match[1]] || 0) + 1
    }
  }
  return counts
}

describe('app @mui import ratchet', function () {
  const files = collect_source_files(app_dir)
  const counts = count_imports_by_package(files)

  it('scans a non-empty set of source files', () => {
    // Without this the whole spec passes when the walk is broken, which is the
    // one failure a budget check cannot distinguish from success.
    files.length.should.be.greaterThan(500)
  })

  it('imports no @mui package the budget does not name', () => {
    const unbudgeted = Object.keys(counts).filter(
      (name) => !(name in import_budget)
    )
    unbudgeted.should.deep.equal([])
  })

  it('stays within the per-package import budget', () => {
    const over = []
    for (const [name, budget] of Object.entries(import_budget)) {
      const actual = counts[name] || 0
      if (actual > budget)
        over.push(`${name}: ${actual} imports, budget ${budget}`)
    }
    over.should.deep.equal([])
  })

  it('has a budget that is not slack', () => {
    // A ceiling nobody is near stops reporting. Every package's budget must be
    // exactly its current count, so lowering one is a deliberate edit made in
    // the same commit as the slice that earned it — and so that a REMOVED
    // import fails here too, which is what keeps the numbers honest.
    const slack = []
    for (const [name, budget] of Object.entries(import_budget)) {
      const actual = counts[name] || 0
      if (actual < budget)
        slack.push(`${name}: ${actual} imports, budget ${budget} — lower it`)
    }
    slack.should.deep.equal([])
  })
})
