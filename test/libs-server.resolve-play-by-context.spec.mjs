/* global describe it before after */

import * as chai from 'chai'

import db from '#db'
import { preload_plays } from '#libs-server/play-cache.mjs'
import {
  PLAY_MATCH_TIERS,
  resolve_play_by_context
} from '#libs-server/resolve-play-by-context.mjs'

const expect = chai.expect

// The tier ladder is the fix for a defect that survived two seasons because it
// lived in a private submodule CI cannot check out, so nothing here had ever
// executed in a test. The defect: a caller passed `qtr` and `dwn` to a function
// destructuring `quarter` and `down_number`, so both criteria were silently
// dropped. An absent criterion is not an error in the cache -- an undefined
// filter matches EVERY play -- so the ladder went ambiguous or matched the
// wrong play rather than failing. The first case below is the negative control
// for exactly that, and it is the reason this file exists.

const YEAR = 2024
const WEEK = 1

const AMBIGUITY_ESBID = 99000001
const TOLERANCE_ESBID = 99000002
const IDENTICAL_ESBID = 99000003
const PENALTY_ESBID = 99000004

const ALL_ESBIDS = [
  AMBIGUITY_ESBID,
  TOLERANCE_ESBID,
  IDENTICAL_ESBID,
  PENALTY_ESBID
]

const make_play = (overrides) => ({
  season_year: YEAR,
  week: WEEK,
  season_type: 'REG',
  offense_nfl_team: 'KC',
  defense_nfl_team: 'DEN',
  updated: new Date(),
  ...overrides
})

describe('LIBS-SERVER resolve_play_by_context', function () {
  before(async () => {
    await db('nfl_plays').whereIn('esbid', ALL_ESBIDS).del()
    await db('nfl_plays').insert([
      // Two plays alike in everything the ladder matches on EXCEPT quarter and
      // down -- the shape the dropped-key defect could not tell apart.
      make_play({
        esbid: AMBIGUITY_ESBID,
        play_id: 1,
        quarter: 1,
        down_number: 1,
        yards_to_go: 10,
        yard_line_100: 75,
        seconds_remaining_quarter: 900
      }),
      make_play({
        esbid: AMBIGUITY_ESBID,
        play_id: 2,
        quarter: 3,
        down_number: 2,
        yards_to_go: 10,
        yard_line_100: 75,
        seconds_remaining_quarter: 400
      }),

      make_play({
        esbid: TOLERANCE_ESBID,
        play_id: 1,
        quarter: 2,
        down_number: 1,
        yards_to_go: 10,
        yard_line_100: 50,
        seconds_remaining_quarter: 600
      }),

      // Indistinguishable on every criterion the ladder has, including clock.
      make_play({
        esbid: IDENTICAL_ESBID,
        play_id: 1,
        quarter: 4,
        down_number: 2,
        yards_to_go: 5,
        yard_line_100: 30,
        seconds_remaining_quarter: 120
      }),
      make_play({
        esbid: IDENTICAL_ESBID,
        play_id: 2,
        quarter: 4,
        down_number: 2,
        yards_to_go: 5,
        yard_line_100: 30,
        seconds_remaining_quarter: 120
      }),

      // Distance disagrees with the feed while the snap spot does not -- what a
      // penalty or spot correction leaves behind.
      make_play({
        esbid: PENALTY_ESBID,
        play_id: 1,
        quarter: 2,
        down_number: 3,
        yards_to_go: 7,
        yard_line_100: 60,
        seconds_remaining_quarter: 300
      })
    ])

    await preload_plays({
      years: [YEAR],
      include_context_index: true,
      force_reload: true
    })
  })

  after(async () => {
    await db('nfl_plays').whereIn('esbid', ALL_ESBIDS).del()
  })

  // THE NEGATIVE CONTROL. Invert either half of this pair and the suite must go
  // red -- a resolver that returns a play for the first case is the defect this
  // module was extracted to make testable.
  it('resolves nothing without quarter and down, and exactly one with them', function () {
    const without_quarter_and_down = resolve_play_by_context({
      esbid: AMBIGUITY_ESBID,
      yards_to_go: 10,
      yard_line_100: 75,
      offense: 'KC',
      defense: 'DEN'
    })
    expect(without_quarter_and_down.play).to.equal(null)
    expect(without_quarter_and_down.tier).to.equal(null)

    const with_quarter_and_down = resolve_play_by_context({
      esbid: AMBIGUITY_ESBID,
      quarter: 1,
      down_number: 1,
      yards_to_go: 10,
      yard_line_100: 75,
      offense: 'KC',
      defense: 'DEN'
    })
    expect(with_quarter_and_down.play).to.not.equal(null)
    expect(with_quarter_and_down.play.play_id).to.equal(1)
  })

  it('falls to clock_within_tolerance for a clock two seconds off', function () {
    const { play, tier } = resolve_play_by_context({
      esbid: TOLERANCE_ESBID,
      quarter: 2,
      down_number: 1,
      yards_to_go: 10,
      yard_line_100: 50,
      offense: 'KC',
      defense: 'DEN',
      seconds_remaining_quarter: 598
    })
    expect(play).to.not.equal(null)
    expect(play.play_id).to.equal(1)
    expect(tier).to.equal('clock_within_tolerance')
  })

  // Order is the whole point of a ladder: a play matchable at two tiers must be
  // attributed to the TIGHTER one, or the tier counts stop measuring confidence.
  it('returns the tighter tier when a play matches at more than one', function () {
    const { play, tier } = resolve_play_by_context({
      esbid: TOLERANCE_ESBID,
      quarter: 2,
      down_number: 1,
      yards_to_go: 10,
      yard_line_100: 50,
      offense: 'KC',
      defense: 'DEN',
      seconds_remaining_quarter: 600
    })
    expect(play.play_id).to.equal(1)
    expect(tier).to.equal('clock_exact')
  })

  it('returns no play and no tier when candidates stay ambiguous', function () {
    const { play, tier } = resolve_play_by_context({
      esbid: IDENTICAL_ESBID,
      quarter: 4,
      down_number: 2,
      yards_to_go: 5,
      yard_line_100: 30,
      offense: 'KC',
      defense: 'DEN',
      seconds_remaining_quarter: 120
    })
    expect(play).to.equal(null)
    expect(tier).to.equal(null)
  })

  it('reaches the loosest tier when only distance disagrees', function () {
    const { play, tier } = resolve_play_by_context({
      esbid: PENALTY_ESBID,
      quarter: 2,
      down_number: 3,
      yards_to_go: 10,
      yard_line_100: 60,
      offense: 'KC',
      defense: 'DEN',
      seconds_remaining_quarter: 300
    })
    expect(play).to.not.equal(null)
    expect(play.play_id).to.equal(1)
    expect(tier).to.equal('down_distance_spot_any_distance')
  })

  // Pins the ladder itself. A fifth tier matching on down and distance while
  // dropping yard_line_100 was measured against the 2025 PlayerProfiler file and
  // rejected: it created 168 additional same-play collisions for 529 matches.
  // Re-adding it, or reordering these, must fail here rather than in production.
  it('carries exactly the four tiers, tightest first', function () {
    expect(PLAY_MATCH_TIERS.map((tier) => tier.name)).to.eql([
      'clock_exact',
      'clock_within_tolerance',
      'down_distance_spot',
      'down_distance_spot_any_distance'
    ])

    for (const tier of PLAY_MATCH_TIERS) {
      const filters = tier.build({
        quarter: 1,
        down_number: 1,
        yards_to_go: 10,
        yard_line_100: 75,
        offense: 'KC',
        defense: 'DEN',
        seconds_remaining_quarter: 900
      })
      const drops_yard_line = filters.yard_line_100 === undefined
      const keeps_yards_to_go = filters.yards_to_go !== undefined
      expect(
        drops_yard_line && keeps_yards_to_go,
        `tier ${tier.name} drops yard_line_100 while keeping yards_to_go`
      ).to.equal(false)
    }
  })
})
