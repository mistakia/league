/* global describe, before, after, it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import bcrypt from 'bcrypt'

import server from '#api'
import knex from '#db'
import { current_season, fantasy_positions } from '#constants'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
chai.should()

const expect = chai.expect

// The authenticated half of `GET /projections` joins `player` to filter user
// projections down to active fantasy-position players. Its projection and its
// join predicate were qualified to `projections`, a table that stopped existing
// when it was renamed to `projections_history`, so Postgres rejected the whole
// statement with 42P01 and the route's catch turned it into a 500 for EVERY
// authenticated caller. Anonymous callers never entered the block, which is
// why it survived.
//
// The statement was well-formed JavaScript the entire time, so nothing that
// inspects the knex builder can tell the broken revision from the repaired one
// -- only executing it against a real schema can. This spec therefore round
// trips through the route as an authenticated caller and asserts a 200 with
// the seeded row present.
describe('GET /api/projections returns user projections to an authenticated caller', function () {
  this.timeout(20000)

  const season_year = current_season.year
  const season_type = current_season.nfl_seas_type === 'POST' ? 'POST' : 'REG'

  let owner_token
  let owner_id
  let other_user_id
  let active_player
  let inactive_player

  const get_token = async (email, password) => {
    const res = await chai_request
      .execute(server)
      .post('/api/auth/login')
      .send({ email_or_username: email, password })
    return res.body.token
  }

  before(async function () {
    const salt = await bcrypt.genSalt(10)
    const password = await bcrypt.hash('projroute', salt)

    const [owner] = await knex('users')
      .insert({
        email: 'projections-route-owner@test.com',
        username: 'proj_route_owner',
        password
      })
      .returning('id')
    const [other] = await knex('users')
      .insert({
        email: 'projections-route-other@test.com',
        username: 'proj_route_other',
        password
      })
      .returning('id')

    owner_id = owner.id || owner
    other_user_id = other.id || other

    active_player = await knex('player')
      .whereIn('primary_position', fantasy_positions)
      .whereNot('current_nfl_team', 'INA')
      .orderBy('pid')
      .first()

    // The join exists to drop projections for players who are not active
    // fantasy-position players, so the spec seeds one of those too. A repair
    // that removed the join instead of qualifying it would pass every other
    // assertion here.
    inactive_player = await knex('player')
      .whereIn('primary_position', fantasy_positions)
      .where('current_nfl_team', 'INA')
      .orderBy('pid')
      .first()

    await knex('projections_index').insert([
      {
        pid: active_player.pid,
        user_id: owner_id,
        source_id: 0,
        week: 1,
        season_year,
        season_type,
        passing_yards: 275.5,
        passing_touchdowns: 2
      },
      {
        pid: inactive_player.pid,
        user_id: owner_id,
        source_id: 0,
        week: 1,
        season_year,
        season_type,
        passing_yards: 111
      },
      {
        pid: active_player.pid,
        user_id: other_user_id,
        source_id: 0,
        week: 1,
        season_year,
        season_type,
        passing_yards: 999
      }
    ])

    owner_token = await get_token(
      'projections-route-owner@test.com',
      'projroute'
    )
  })

  after(async function () {
    await knex('projections_index')
      .whereIn('user_id', [owner_id, other_user_id])
      .del()
    await knex('users').whereIn('id', [owner_id, other_user_id]).del()
  })

  it('answers 200 and carries the caller own projection', async function () {
    const res = await chai_request
      .execute(server)
      .get('/api/projections')
      .set('Authorization', `Bearer ${owner_token}`)

    res.should.have.status(200)
    res.body.should.be.an('array')

    const own = res.body.filter((row) => row.user_id === owner_id)
    own.length.should.equal(1)
    own[0].pid.should.equal(active_player.pid)
    own[0].week.should.equal(1)
    own[0].passing_yards.should.equal(275.5)
    own[0].season_year.should.equal(season_year)
    own[0].season_type.should.equal(season_type)
  })

  it('emits projections_index columns only, with no player columns merged in', async function () {
    const res = await chai_request
      .execute(server)
      .get('/api/projections')
      .set('Authorization', `Bearer ${owner_token}`)

    res.should.have.status(200)

    const [row] = res.body.filter((r) => r.user_id === owner_id)
    expect(row).to.not.equal(undefined)

    // The `.select()` on the joined query exists so `player`'s columns do not
    // collide into the payload. The SPA re-keys these rows by `row.week` and
    // strips a fixed metadata set, so an extra column would land in the stats
    // object it builds.
    expect(row).to.not.have.property('primary_position')
    expect(row).to.not.have.property('current_nfl_team')
    expect(row).to.not.have.property('formatted_name')

    const projections_index_columns = Object.keys(
      await knex('projections_index').columnInfo()
    )
    for (const key of Object.keys(row)) {
      projections_index_columns.should.include(key)
    }
  })

  it('excludes a projection for a player who is not on an nfl team', async function () {
    const res = await chai_request
      .execute(server)
      .get('/api/projections')
      .set('Authorization', `Bearer ${owner_token}`)

    res.should.have.status(200)
    const rows = res.body.filter(
      (row) => row.user_id === owner_id && row.pid === inactive_player.pid
    )
    rows.length.should.equal(0)
  })

  it('excludes another user projection', async function () {
    const res = await chai_request
      .execute(server)
      .get('/api/projections')
      .set('Authorization', `Bearer ${owner_token}`)

    res.should.have.status(200)
    const rows = res.body.filter((row) => row.user_id === other_user_id)
    rows.length.should.equal(0)
  })

  it('answers 200 to an anonymous caller and carries no user projections', async function () {
    const res = await chai_request.execute(server).get('/api/projections')

    res.should.have.status(200)
    res.body.should.be.an('array')
    const rows = res.body.filter(
      (row) => row.user_id === owner_id || row.user_id === other_user_id
    )
    rows.length.should.equal(0)
  })
})
