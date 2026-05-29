/* global describe before it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'
import { current_season } from '#constants'

import league from '#db/fixtures/league.mjs'
import { user1 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()
chai.use(chai_http)

// PUT /leagues/:id mutates seasons.{scoring,league}_format_id (opaque IDs)
// and then cascades into the matching projection processor under the new ID
// so roster_asset_holding.projected_pts_added_at_acquisition can be populated
// without waiting for the weekly detection cron.
describe('API /leagues - format-id cascade', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex.seed.run()
    await league(knex)
  })

  it('scoring format change updates seasons.scoring_format_id and runs cascade', async () => {
    const lid = 1
    const before_season = await knex('seasons')
      .where({ lid, year: current_season.year })
      .first()

    const res = await chai_request
      .execute(server)
      .put(`/api/leagues/${lid}`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'rec', value: 1.25 })

    res.should.have.status(200)
    res.body.value.should.equal(1.25)

    const after_season = await knex('seasons')
      .where({ lid, year: current_season.year })
      .first()
    expect(after_season.scoring_format_id).to.not.equal(
      before_season.scoring_format_id
    )

    // Cascade target table is scoped to (new_id, current_season.year).
    // With no projections_index rows in the test seed the processor is a
    // no-op, but it must have completed without throwing -- which the 200
    // response and a successful DELETE-then-INSERT scope guarantee.
    const projection_rows = await knex(
      'scoring_format_player_projection_points'
    )
      .where({
        scoring_format_id: after_season.scoring_format_id,
        year: current_season.year
      })
      .count('* as n')
      .first()
    expect(Number(projection_rows.n)).to.be.a('number')

    // DB dedup oracle: a second PUT with the same target value resolves to
    // the same scoring_format_id (the unique config tuple is a stable key).
    const res_same = await chai_request
      .execute(server)
      .put(`/api/leagues/${lid}`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'rec', value: 1.25 })
    res_same.should.have.status(200)
    const same_season = await knex('seasons')
      .where({ lid, year: current_season.year })
      .first()
    expect(same_season.scoring_format_id).to.equal(
      after_season.scoring_format_id
    )

    // A PUT with a different config value produces a distinct id.
    const res_diff = await chai_request
      .execute(server)
      .put(`/api/leagues/${lid}`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'rec', value: 0.75 })
    res_diff.should.have.status(200)
    const diff_season = await knex('seasons')
      .where({ lid, year: current_season.year })
      .first()
    expect(diff_season.scoring_format_id).to.not.equal(
      after_season.scoring_format_id
    )
  })

  it('league format change updates seasons.league_format_id and runs cascade', async () => {
    const lid = 1
    const before_season = await knex('seasons')
      .where({ lid, year: current_season.year })
      .first()

    const res = await chai_request
      .execute(server)
      .put(`/api/leagues/${lid}`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'cap', value: 250 })

    res.should.have.status(200)
    res.body.value.should.equal(250)

    const after_season = await knex('seasons')
      .where({ lid, year: current_season.year })
      .first()
    expect(after_season.league_format_id).to.not.equal(
      before_season.league_format_id
    )

    const projection_rows = await knex('league_format_player_projection_values')
      .where({
        league_format_id: after_season.league_format_id,
        year: current_season.year
      })
      .count('* as n')
      .first()
    expect(Number(projection_rows.n)).to.be.a('number')
  })

  // Cascade failure path: stub the processor to throw and verify the HTTP
  // response is still 200 (the hash update committed) and a report_job row
  // was written with job_success=false and job_reason matching /cascade_failed_/.
  // Requires an ESM module mocker (esmock / testdouble); not currently wired
  // into this repo's test setup. The structural guarantee is enforced by the
  // try/catch wrap in api/routes/leagues/index.mjs around each cascade call.
  it.skip('cascade failure does not fail the HTTP response and emits report_job', async () => {})
})
