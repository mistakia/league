/* global describe before it after */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import { user1 } from './fixtures/token.mjs'

chai.use(chai_http)
const { regular_season_start } = current_season
const expect = chai.expect

// The odds table on the league front page links each team to its page and shows
// its all-time title count, and names the defending champion beside the
// projections. Both facts ride on GET /teams. These specs pin the wire shape: a
// league with no careerlog, and no concluded prior season, must still answer
// with typed defaults rather than a missing key, and the defending champion is
// the winner of the season BEFORE the current one -- `current_season.year - 1`,
// not the current season, whose overall_finish is not written until the
// playoffs conclude.
describe('teams championships wire', function () {
  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())

    await knex.seed.run()
    await league(knex)
  })

  after(() => {
    MockDate.reset()
  })

  it('defaults both fields for a league with no title history', async () => {
    const res = await chai_request
      .execute(server)
      .get('/api/leagues/1/teams')
      .set('Authorization', `Bearer ${user1}`)

    expect(res).to.have.status(200)
    expect(res.body.teams.length).to.be.above(0)

    for (const team of res.body.teams) {
      expect(team.championships, `championships of ${team.team_id}`).to.equal(0)
      expect(
        team.is_defending_champion,
        `defending flag of ${team.team_id}`
      ).to.equal(false)
    }
  })

  it('carries the all-time count and the winner of the prior season', async () => {
    // Team 1 owns three all-time titles but is not the current champion; team 2
    // won the single most recently completed season.
    await knex('league_team_careerlogs').insert({
      lid: 1,
      tid: 1,
      championships: 3
    })
    await knex('league_team_careerlogs').insert({
      lid: 1,
      tid: 2,
      championships: 1
    })
    await knex('league_team_seasonlogs').insert({
      lid: 1,
      tid: 2,
      season_year: current_season.year - 1,
      division: 1,
      overall_finish: 1
    })

    const res = await chai_request
      .execute(server)
      .get('/api/leagues/1/teams')
      .set('Authorization', `Bearer ${user1}`)

    expect(res).to.have.status(200)
    const teams = res.body.teams

    const team_1 = teams.find((t) => t.team_id === 1)
    const team_2 = teams.find((t) => t.team_id === 2)
    expect(team_1.championships).to.equal(3)
    expect(team_1.is_defending_champion).to.equal(false)
    expect(team_2.championships).to.equal(1)
    expect(team_2.is_defending_champion).to.equal(true)
  })
})
