/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import cache from '#api/cache.mjs'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import getLeague from '#libs-server/get-league.mjs'
import { current_season } from '#constants'
import { user1 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect

// NULL on a period table means "never in the drawn pool", and the payload spells
// that by OMITTING the key. This file exists because the difference between
// omitting it and emitting `null` is invisible on the server and reorders two
// user-facing surfaces on the client.
//
// `app/core/selectors.js` and `app/views/pages/draft/draft.js` both sort with
// `getIn(['pts_added', 'season'], default_points_added)`. An Immutable
// notSetValue fires on an ABSENT key and NOT on a present null, so:
//
//   key omitted -> comparator sees -999 -> the player sorts LAST, correctly
//   key null    -> comparator sees 0    -> the player lands MID-BOARD
//
// Neither path throws, logs, or fails a type check. The players list and the
// draft board simply come out in a different order, with every unprojected
// player scattered through the middle of the real ones.
//
// So the assertions here are on KEY PRESENCE, not on the value. A spec that
// asserted `pts_added.season` was falsy would pass on both spellings and cover
// nothing.
describe('API /players - projection period payload', function () {
  const league_id = 1
  const season_year = current_season.year

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

    // Format-scoped, so the league reset does not clear it.
    await knex('league_format_player_season_projection_values')
      .where({ season_year })
      .del()

    for (const key of cache.keys()) {
      cache.del(key)
    }
  })

  // Run as a PAIR against a control in the same response. A single NULL row
  // cannot tell "the key was omitted because it was NULL" from "this route never
  // emits the key at all", and the second reading passes every assertion the
  // first one would.
  it('omits a NULL period key and emits a populated one', async function () {
    this.timeout(60 * 1000)

    const league_row = await getLeague({ lid: league_id })
    expect(league_row.league_format_id, 'the fixture league has a format').to
      .exist

    const [priced, unpriced] = await knex('player')
      .orderBy('pid')
      .limit(2)
      .pluck('pid')
    expect(unpriced, 'two seeded players').to.exist

    await knex('league_format_player_season_projection_values').insert([
      {
        pid: priced,
        league_format_id: league_row.league_format_id,
        season_year,
        projected_points_added_positive: 42.5,
        projected_points_added_net: 31.25,
        market_salary_positive: 17,
        market_salary_net: 12
      },
      {
        // Every period column NULL: the row exists, the player has no value.
        pid: unpriced,
        league_format_id: league_row.league_format_id,
        season_year
      }
    ])

    const res = await chai_request
      .execute(server)
      .post('/api/players')
      .set('Authorization', `Bearer ${user1}`)
      .send({ leagueId: league_id, pids: [priced, unpriced] })

    res.should.have.status(200)

    const priced_row = res.body.find((p) => p.pid === priced)
    const unpriced_row = res.body.find((p) => p.pid === unpriced)
    expect(priced_row, 'priced player missing from response').to.exist
    expect(unpriced_row, 'unpriced player missing from response').to.exist

    // The control. If these fail the omission assertions below prove nothing.
    expect(Number(priced_row.pts_added.season)).to.equal(42.5)
    expect(Number(priced_row.pts_added.season_net)).to.equal(31.25)
    expect(Number(priced_row.market_salary.season)).to.equal(17)
    expect(Number(priced_row.market_salary.season_net)).to.equal(12)

    // The subject. `have.property` is what distinguishes the two spellings --
    // an equality check against undefined does not, because a null value and an
    // absent key both fail it the same way.
    expect(unpriced_row.pts_added).to.not.have.property('season')
    expect(unpriced_row.pts_added).to.not.have.property('season_net')
    expect(unpriced_row.market_salary).to.not.have.property('season')
    expect(unpriced_row.market_salary).to.not.have.property('season_net')
  })

  // A real 0 is a measurement, not an absence: a player who was in the drawn
  // pool all season and never cleared replacement is worth exactly nothing, and
  // he has to reach the client under the key so he sorts beside the other zeroes
  // rather than below the unprojected. This is the assertion that stops the
  // omission above from being implemented as a falsiness check.
  it('emits a period key holding a real zero', async function () {
    this.timeout(60 * 1000)

    const league_row = await getLeague({ lid: league_id })
    const [pid] = await knex('player').orderBy('pid').limit(1).pluck('pid')

    await knex('league_format_player_season_projection_values').insert({
      pid,
      league_format_id: league_row.league_format_id,
      season_year,
      projected_points_added_positive: 0,
      market_salary_positive: 0
    })

    const res = await chai_request
      .execute(server)
      .post('/api/players')
      .set('Authorization', `Bearer ${user1}`)
      .send({ leagueId: league_id, pids: [pid] })

    res.should.have.status(200)

    const row = res.body.find((p) => p.pid === pid)
    expect(row, 'player missing from response').to.exist
    expect(row.pts_added).to.have.property('season')
    expect(Number(row.pts_added.season)).to.equal(0)
    expect(row.market_salary).to.have.property('season')
    expect(Number(row.market_salary.season)).to.equal(0)
  })
})
