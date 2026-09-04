/* global describe it */
import * as chai from 'chai'

import {
  build_esbid_chunks,
  NFL_PLAYS_ESBID_CHUNK_SIZE
} from '#scripts/calculate-historical-hit-rates.mjs'

const expect = chai.expect

// The two nfl_plays enrichment queries bound their esbid list straight from
// player_gamelogs, which carries one row per player per game. A run scoped to
// 2025 loaded 74,361 gamelogs for its players -- every season those players ever
// played -- and bound 74,368 parameters.
//
// Postgres accepts at most 65,535 parameters in a statement and does not report
// the overflow as a limit: the 16-bit count wraps. The run died with
// "bind message has 8832 parameter formats but 0 parameters" (74368 - 65536 =
// 8832) before writing a single row, so the full-season recompute the corrected
// grader needs could not run at all.
//
// Two properties fix it and both are asserted below: the list is deduplicated,
// which is what makes it small (a season is about 285 distinct games behind
// about 36,000 gamelog rows), and it is chunked, which is what keeps it bounded
// however many seasons a run spans.

const POSTGRES_MAX_BIND_PARAMETERS = 65535

// One esbid repeated once per player, the shape player_gamelogs actually
// produces: 6,900 distinct games behind 74,368 rows.
const distinct_games = 6900
const players_per_game = 11
const gamelog_esbids = []
for (let game = 0; game < distinct_games; game++) {
  for (let player = 0; player < players_per_game; player++) {
    gamelog_esbids.push(2025000000 + game)
  }
}

describe('hit-rate nfl_plays esbid chunking', function () {
  it('deduplicates the gamelog esbid list', function () {
    const chunks = build_esbid_chunks(gamelog_esbids)
    const bound = chunks.flat()

    expect(gamelog_esbids.length).to.equal(75900)
    expect(bound.length).to.equal(distinct_games)
    expect(new Set(bound).size).to.equal(distinct_games)
  })

  it('binds no chunk above the chunk size', function () {
    const chunks = build_esbid_chunks(gamelog_esbids)

    expect(chunks.length).to.be.greaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).to.be.at.most(NFL_PLAYS_ESBID_CHUNK_SIZE)
    }
  })

  // The control: the unchunked list is what the run bound before this change,
  // and it exceeds what Postgres can accept. Without this assertion a chunk size
  // raised above the ceiling would still pass the two checks above.
  it('keeps every chunk under the postgres parameter ceiling', function () {
    expect(gamelog_esbids.length).to.be.greaterThan(
      POSTGRES_MAX_BIND_PARAMETERS
    )

    for (const chunk of build_esbid_chunks(gamelog_esbids)) {
      expect(chunk.length).to.be.below(POSTGRES_MAX_BIND_PARAMETERS)
    }
  })

  it('loses no esbid to chunking', function () {
    const bound = new Set(build_esbid_chunks(gamelog_esbids).flat())

    for (const esbid of gamelog_esbids) {
      expect(bound.has(esbid)).to.equal(true)
    }
  })

  it('returns no chunk for an empty list', function () {
    expect(build_esbid_chunks([])).to.deep.equal([])
  })
})
