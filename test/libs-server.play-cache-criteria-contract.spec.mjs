/* global describe it beforeEach */

import * as chai from 'chai'

import { find_play, reset_cache } from '#libs-server/play-cache.mjs'

const expect = chai.expect

// `find_play` names its criteria in a destructure, so a key it does not name is
// dropped rather than applied -- and an absent filter matches EVERY play. The
// caller believes it constrained one more axis and instead widened the search,
// which reads as "ambiguous, no confident match" or, worse, as a match on the
// wrong play. `import-plays-charting` and `import-plays-sportradar` both passed
// the nfl_plays column names `qtr` and `dwn` to parameters called `quarter` and
// `down_number`, so neither constrained quarter or down at all; the identical
// defect cost PlayerProfiler two seasons of charting before anyone saw it.
//
// The guard therefore runs BEFORE the cache-initialized check: a criterion the
// function cannot honor is a programming error at the call site, independent of
// whether plays happen to be loaded, and these cases prove it by asserting on an
// uninitialized cache. The last case is the negative control -- valid criteria
// must fall through to the initialization error, or a guard that rejected
// everything would pass the rejection cases just as well.
describe('LIBS-SERVER play cache criteria contract', function () {
  beforeEach(function () {
    reset_cache()
  })

  it('rejects the dropped nfl_plays column names qtr and dwn', function () {
    expect(() =>
      find_play({
        esbid: 99000001,
        qtr: 1,
        dwn: 2,
        yards_to_go: 10,
        yard_line_100: 75
      })
    ).to.throw(/does not accept: qtr, dwn/)
  })

  it('names every unrecognized key it rejected', function () {
    expect(() =>
      find_play({ esbid: 99000001, quarter: 1, down: 2, offense: 'KC' })
    ).to.throw(/does not accept: down, offense/)
  })

  // week and season_year were accepted and then never used -- the same silent
  // widening one step down, since the signature promised a narrowing the body
  // did not perform. esbid already fixes the game, so they were redundant
  // rather than unimplemented, and dropping them puts them under the guard.
  it('rejects week and season_year, which esbid already determines', function () {
    expect(() =>
      find_play({ esbid: 99000001, week: 1, season_year: 2024 })
    ).to.throw(/does not accept: week, season_year/)
  })

  it('accepts every criterion it does name', function () {
    expect(() =>
      find_play({
        esbid: 99000001,
        play_id: 1,
        offense_nfl_team: 'KC',
        defense_nfl_team: 'DEN',
        quarter: 1,
        game_clock_start: '15:00',
        down_number: 1,
        yards_to_go: 10,
        play_type: 'PASS',
        yard_line_number: 25,
        yard_line_side: 'KC',
        yard_line_100: 75,
        seconds_remaining_quarter: 900,
        sec_rem_qtr_tolerance: 3,
        desc_contains: 'pass',
        timeout_team: 'KC',
        home_score: 0,
        away_score: 0,
        return_all_matches: true
      })
    ).to.throw(/not initialized/)
  })
})
