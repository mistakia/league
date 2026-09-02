/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import getLeague from '#libs-server/get-league.mjs'
import { current_season, AUCTION_BLOCK_GRANULARITY_MINUTES } from '#constants'
import {
  evaluate_auction_block_finalization,
  get_block_eligible_team_ids,
  get_finalized_auction_blocks
} from '#libs-server/auction-blocks.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// FINALIZATION HAS SEVERAL EVALUATORS IN FLIGHT AT ONCE, ALWAYS.
//
// It runs on the opt-in write AND on every read of the schedule -- the calendar,
// the block route, and the socket's mode poll every fifteen seconds -- which is
// deliberate: an eligible set SHRINKING reaches unanimity with no write path of
// its own, and evaluating on read is what covers that without a runner. The cost
// is that concurrent evaluation is the normal case rather than an edge.
//
// Unserialised they each read the finalized set before any of them writes, and
// then disagree about what a slot needs. The unique index settles insert against
// insert and nothing else: an EXTEND racing an INSERT put a 09:00-09:30 session
// and a duplicate 09:15-09:30 on the same league during an end-to-end drive --
// a phantom session on the calendar, and a second convening announcement for a
// block the league had already been told about.
describe('auction block finalization under concurrent evaluation', function () {
  let now

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  afterEach(function () {
    MockDate.reset()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    now = current_season.regular_season_start.subtract(1, 'month')
    MockDate.set(now.toISOString())
    await league(knex)

    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: now.subtract(1, 'hour').toDate(),
        free_agency_period_end: now.add(5, 'day').toDate(),
        auction_block_notice_minutes: 60
      })
  })

  // Two adjacent slots, both unanimous, well outside the notice threshold.
  //
  // The opt-in rows are written STRAIGHT TO THE TABLE rather than through
  // `set_auction_block_opt_in`, which evaluates finalization on the way out and
  // would leave nothing for the racing evaluations below to do -- an empty race
  // passes every assertion here while exercising none of them.
  const opt_everyone_into_two_consecutive_slots = async () => {
    const league_record = await getLeague({ lid: league_id })
    const eligible = await get_block_eligible_team_ids({
      lid: league_id,
      season_year,
      league: league_record
    })
    expect(eligible.length, 'the fixture has teams with room').to.be.above(1)

    const first = now.add(4, 'hour').startOf('hour')
    const second = first.add(AUCTION_BLOCK_GRANULARITY_MINUTES, 'minute')

    for (const block_at of [first, second]) {
      for (const tid of eligible) {
        await knex('auction_block_opt_ins').insert({
          lid: league_id,
          season_year,
          tid,
          user_id: 1,
          block_at: block_at.toDate(),
          opted_in_at: new Date(),
          withdrawn_at: null
        })
      }
    }

    const before = await get_finalized_auction_blocks({
      lid: league_id,
      season_year
    })
    expect(before, 'nothing is finalized before the race').to.have.length(0)

    return { first, second, league: league_record }
  }

  it('runs two consecutive unanimous slots as ONE session', async function () {
    this.timeout(60 * 1000)
    const { first, second } = await opt_everyone_into_two_consecutive_slots()

    await evaluate_auction_block_finalization({
      lid: league_id,
      season_year,
      now,
      announce: async () => {}
    })

    const blocks = await get_finalized_auction_blocks({
      lid: league_id,
      season_year
    })
    expect(blocks, 'one session, not two').to.have.length(1)
    expect(new Date(blocks[0].block_at).valueOf()).to.equal(first.valueOf())
    expect(
      new Date(blocks[0].end_at).valueOf(),
      'extended across the second slot'
    ).to.equal(
      second.add(AUCTION_BLOCK_GRANULARITY_MINUTES, 'minute').valueOf()
    )
  })

  it('still runs them as ONE session when several evaluations race', async function () {
    this.timeout(60 * 1000)
    const { first, second } = await opt_everyone_into_two_consecutive_slots()

    // FIVE AT ONCE, which is not a contrived number: an opt-in POST evaluates,
    // the calendar read evaluates, the block route evaluates, and the socket
    // polls mode every fifteen seconds -- all against one league.
    await Promise.all(
      Array.from({ length: 5 }, () =>
        evaluate_auction_block_finalization({
          lid: league_id,
          season_year,
          now,
          announce: async () => {}
        })
      )
    )

    const blocks = await get_finalized_auction_blocks({
      lid: league_id,
      season_year
    })

    // THE ASSERTION THIS SPEC EXISTS FOR. Without the lock one evaluator extends
    // the first session across the second slot while another, reading the state
    // from before that write, finds no adjacent session and inserts a fresh row
    // for the same slot -- and the unique index cannot see the collision because
    // the two writes are an UPDATE and an INSERT of different rows.
    expect(blocks, 'one session, not a duplicate').to.have.length(1)
    expect(new Date(blocks[0].block_at).valueOf()).to.equal(first.valueOf())
    expect(new Date(blocks[0].end_at).valueOf()).to.equal(
      second.add(AUCTION_BLOCK_GRANULARITY_MINUTES, 'minute').valueOf()
    )
  })

  it('announces a convened session exactly once across racing evaluations', async function () {
    this.timeout(60 * 1000)
    await opt_everyone_into_two_consecutive_slots()

    const announced = []
    await Promise.all(
      Array.from({ length: 5 }, () =>
        evaluate_auction_block_finalization({
          lid: league_id,
          season_year,
          now,
          announce: async ({ block }) => announced.push(block)
        })
      )
    )

    // A CONVENING ANNOUNCEMENT IS THE ONE MESSAGE THAT ASKS MANAGERS TO SHOW UP,
    // so telling them twice about one session is not cosmetic. Two slots merge
    // into one session, so the honest count is one convening plus one extension.
    expect(announced.length, 'one convening and one extension').to.equal(2)
    expect(
      announced.filter((block) => !block.merged_slot_at),
      'exactly one fresh convening'
    ).to.have.length(1)
  })
})
