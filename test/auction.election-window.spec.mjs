/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import {
  submit_auction_election,
  withdraw_auction_election
} from '#libs-server/auction-elections.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// Every submission below is one the write path would ACCEPT but for the window:
// a team in the league, an unrostered player, a whole-dollar maximum, and a
// user authorized for that team. That is the point -- an input that also fails
// eligibility or authorization would be refused with the gate removed too, and
// the spec would certify a check it never exercised.
const valid_submission = async (overrides = {}) => {
  const player = await selectPlayer({
    exclude_rostered_players: true,
    random: false
  })
  return {
    lid: league_id,
    tid: 2,
    pid: player.pid,
    user_id: 1,
    maximum_bid: 7,
    ...overrides
  }
}

const set_period = async ({ start, end }) => {
  await knex('seasons')
    .where({ lid: league_id, season_year })
    .update({
      free_agency_period_start: start ? start.toDate() : null,
      free_agency_period_end: end ? end.toDate() : null
    })
}

const capture = async (promise) => {
  try {
    await promise
    return null
  } catch (error) {
    return error
  }
}

describe('auction elections free agency window', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
  })

  const count_elections = async () => {
    const rows = await knex('auction_elections').where({
      lid: league_id,
      season_year
    })
    return rows.length
  }

  it('refuses a maximum before the period opens', async function () {
    await set_period({
      start: current_season.regular_season_start.subtract(1, 'week'),
      end: current_season.regular_season_start
    })

    const error = await capture(
      submit_auction_election(await valid_submission())
    )

    expect(error).to.not.equal(null)
    expect(error.message).to.include('has not opened')
    expect(error.is_auction_election_error).to.equal(true)
    expect(await count_elections()).to.equal(0)
  })

  it('refuses a maximum after the period closes', async function () {
    await set_period({
      start: current_season.regular_season_start.subtract(6, 'months'),
      end: current_season.regular_season_start.subtract(3, 'months')
    })

    const error = await capture(
      submit_auction_election(await valid_submission())
    )

    expect(error).to.not.equal(null)
    expect(error.message).to.include('has closed')
    expect(await count_elections()).to.equal(0)
  })

  it('refuses a league with no free agency period at all', async function () {
    // The shared league fixture ships this way, and it is the state league 1
    // was in before its dates were configured. It must refuse rather than
    // treating an absent period as an open one.
    await set_period({ start: null, end: null })

    const error = await capture(
      submit_auction_election(await valid_submission())
    )

    expect(error).to.not.equal(null)
    expect(error.message).to.include('no free agency period configured')
    expect(await count_elections()).to.equal(0)
  })

  it('refuses a withdrawal outside the period', async function () {
    // Open the period, place a real election, then close the period and try to
    // withdraw it. Withdrawal is a separate write path and had the same hole.
    await set_period({
      start: current_season.regular_season_start.subtract(2, 'months'),
      end: current_season.regular_season_start
    })
    const submission = await valid_submission()
    await submit_auction_election(submission)
    expect(await count_elections()).to.equal(1)

    await set_period({
      start: current_season.regular_season_start.subtract(6, 'months'),
      end: current_season.regular_season_start.subtract(3, 'months')
    })

    const error = await capture(
      withdraw_auction_election({
        lid: league_id,
        tid: submission.tid,
        pid: submission.pid
      })
    )

    expect(error).to.not.equal(null)
    expect(error.message).to.include('has closed')

    const [row] = await knex('auction_elections').where({ lid: league_id })
    expect(row.withdrawn_at).to.equal(null)
  })

  it('accepts the same submission inside the period', async function () {
    // THE CONTROL. Without it the four refusals above are satisfied by a write
    // path that refuses everything, and prove nothing about the window.
    await set_period({
      start: current_season.regular_season_start.subtract(2, 'months'),
      end: current_season.regular_season_start
    })

    const error = await capture(
      submit_auction_election(await valid_submission())
    )

    expect(error).to.equal(null)
    expect(await count_elections()).to.equal(1)
  })

  it('accepts a withdrawal inside the period', async function () {
    await set_period({
      start: current_season.regular_season_start.subtract(2, 'months'),
      end: current_season.regular_season_start
    })
    const submission = await valid_submission()
    await submit_auction_election(submission)

    const error = await capture(
      withdraw_auction_election({
        lid: league_id,
        tid: submission.tid,
        pid: submission.pid
      })
    )

    expect(error).to.equal(null)
    const [row] = await knex('auction_elections').where({ lid: league_id })
    expect(row.withdrawn_at).to.not.equal(null)
  })
})
