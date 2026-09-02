/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import { submit_auction_election } from '#libs-server/auction-elections.mjs'
import { user1, user2 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// A STANDING MAXIMUM IS A SEALED BID, and the standing-elections route is the
// surface that would most naturally show every one of them.
//
// `verifyUserTeam` authorizes a caller for a team when they own it OR when they
// are the league's commissioner, which is correct for the roster, lineup and
// trade routes it was written for -- a commissioner acting on a team's behalf is
// an ordinary administrative act there. It is not correct here. In this league
// the commissioner is a competing manager, and the design says so outright: the
// commissioner sees no standing maximum but their own, and no election route
// grants a commissioner scope.
//
// So this route is deliberately narrower than the helper it calls. Ownership,
// not authorization, decides who may read a team's ceilings.
describe('auction election scope', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  afterEach(function () {
    MockDate.reset()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await league(knex)

    // The elections write path refuses outside the free agency period, and the
    // shared league fixture configures none.
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })
  })

  // An unrostered player, so the election is accepted.
  const free_agent = async () => {
    const rostered = await knex('rosters_players')
      .join('rosters', 'rosters.roster_id', 'rosters_players.roster_id')
      .where('rosters.lid', league_id)
      .pluck('rosters_players.pid')

    const [player] = await knex('player')
      .whereNot('current_nfl_team', 'INA')
      .where('primary_position', 'RB')
      .whereNotIn('pid', rostered.length ? rostered : [''])
      .orderBy('pid')
      .limit(1)
    expect(player, 'an unrostered running back').to.exist
    return player.pid
  }

  const read_elections = ({ teamId, token }) =>
    chai_request
      .execute(server)
      .get(`/api/leagues/${league_id}/auction-elections?teamId=${teamId}`)
      .set('Authorization', `Bearer ${token}`)

  it("refuses the commissioner a rival team's standing maximums", async function () {
    this.timeout(60 * 1000)

    const pid = await free_agent()
    await submit_auction_election({
      lid: league_id,
      tid: 2,
      pid,
      user_id: 2,
      maximum_bid: 47,
      season_year
    })

    // user1 is the fixture league's commissioner and owns team 1; team 2 is
    // user2's.
    const res = await read_elections({ teamId: 2, token: user1 })

    expect(res.status, JSON.stringify(res.body)).to.equal(400)
    // Asserted on the CONTENT and not on the status alone: a route that returned
    // 400 while still serializing the rows would satisfy a status check and leak
    // the ceiling anyway.
    expect(JSON.stringify(res.body)).to.not.include('47')
  })

  it('serves a manager their own standing maximums', async function () {
    this.timeout(60 * 1000)

    const pid = await free_agent()
    await submit_auction_election({
      lid: league_id,
      tid: 2,
      pid,
      user_id: 2,
      maximum_bid: 47,
      season_year
    })

    const res = await read_elections({ teamId: 2, token: user2 })

    expect(res.status, JSON.stringify(res.body)).to.equal(200)
    const election = res.body.find((row) => row.pid === pid)
    expect(election, 'the team reads its own election').to.exist
    expect(election.maximum_bid).to.equal(47)
  })

  it('serves the commissioner their OWN standing maximums', async function () {
    this.timeout(60 * 1000)

    const pid = await free_agent()
    await submit_auction_election({
      lid: league_id,
      tid: 1,
      pid,
      user_id: 1,
      maximum_bid: 12,
      season_year
    })

    const res = await read_elections({ teamId: 1, token: user1 })

    expect(res.status, JSON.stringify(res.body)).to.equal(200)
    const election = res.body.find((row) => row.pid === pid)
    expect(election, 'the commissioner reads their own election').to.exist
    expect(election.maximum_bid).to.equal(12)
  })
})
