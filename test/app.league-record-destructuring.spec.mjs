/* global describe it */

// A READ OFF THE LEAGUE RECORD THAT NAMES A KEY THE RECORD DOES NOT DECLARE
// YIELDS `undefined`, SILENTLY.
//
// `League` (app/core/leagues/league.js) is an Immutable Record, so it carries
// exactly its declared keys and nothing else -- and a destructure or a member
// read is not an index lookup that can be linted, it is a property access that
// resolves to `undefined` with no warning from eslint, PropTypes, the reducer
// or the build. This is the same absent-key family as the `mapDispatchToProps`
// typo and the dropped Record field in docs/guides/spa.md, one tier down: the
// failure is a falsy guard rather than a thrown TypeError, so the code path
// simply does not run.
//
// It shipped twice in one file. `app/core/auction/sagas.js` destructured
// `leagueId` off `get_current_league` in `reload_auction_elections` and in
// `load_auction_blocks_for_current_league`; the Record declares `league_id`, so
// both read `undefined` and both returned at their own `if (!leagueId) return`.
// The visible effect was that setting, raising, declining or withdrawing an
// election never refetched: the drawer control, the board chip and the standing
// elections panel all stayed frozen at their last loaded value while the write
// had in fact succeeded, which reads as a broken write rather than a missing
// read. Measured on league 119 on 2026-09-02 -- a withdraw returned 200 and the
// panel kept listing the withdrawn ceiling until a full page reload.
//
// A source scan is the right shape here because a saga cannot be driven from a
// spec in this repo at all (`@core/ws` reaches `@core/store`, which reads
// `window.__INITIAL_STATE__` at module scope and there is no jsdom -- see
// docs/guides/auction.md). The Record itself IS importable, so the key list is
// read from the declaration rather than copied, which is what keeps this gate
// from drifting away from the thing it checks.
//
// THE TREE IS CLEAN TODAY, so the scan alone would pass vacuously -- a pattern
// that matches nothing returns a confident zero. `find_undeclared_reads` is
// therefore exercised against synthetic sources carrying both the defect and
// its correct sibling, which is what proves the detector can report at all.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { League } from '#app/core/leagues/league.js'

const expect = (await import('chai')).expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const ROOT = path.resolve(REPO_ROOT, 'app')
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage'])

const declared_keys = new Set(Object.keys(new League().toJS()))

// `const { a, b } = yield select(get_current_league)`, and the plain
// `const { a } = get_current_league(state)` a mapStateToProps uses.
const DESTRUCTURE_PATTERN =
  /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:yield\s+select\(\s*)?get_current_league\b/g

// `const league = yield select(get_current_league)`, whose binding is then read
// with a dot. This is the commoner form in this tree and it fails identically.
const BINDING_PATTERN =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:yield\s+select\(\s*)?get_current_league\b/g

// `{ a, b: renamed, c = 1 }` -> ['a', 'b', 'c']. The SOURCE key is what has to
// exist on the Record; what it is bound to locally is irrelevant.
const source_keys_of = (body) =>
  body
    .split(',')
    .map((part) => part.split(':')[0].split('=')[0].trim())
    .filter((key) => key && !key.startsWith('...'))

const find_undeclared_reads = (source, label) => {
  const hits = []
  const lines = source.split('\n')

  lines.forEach((line, index) => {
    for (const match of line.matchAll(DESTRUCTURE_PATTERN)) {
      for (const key of source_keys_of(match[1])) {
        if (!declared_keys.has(key)) {
          hits.push(`${label}:${index + 1} destructures \`${key}\``)
        }
      }
    }
  })

  // A binding is read anywhere below its declaration, so member reads are
  // gathered over the whole file rather than the declaring line.
  const bindings = new Set()
  for (const match of source.matchAll(BINDING_PATTERN)) bindings.add(match[1])

  for (const binding of bindings) {
    // Two exclusions, each of which produced a false positive on the first real
    // run. The LEADING lookbehind rejects `values.league.DRAFT`, where the
    // binding's name is itself a property of something else -- \b matches
    // between the dot and the name, so without it every unrelated `.league.x`
    // in app/core/selectors.js reads as a Record access. The TRAILING one drops
    // method calls, which are the Record API (`get`, `toJS`, `merge`) rather
    // than declared fields.
    const member = new RegExp(
      `(?<![.\\w$])${binding}\\.([A-Za-z_$][\\w$]*)\\b(?!\\s*\\()`,
      'g'
    )
    lines.forEach((line, index) => {
      for (const match of line.matchAll(member)) {
        if (!declared_keys.has(match[1])) {
          hits.push(`${label}:${index + 1} reads \`${binding}.${match[1]}\``)
        }
      }
    })
  }

  return hits
}

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

describe('League record reads in the SPA', () => {
  it('reads its key list from the Record rather than a copy', () => {
    expect(declared_keys.size).to.be.greaterThan(0)
    expect(declared_keys.has('league_id')).to.equal(true)
    expect(declared_keys.has('leagueId')).to.equal(false)
  })

  it('reports the defect it exists to catch', () => {
    const destructured = find_undeclared_reads(
      'const { leagueId } = yield select(get_current_league)\n',
      'synthetic'
    )
    expect(destructured).to.have.lengthOf(1)

    const member_read = find_undeclared_reads(
      'const league = yield select(get_current_league)\nif (!league.leagueId) return\n',
      'synthetic'
    )
    expect(member_read).to.have.lengthOf(1)
  })

  it('passes the correct forms of the same reads', () => {
    expect(
      find_undeclared_reads(
        'const { league_id } = yield select(get_current_league)\n',
        'synthetic'
      )
    ).to.deep.equal([])

    expect(
      find_undeclared_reads(
        [
          'const league = yield select(get_current_league)',
          'if (!league.league_id) return',
          'const value = league.get("is_hosted")',
          'const plain = league.toJS()'
        ].join('\n'),
        'synthetic'
      )
    ).to.deep.equal([])
  })

  it('declares every key read off get_current_league in app/', () => {
    const files = collect_source_files(ROOT)
    expect(files.length).to.be.greaterThan(0)

    const hits = []
    for (const file of files) {
      hits.push(
        ...find_undeclared_reads(
          fs.readFileSync(file, 'utf8'),
          path.relative(REPO_ROOT, file)
        )
      )
    }

    expect(hits, hits.join('\n')).to.deep.equal([])
  })
})
