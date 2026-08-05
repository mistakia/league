/* global describe it */

import * as chai from 'chai'

import { scoring_registry } from '#libs-shared/scoring-columns.mjs'
import { from_plays_scored_columns } from '#libs-server/data-views/fantasy-points-scoring-expressions.mjs'

const expect = chai.expect

// Parity between the two fantasy-points paths.
//
// The gamelogs path scores every column in libs-shared/scoring-columns.mjs by
// construction -- calculate-points.mjs loops the registry. The from-plays path
// does NOT: each term is declared in a role table, so a registry column with no
// term is scored as zero there and the two paths disagree with nothing failing
// anywhere.
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
// THE MAP IS NOW IMPORTED, NOT MATCHED. Until 2026-08-05 the from-plays half was
// recovered by reading two source files as TEXT and running three regexes over
// them, one per shape a column name could take. That was coupled to file layout
// in a way nothing declared -- moving the generators into their own module
// emptied the corpus and the positive control failed 3 of 5 cases -- and its
// broadest pattern (any single-quoted lowercase token) would have counted a
// column named in any unrelated string as covered, the same over-permissive
// tokenizer that made check-saved-view-param-coverage unable to report the very
// orphans it existed to find.
//
// The scoring module now derives `from_plays_scored_columns` from its two role
// tables, so a column is covered exactly when a term or a role names it. No
// regex, no file paths, and nothing to go stale when a term moves.
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
  const referenced = new Set(from_plays_scored_columns)

  // The map is derived from both role tables, and a column reaching it from
  // only one of them would make the coverage assertion silently partial. These
  // three are one per source: a plays-sourced term, a flat stat-sourced role,
  // and the field-goal role, whose columns come from its band list rather than
  // from a `column` property like every other role's.
  it('the derived map draws from every role source', () => {
    expect(referenced.has('passing_yards'), 'plays-sourced term').to.eq(true)
    expect(referenced.has('fumbles_lost'), 'flat stat-sourced role').to.eq(true)
    expect(
      referenced.has('field_goals_made_50_plus_yards'),
      'field-goal role band list'
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
