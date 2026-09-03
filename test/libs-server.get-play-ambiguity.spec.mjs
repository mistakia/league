/* global describe it before after */

import * as chai from 'chai'

import db from '#db'
import getPlay from '#libs-server/get-play.mjs'
import { MultiplePlayMatchError } from '#libs-server/play-cache.mjs'

const expect = chai.expect

// get-play returned plays[0] on one match and null on anything else, so "no
// such play" and "two plays answer to this description" were the same answer.
// import-charted-plays-from-csv reads null as a benign miss and continues, so a
// game that got duplicated in nfl_plays stopped being chartable and nothing
// reported it -- three years, one game, found only by an unrelated audit.
//
// The three cases below have to stay distinguishable from each other. The
// single-match and no-match cases are the controls: they are what a regression
// to the old `length === 1 ? plays[0] : null` would leave passing while the
// ambiguity case flips to a null return, failing on its own named assertion
// rather than on a shared one.

const YEAR = 2024
const WEEK = 3

const UNIQUE_ESBID = 99100001
const DUPLICATE_ESBID_A = 99100002
const DUPLICATE_ESBID_B = 99100003

const ALL_ESBIDS = [UNIQUE_ESBID, DUPLICATE_ESBID_A, DUPLICATE_ESBID_B]

// Every field get-play filters on, so the criteria below select on the whole
// key rather than accidentally matching on a subset.
const make_play = (overrides) => ({
  season_year: YEAR,
  week: WEEK,
  season_type: 'REG',
  offense_nfl_team: 'KC',
  defense_nfl_team: 'DEN',
  quarter: 2,
  game_clock_start: '07:15',
  down_number: 3,
  yards_to_go: 4,
  yard_line_100: 62,
  updated: new Date(),
  ...overrides
})

// The criteria the charting importer builds: game context, no esbid.
const shared_criteria = {
  week: WEEK,
  season_year: YEAR,
  offense_nfl_team: 'KC',
  defense_nfl_team: 'DEN',
  quarter: 2,
  game_clock_start: '07:15',
  down_number: 3,
  yards_to_go: 4,
  yard_line_100: 62
}

describe('LIBS-SERVER get-play ambiguity', function () {
  before(async () => {
    await db('nfl_plays').whereIn('esbid', ALL_ESBIDS).del()
    await db('nfl_plays').insert([
      // One play, matched by a criteria set that reaches nothing else.
      make_play({ esbid: UNIQUE_ESBID, play_id: 1, yard_line_100: 41 }),

      // The forked-game shape: the same play present under two esbids, which is
      // what a re-import that minted a second copy of a game produces.
      make_play({ esbid: DUPLICATE_ESBID_A, play_id: 1 }),
      make_play({ esbid: DUPLICATE_ESBID_B, play_id: 1 })
    ])
  })

  after(async () => {
    await db('nfl_plays').whereIn('esbid', ALL_ESBIDS).del()
  })

  it('returns the play when exactly one matches', async () => {
    const play = await getPlay({ ...shared_criteria, yard_line_100: 41 })

    expect(play, 'a single match must return the row').to.be.an('object')
    expect(play.esbid, 'single match returned the wrong play').to.equal(
      UNIQUE_ESBID
    )
  })

  it('returns null when nothing matches', async () => {
    const play = await getPlay({ ...shared_criteria, yard_line_100: 99 })

    expect(play, 'a miss must still be null, not an error').to.equal(null)
  })

  it('throws MultiplePlayMatchError when more than one matches', async () => {
    let thrown = null
    try {
      await getPlay(shared_criteria)
    } catch (err) {
      thrown = err
    }

    expect(
      thrown,
      'an ambiguous match must throw rather than return null -- returning null is the defect'
    ).to.be.instanceof(MultiplePlayMatchError)
    expect(thrown.match_count, 'the alarm must carry the match count').to.equal(
      2
    )

    // The caller has to be able to name the duplicates to resolve them, so the
    // identifying pair travels on the error rather than only the count.
    const matched = thrown.matching_plays
      .map((play) => play.esbid)
      .sort((a, b) => a - b)
    expect(matched, 'the alarm must name both matched plays').to.eql([
      DUPLICATE_ESBID_A,
      DUPLICATE_ESBID_B
    ])
  })
})
