/* global describe it */

import fs from 'node:fs'
import path from 'node:path'
import * as chai from 'chai'
import { fileURLToPath } from 'node:url'

import { scoring_registry } from '#libs-shared/scoring-columns.mjs'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Parity between the two fantasy-points paths.
//
// The gamelogs path scores every column in libs-shared/scoring-columns.mjs by
// construction -- calculate-points.mjs loops the registry. The from-plays path
// does NOT: each term is hand-written into a scoring generator, so a registry
// column with no generator reference is scored as zero there and the two paths
// disagree with nothing failing anywhere.
//
// That is not hypothetical. passing_completions was missing from the passing
// generator while two production formats scored it at 0.50 and 0.20, which
// under-reported a 350-completion quarterback by up to 175 points a season. It
// was found by writing this spec, not by any gate.
//
// WHY THIS IS STRUCTURAL RATHER THAN AN EXECUTED RESIDUAL. The obvious spec is
// "run both paths over a season and assert the residual does not grow", and it
// cannot live here: the suite runs against a seeded test database with no real
// season in it, so an executed residual would be a number about the fixtures
// rather than about the code. The residual belongs in a production check. What
// CI can own is the COVERAGE MAP -- which columns the from-plays path can score
// at all -- and that is what actually regresses silently.
//
// The path spans TWO files -- the scoring expressions and the query builder
// that emits them -- and both are read. Reading only one would make the matcher
// blind to every term in the other, which is a coverage map that reports gaps
// that are not gaps (or, once a term moves, parity that is not parity). The
// positive control below is what catches a stale path here.
const from_plays_source = [
  path.join(
    __dirname,
    '..',
    'libs-server',
    'data-views',
    'fantasy-points-scoring-expressions.mjs'
  ),
  path.join(
    __dirname,
    '..',
    'libs-server',
    'data-views-column-definitions',
    'player-fantasy-points-from-plays-column-definitions.mjs'
  )
]
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')

// Column names reach the generators three ways, and a matcher that knows only
// the first reports a covered column as uncovered. field_goals_made_50_plus_yards
// is held in a module constant and is invisible to a `scoring_format.<name>`
// pattern -- the constants-defeat-the-matcher hazard, hit while writing this.
const referenced_columns = () => {
  const found = new Set()
  const patterns = [
    /scoring_format\??\.([a-z0-9_]+)/g, // scoring_format.passing_yards
    /column: '([a-z0-9_]+)'/g, // create_flat_role_scoring({ column: ... })
    /'([a-z0-9_]+)'/g // FIELD_GOAL_50_PLUS_COLUMN = '...'
  ]
  for (const pattern of patterns) {
    for (const match of from_plays_source.matchAll(pattern)) {
      found.add(match[1])
    }
  }
  return found
}

const scoring_columns = scoring_registry
  .filter((entry) => entry.column)
  .map((entry) => entry.column)

// Columns the from-plays path deliberately does not score, each for a reason
// that is not "nobody noticed". Shrinking this list is progress; GROWING it
// means a scoring column was added with no from-plays term, which is the
// silent-divergence case this spec exists to catch.
const EXPECTED_UNCOVERED = {
  // Phase 6. DST is not derived from plays on this path at all yet -- the
  // derivation exists only in libs-shared/calculate-dst-stats-from-plays.mjs,
  // which the gamelogs path uses. Porting it to SQL is its own piece of work.
  defensive_sacks: 'dst not on the from-plays path yet (Phase 6)',
  defensive_interceptions: 'dst not on the from-plays path yet (Phase 6)',
  defensive_forced_fumbles: 'dst not on the from-plays path yet (Phase 6)',
  defensive_recovered_fumbles: 'dst not on the from-plays path yet (Phase 6)',
  defensive_three_and_outs: 'dst not on the from-plays path yet (Phase 6)',
  defensive_fourth_down_stops: 'dst not on the from-plays path yet (Phase 6)',
  defensive_points_against: 'dst not on the from-plays path yet (Phase 6)',
  defensive_points_against_threshold:
    'dst not on the from-plays path yet (Phase 6)',
  defensive_yards_against: 'dst not on the from-plays path yet (Phase 6)',
  defensive_yards_against_threshold:
    'dst not on the from-plays path yet (Phase 6)',
  defensive_blocked_kicks: 'dst not on the from-plays path yet (Phase 6)',
  defensive_safeties: 'dst not on the from-plays path yet (Phase 6)',
  defensive_two_point_returns: 'dst not on the from-plays path yet (Phase 6)',
  defensive_touchdowns: 'dst not on the from-plays path yet (Phase 6)',

  // No production format scores it, and there is no unambiguous pass-attempt
  // indicator on nfl_plays -- a sack is not an attempt. Left uncovered
  // deliberately rather than guessed at; a format that sets it would diverge.
  passing_attempts: 'no nfl_plays indicator, and no format scores it',

  // A switch selecting which rushing-yards field to read, not a scored value.
  // The gamelogs path applies it before scoring; the from-plays path has no
  // kneel-adjusted yardage column to switch to.
  is_excluding_quarterback_kneels: 'a switch, not a scored value'
}

describe('fantasy points path parity', () => {
  const referenced = referenced_columns()

  // POSITIVE CONTROL. Every assertion below rests on the matcher finding real
  // references, and a matcher that silently stops matching would make the
  // coverage assertion pass vacuously -- reporting perfect parity over a path
  // that scores nothing. These three cover all three reference shapes.
  it('the reference matcher still finds known-covered columns', () => {
    expect(
      referenced.has('passing_yards'),
      'scoring_format.<name> shape'
    ).to.eq(true)
    expect(referenced.has('fumbles_lost'), 'flat-factory column shape').to.eq(
      true
    )
    expect(
      referenced.has('field_goals_made_50_plus_yards'),
      'module-constant shape'
    ).to.eq(true)
  })

  it('every scoring column is either scored from plays or a declared gap', () => {
    const uncovered = scoring_columns.filter(
      (column) => !referenced.has(column)
    )
    const undeclared = uncovered.filter((column) => !EXPECTED_UNCOVERED[column])

    expect(
      undeclared,
      'these scoring columns are silently unscored on the from-plays path -- ' +
        'add a term to its generator, or declare the gap in EXPECTED_UNCOVERED'
    ).to.deep.equal([])
  })

  it('declared gaps are real gaps', () => {
    // The inverse direction. A column that gets a from-plays term but stays on
    // the list would leave a stale claim in this file, and the next reader
    // would believe a gap that no longer exists.
    const stale = Object.keys(EXPECTED_UNCOVERED).filter((column) =>
      referenced.has(column)
    )

    expect(
      stale,
      'these are covered on the from-plays path now -- remove them from ' +
        'EXPECTED_UNCOVERED'
    ).to.deep.equal([])
  })

  it('every declared gap is a real scoring column', () => {
    // Guards a typo'd or removed column name, which would otherwise sit in the
    // list forever excusing a gap that cannot exist.
    const unknown = Object.keys(EXPECTED_UNCOVERED).filter(
      (column) => !scoring_columns.includes(column)
    )

    expect(unknown, 'not columns in the scoring registry').to.deep.equal([])
  })

  it('the kicking group is fully covered', () => {
    // Pins the outcome of this cluster: every kicking column scores from plays.
    // Brandon Aubrey read 0.6 from plays against 198.9 from gamelogs before it.
    const kicking = scoring_registry
      .filter((entry) => entry.column && entry.group === 'kicking')
      .map((entry) => entry.column)

    expect(kicking.length).to.be.greaterThan(0)
    expect(kicking.filter((column) => !referenced.has(column))).to.deep.equal(
      []
    )
  })
})
