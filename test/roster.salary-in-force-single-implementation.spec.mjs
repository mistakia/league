/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const expect = chai.expect

const repo_root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const searched_directories = ['libs-server', 'api', 'scripts', 'jobs']

// ONE IMPLEMENTATION OF THE SALARY-IN-FORCE RULE.
//
// This gate exists because the rule was implemented three times, repaired once,
// and the repair was never propagated. get-roster.mjs got the as-of bound and
// the `occurred_at` ordering; get-league-rosters-from-database.mjs and
// calculate-franchise-tag.mjs kept a bare `max(transaction_id)` for years, and
// nothing in the suite could tell -- ids agree with chronology on ordinary data,
// so both rules return the same row until an out-of-order insert appears.
//
// The failure is silent and expensive: the SPA rendered one budget while the
// auction settled against another, and the franchise tag averages were computed
// off the same weak rule. So the thing to gate is not the fixed line, it is the
// DUPLICATION -- a fourth copy would be just as invisible.
//
// This reads the tree rather than the SQL because the defect is a file that
// never calls the shared builder at all. A behavioral spec cannot see a caller
// it does not exercise; see roster.salary-in-force.spec.mjs for the behavior.
const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full_path = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') return []
      return walk(full_path)
    }
    return entry.name.endsWith('.mjs') ? [full_path] : []
  })
}

describe('salary in force has one implementation', function () {
  const files = searched_directories
    .map((dir) => path.join(repo_root, dir))
    .filter((dir) => fs.existsSync(dir))
    .flatMap(walk)

  it('finds the files it claims to search', function () {
    // A pattern that cannot match returns a confident zero, so anchor the sweep
    // on a file known to be in scope before trusting an empty result.
    expect(files.length).to.be.greaterThan(50)
    expect(
      files.some((f) => f.endsWith(path.join('libs-server', 'get-roster.mjs')))
    ).to.equal(true)
  })

  it('resolves a rostered player salary only through the shared builder', function () {
    const offenders = []

    for (const file of files) {
      if (file.endsWith(path.join('libs-server', 'roster-player-salary.mjs'))) {
        continue
      }

      const contents = fs.readFileSync(file, 'utf8')

      // The signature of a hand-rolled copy: a correlated max(transaction_id)
      // that also correlates on a player id. `max(transaction_id)` alone is
      // legitimate elsewhere -- the trade routes use it to find the newest
      // transaction overall, which is a different question.
      const salary_lookup =
        /max\(transaction_id\)[\s\S]{0,240}?transactions\.pid\s*=/g
      if (salary_lookup.test(contents)) {
        offenders.push(path.relative(repo_root, file))
      }
    }

    expect(
      offenders,
      `these resolve a rostered player's salary without the shared rule in libs-server/roster-player-salary.mjs: ${offenders.join(
        ', '
      )}`
    ).to.deep.equal([])
  })
})
