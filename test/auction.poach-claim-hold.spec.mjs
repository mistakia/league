/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  waiver_types
} from '#constants'
import { addPlayer, selectPlayer } from './utils/index.mjs'
import run from '#scripts/process-poaching-claims.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// A POACH FILLS AN ACTIVE ROSTER SPOT WITHOUT PASSING THROUGH SETTLEMENT.
//
// Eligibility monotonicity is the assumption second-price settlement rests on --
// a team that leaves an eligible set never re-enters it, so completeness once
// reached stays reached. Every mid-auction roster change therefore has to go
// through the auction or be held, and a poach awarded during the auction does
// neither: the team drops out of the open player's eligible set for a reason the
// auction never sees.
//
// The poaching WAIVER runner already holds for this. The CLAIMS runner did not,
// and it is the one with no per-league loop, so the hold has to be a
// league-dimension filter on both the work and the oracle -- a claim excluded
// from the work but counted by the oracle is a false shortfall on every run of
// an auction week.
//
// What this holds is narrow and real: submission is refused for the whole period
// by sanctuary period 3, so the claims that reach here were submitted in the 48
// hours BEFORE the period opened and come due inside it.
describe('poaching claims hold until the auction completes', function () {
  const claim_at = current_season.regular_season_start.subtract(1, 'month')
  const process_at = claim_at.add(2, 'day').add(1, 'minute')

  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(claim_at.toISOString())
    await knex.seed.run()
  })

  afterEach(function () {
    MockDate.reset()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(claim_at.toISOString())
    await league(knex)
  })

  // A claim submitted before the period opened, exactly as the ordinary poach
  // path writes one.
  const submit_claim = async () => {
    const player = await selectPlayer({ rookie: true })
    await addPlayer({
      leagueId: league_id,
      player,
      teamId: 1,
      userId: 1,
      slot: roster_slot_types.PS,
      transaction: transaction_types.DRAFT,
      value: 1
    })

    await knex('waivers').insert({
      tid: 2,
      user_id: 2,
      lid: league_id,
      pid: player.pid,
      priority_order: 9999,
      submitted: new Date(),
      bid_amount: 0,
      is_successful: 1,
      processed: new Date(),
      type: waiver_types.POACH
    })

    await knex('poaches').insert({
      user_id: 2,
      tid: 2,
      lid: league_id,
      pid: player.pid,
      player_tid: 1,
      submitted: new Date()
    })

    return player
  }

  const set_period = async ({ start, end }) =>
    knex('seasons').where({ lid: league_id, season_year }).update({
      free_agency_period_start: start.toDate(),
      free_agency_period_end: end.toDate()
    })

  it('holds a claim that comes due inside a running auction', async function () {
    this.timeout(60 * 1000)
    const player = await submit_claim()

    // The period opens between the claim and its processing instant, which is
    // the whole window this closes.
    await set_period({
      start: claim_at.add(1, 'day'),
      end: claim_at.add(10, 'day')
    })

    MockDate.set(process_at.toISOString())
    const result = await run()

    const claim = await knex('poaches')
      .where({ lid: league_id, pid: player.pid })
      .first()
    expect(claim.processed, 'the claim is held, not processed').to.equal(null)

    // HELD, NOT FAILED. The oracle has to apply the same filter or the hold
    // reports itself as a pipeline failure on every run of an auction week.
    expect(result.shortfall, 'a hold is not a shortfall').to.equal(null)
  })

  it('processes the claim once the period has closed', async function () {
    this.timeout(60 * 1000)
    const player = await submit_claim()

    // The control. Same claim, same clock, and the only thing that differs is
    // whether the auction is running -- without this pair the assertion above
    // would pass just as well against a runner that processes nothing at all.
    await set_period({
      start: claim_at.subtract(3, 'month'),
      end: claim_at.subtract(1, 'month')
    })

    MockDate.set(process_at.toISOString())
    await run()

    const claim = await knex('poaches')
      .where({ lid: league_id, pid: player.pid })
      .first()
    expect(claim.processed, 'the claim is processed').to.not.equal(null)
  })
})
