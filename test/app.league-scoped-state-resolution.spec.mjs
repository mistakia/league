/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { auction_reducer } from '@core/auction/reducer'
import { app_actions } from '@core/app/actions'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const core_dir = path.join(__dirname, '../app/core')

// League-scoped client state must come from the league the ROUTE names, never
// from a position in the `GET /me` payload.
//
// `api/routes/me.mjs` builds `leagues` and `teams` from two independent
// queries, so `leagues[0]` is the user's lowest-numbered league and `teams[0]`
// is their lowest-numbered team -- not the league on screen, and not the same
// league as each other. Pairing them by index is the defect that made every
// team-scoped request 400 with `invalid leagueId`; reading `leagues[0]` alone
// is the quieter half, where a manager in more than one league silently gets
// another league's settings under the route they are looking at.
//
// Every manager in league 1 also holds a team in league 119, so the
// two-league condition is not hypothetical for anybody on this deployment.
//
// The reducer and saga tiers of `app/core` are not importable from a spec --
// they reach `@core/store`, which reads `window` at module scope and there is
// no jsdom -- so the class is held by a SOURCE scan, the same way
// test/app.action-type-registration.spec.mjs holds its own. The scan asserts it
// visited files, so a zero cannot be vacuous.

// `payload.data.leagues[0]` / `payload.data.teams[0]`, with the index left open
// so a positional read is caught whatever number it names.
const positional_read_re = /payload\.data\.(leagues|teams)\s*\[\s*\d+\s*\]/g

// `app/core/app/reducer.js` is the ONE legitimate site: its `leagues[0]` is the
// documented fallback for an entry URL that names no league at all, and it
// resolves the team BY that league rather than by position. It carries its own
// spec in test/app.team-resolution.spec.mjs.
const allowed = new Set(['app/reducer.js'])

// A comment naming the old positional read is documentation, not a read -- and
// the fixes for this class all carry one. Blank comments out rather than
// deleting them so reported line numbers still point at the real source line.
const strip_comments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(
      /(^|[^:])\/\/[^\n]*/g,
      (match, prefix) => prefix + ' '.repeat(match.length - prefix.length)
    )

const scan_core = () => {
  const offenders = []
  let file_count = 0

  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(js|mjs)$/.test(entry.name)) continue

      const relative = path.relative(core_dir, full)
      file_count += 1
      if (allowed.has(relative)) continue

      const source = strip_comments(fs.readFileSync(full, 'utf8'))
      for (const match of source.matchAll(positional_read_re)) {
        const line = source.slice(0, match.index).split('\n').length
        offenders.push(`${relative}:${line} -- ${match[0]}`)
      }
    }
  }

  walk(core_dir)
  return { offenders, file_count }
}

describe('league-scoped state resolves from the league in view', function () {
  it('no module under app/core reads a league or team by payload position', function () {
    const { offenders, file_count } = scan_core()

    // A scan that reached nothing reports a confident zero.
    expect(file_count).to.be.greaterThan(100)
    expect(offenders, offenders.join('\n')).to.eql([])
  })

  it('the scan can actually see a positional read', function () {
    // The gate above is only evidence if it fails on a case known to be bad.
    // `app/core/app/reducer.js` holds a real positional read and is allow-listed
    // by path, so reading it directly proves the pattern matches rather than
    // that the allow-list is doing the work -- AFTER comment-stripping, which
    // is the step that could otherwise blind the whole scan silently.
    const source = strip_comments(
      fs.readFileSync(path.join(core_dir, 'app/reducer.js'), 'utf8')
    )

    expect([...source.matchAll(positional_read_re)]).to.not.have.length(0)
  })

  it('the scan does not count a positional read named in a comment', function () {
    const line_comment = strip_comments(
      '// was payload.data.leagues[0].salary_cap\nconst a = 1\n'
    )
    const block_comment = strip_comments(
      '/* was payload.data.teams[0].team_id */\nconst b = 2\n'
    )

    expect([...line_comment.matchAll(positional_read_re)]).to.have.length(0)
    expect([...block_comment.matchAll(positional_read_re)]).to.have.length(0)
    // Stripping must not move any line, or every reported line number is wrong.
    expect(line_comment.split('\n')).to.have.length(3)
    expect(block_comment.split('\n')).to.have.length(3)
  })

  // The auction reducer used to seed `lineupBudget` from
  // `payload.data.leagues[0].salary_cap` on AUTH_FULFILLED, which on the
  // auction page is another league's cap for anyone in more than one league.
  // The case is gone: `lineupBudget` is seeded by SET_AUCTION_BUDGET, whose
  // caller resolves the league itself.
  //
  // Both league orderings are exercised because the old read was sensitive to
  // exactly that. `GET /me` orders its leagues today, but this is client code
  // and must not depend on it.
  describe('auction lineupBudget', function () {
    const league_orders = {
      'leagues ascending': [
        { league_id: 1, salary_cap: 200 },
        { league_id: 119, salary_cap: 1000 }
      ],
      'leagues in the order production returned them': [
        { league_id: 119, salary_cap: 1000 },
        { league_id: 1, salary_cap: 200 }
      ]
    }

    for (const [order_name, leagues] of Object.entries(league_orders)) {
      it(`is not seeded from a payload league (${order_name})`, function () {
        const state = auction_reducer(undefined, {
          type: app_actions.AUTH_FULFILLED,
          payload: { data: { leagues, teams: [], user: { id: 1 } } }
        })

        // The old code produced 180 or 900 here depending purely on which
        // league the payload happened to put first.
        expect(state.get('lineupBudget')).to.equal(null)
      })
    }
  })
})
