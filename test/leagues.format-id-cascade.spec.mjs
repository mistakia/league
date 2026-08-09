/* global describe before after it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'
import { current_season, external_data_sources } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'

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

  // The overflowing projection row the cascade-failure test seeds must not
  // outlive this file: `projections_index` is not reset by db/fixtures/league.mjs,
  // and a row scoring past numeric(5,2) would break any later spec that runs a
  // projection processor for the current year.
  let projection_pid = null

  before(async function () {
    await knex.seed.run()
    await league(knex)
  })

  after(async function () {
    if (projection_pid) {
      await knex('projections_index')
        .where({
          pid: projection_pid,
          season_year: current_season.year,
          sourceid: external_data_sources.AVERAGE
        })
        .del()
    }
  })

  // A run-scoped count rather than an absolute one: test/global.mjs drops
  // tables once per RUN, not per spec file, so an earlier spec's failed job
  // would make an absolute assertion wrong for reasons that have nothing to do
  // with this route.
  const count_failed_projection_jobs = async () => {
    const row = await knex('jobs')
      .where({ type: job_types.PROCESS_PROJECTIONS, is_successful: false })
      .count('* as n')
      .first()
    return Number(row.n)
  }

  it('scoring format change updates seasons.scoring_format_id and runs cascade', async () => {
    const lid = 1
    const failed_jobs_before = await count_failed_projection_jobs()
    const before_season = await knex('seasons')
      .where({ lid, season_year: current_season.year })
      .first()

    const res = await chai_request
      .execute(server)
      .put(`/api/leagues/${lid}`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'receptions', value: 1.25 })

    res.should.have.status(200)
    res.body.value.should.equal(1.25)

    const after_season = await knex('seasons')
      .where({ lid, season_year: current_season.year })
      .first()
    expect(after_season.scoring_format_id).to.not.equal(
      before_season.scoring_format_id
    )

    // Cascade target table is scoped to (new_id, current_season.year). No seed
    // inserts projections_index rows, so the processor is a no-op and the slice
    // is empty -- an exact count, not a shape check.
    const projection_rows = await knex(
      'scoring_format_player_projection_points'
    )
      .where({
        scoring_format_id: after_season.scoring_format_id,
        season_year: current_season.year
      })
      .count('* as n')
      .first()
    expect(Number(projection_rows.n)).to.equal(0)

    // The cascade must have completed WITHOUT throwing, and the 200 response is
    // not evidence of that: the route catches a cascade failure and still
    // answers 200, which the third test in this file pins. The only oracle that
    // separates the two is the absence of a new failed `jobs` row.
    const failed_jobs_after = await count_failed_projection_jobs()
    expect(failed_jobs_after).to.equal(failed_jobs_before)

    // DB dedup oracle: a second PUT with the same target value resolves to
    // the same scoring_format_id (the unique config tuple is a stable key).
    const res_same = await chai_request
      .execute(server)
      .put(`/api/leagues/${lid}`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'receptions', value: 1.25 })
    res_same.should.have.status(200)
    const same_season = await knex('seasons')
      .where({ lid, season_year: current_season.year })
      .first()
    expect(same_season.scoring_format_id).to.equal(
      after_season.scoring_format_id
    )

    // A PUT with a different config value produces a distinct id.
    const res_diff = await chai_request
      .execute(server)
      .put(`/api/leagues/${lid}`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'receptions', value: 0.75 })
    res_diff.should.have.status(200)
    const diff_season = await knex('seasons')
      .where({ lid, season_year: current_season.year })
      .first()
    expect(diff_season.scoring_format_id).to.not.equal(
      after_season.scoring_format_id
    )
  })

  it('league format change updates seasons.league_format_id and runs cascade', async () => {
    const lid = 1
    const failed_jobs_before = await count_failed_projection_jobs()
    const before_season = await knex('seasons')
      .where({ lid, season_year: current_season.year })
      .first()

    const res = await chai_request
      .execute(server)
      .put(`/api/leagues/${lid}`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'cap', value: 250 })

    res.should.have.status(200)
    res.body.value.should.equal(250)

    const after_season = await knex('seasons')
      .where({ lid, season_year: current_season.year })
      .first()
    expect(after_season.league_format_id).to.not.equal(
      before_season.league_format_id
    )

    const projection_rows = await knex('league_format_player_projection_values')
      .where({
        league_format_id: after_season.league_format_id,
        season_year: current_season.year
      })
      .count('* as n')
      .first()
    expect(Number(projection_rows.n)).to.equal(0)

    // Same oracle as above: a 200 does not mean the cascade succeeded.
    const failed_jobs_after = await count_failed_projection_jobs()
    expect(failed_jobs_after).to.equal(failed_jobs_before)
  })

  // Cascade failure path. The processor runs for REAL rather than being
  // stubbed, so no ESM module mocker is needed: a projections_index AVERAGE
  // row whose scored total overflows
  // scoring_format_player_projection_points.projected_points_total
  // (numeric(5,2)) makes process_projections_for_scoring_format throw from
  // inside its batch insert -- the same shape a bad upstream projection feed
  // produces in production. The route's try/catch must still answer 200 with
  // the format id already committed, and record the failure in `jobs`.
  //
  // Note the columns are `is_successful` / `reason` on `jobs`; `report_job`'s
  // arguments are named job_success / job_reason and do not match the table.
  it('cascade failure does not fail the HTTP response and records a failed job', async () => {
    const lid = 1
    const player_row = await knex('player')
      .where({ primary_position: 'QB' })
      .first()

    projection_pid = player_row.pid
    await knex('projections_index').insert({
      pid: projection_pid,
      sourceid: external_data_sources.AVERAGE,
      userid: 0,
      week: 1,
      season_year: current_season.year,
      season_type: 'REG',
      passing_yards: 9999.9,
      passing_touchdowns: 99.9,
      rushing_yards: 9999.9,
      rushing_touchdowns: 99.9,
      receiving_yards: 9999.9,
      receiving_touchdowns: 99.9,
      receptions: 999.9
    })

    const res = await chai_request
      .execute(server)
      .put(`/api/leagues/${lid}`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'receptions', value: 1.5 })

    // The cascade threw, and the response is unaffected by it.
    res.should.have.status(200)
    res.body.value.should.equal(1.5)

    // The id update committed ahead of the cascade, so it survives the failure.
    const season = await knex('seasons')
      .where({ lid, season_year: current_season.year })
      .first()
    const scoring_format = await knex('league_scoring_formats')
      .where({ id: season.scoring_format_id })
      .first()
    expect(Number(scoring_format.receptions)).to.equal(1.5)

    // The failure is recorded rather than swallowed.
    const failed_jobs = await knex('jobs')
      .where({
        type: job_types.PROCESS_PROJECTIONS,
        is_successful: false
      })
      .orderBy('run_at', 'desc')
    expect(failed_jobs.length).to.be.at.least(1)
    expect(failed_jobs[0].reason).to.match(
      new RegExp(
        `^cascade_failed_scoring lid=${lid} year=${current_season.year} id=${season.scoring_format_id}$`
      )
    )
  })
})
