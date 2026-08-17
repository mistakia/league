/* global describe before after it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'
import { current_season, external_data_sources } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  find_stale_scoring_format_ids,
  find_stale_league_format_ids,
  refresh_projection_caches,
  MAX_ATTEMPTS_PER_FORMAT
} from '#libs-server/refresh-projection-caches.mjs'

import league from '#db/fixtures/league.mjs'
import { user1 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()
chai.use(chai_http)

// PUT /leagues/:id mutates seasons.{scoring,league}_format_id. Those ids are
// find-or-create over the whole config tuple, so a settings change RESOLVES A
// NEW ID rather than updating a row, and the projection cache keyed on that id
// is empty until something derives it.
//
// The route used to derive it inline, which ran a full re-derivation inside the
// request, reported failures under the process-projections CRON's job type, and
// answered 200 either way. It now does the write only; the empty slice is the
// signal refresh-projection-cache-worker picks up.
describe('API /leagues - format id update', function () {
  this.timeout(60 * 1000)

  // projections_index is not reset by db/fixtures/league.mjs and no seed
  // inserts into it, so the source row these tests add has to be removed here
  // or it outlives the file into every later spec in the run.
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
          source_id: external_data_sources.AVERAGE
        })
        .del()
    }
  })

  const count_projection_jobs = async () => {
    const row = await knex('jobs')
      .where({ type: job_types.PROCESS_PROJECTIONS })
      .count('* as n')
      .first()
    return Number(row.n)
  }

  it('scoring format change resolves a new id and does not rebuild inline', async () => {
    const lid = 1
    const jobs_before = await count_projection_jobs()
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

    // The route writes no jobs row of any kind now. It reported under the
    // cron's job type until 2026-08-09, which is what let a commissioner's
    // settings edit mark the scheduled pipeline failed.
    expect(await count_projection_jobs()).to.equal(jobs_before)

    // And it did no cache work: the new id's slice is untouched.
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

    // DB dedup oracle: a second PUT with the same target value resolves to the
    // same id (the unique config tuple is a stable key).
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

    // A different config value produces a distinct id.
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

  it('league format change resolves a new id and does not rebuild inline', async () => {
    const lid = 1
    const jobs_before = await count_projection_jobs()
    const before_season = await knex('seasons')
      .where({ lid, season_year: current_season.year })
      .first()

    const res = await chai_request
      .execute(server)
      .put(`/api/leagues/${lid}`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'salary_cap', value: 250 })

    res.should.have.status(200)
    res.body.value.should.equal(250)

    const after_season = await knex('seasons')
      .where({ lid, season_year: current_season.year })
      .first()
    expect(after_season.league_format_id).to.not.equal(
      before_season.league_format_id
    )

    expect(await count_projection_jobs()).to.equal(jobs_before)

    const projection_rows = await knex('league_format_player_projection_values')
      .where({
        league_format_id: after_season.league_format_id,
        season_year: current_season.year
      })
      .count('* as n')
      .first()
    expect(Number(projection_rows.n)).to.equal(0)
  })

  // Ordering guard, and it must run BEFORE the rebuild below: league values are
  // derived FROM scoring points, so a league format reported while its own
  // scoring slice is still empty would be rebuilt from nothing. The derivation
  // holds it back until the upstream lands.
  it('a league format whose upstream scoring slice is empty is held back', async () => {
    const lid = 1
    const season = await knex('seasons')
      .where({ lid, season_year: current_season.year })
      .first()

    const scoring_rows = await knex('scoring_format_player_projection_points')
      .where({
        scoring_format_id: season.scoring_format_id,
        season_year: current_season.year
      })
      .count('* as n')
      .first()
    expect(Number(scoring_rows.n)).to.equal(0)

    const stale_league_formats = await find_stale_league_format_ids({
      db: knex,
      year: current_season.year
    })
    expect(stale_league_formats).to.not.include(season.league_format_id)
  })

  // The end-to-end replacement for the cascade: the route leaves an empty
  // slice, the derivation notices it with nobody having announced anything, and
  // one worker pass fills it.
  it('the new id is derived as stale and one worker pass rebuilds it', async () => {
    const lid = 1

    // Source data for the year, or every slice is legitimately empty and the
    // derivation correctly reports nothing.
    const player_row = await knex('player')
      .where({ primary_position: 'QB' })
      .first()
    projection_pid = player_row.pid
    await knex('projections_index').insert({
      pid: projection_pid,
      source_id: external_data_sources.AVERAGE,
      user_id: 0,
      week: 1,
      season_year: current_season.year,
      season_type: 'REG',
      passing_yards: 300.5,
      passing_touchdowns: 2.5,
      rushing_yards: 20.5,
      rushing_touchdowns: 0.5
    })

    const res = await chai_request
      .execute(server)
      .put(`/api/leagues/${lid}`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'receptions', value: 1.4 })
    res.should.have.status(200)

    const season = await knex('seasons')
      .where({ lid, season_year: current_season.year })
      .first()

    const stale_before = await find_stale_scoring_format_ids({
      db: knex,
      year: current_season.year
    })
    expect(stale_before).to.include(season.scoring_format_id)

    const { rebuilt, failures } = await refresh_projection_caches({
      db: knex,
      year: current_season.year
    })
    expect(failures).to.deep.equal([])
    expect(rebuilt).to.include(`scoring:${season.scoring_format_id}`)

    const projection_rows = await knex(
      'scoring_format_player_projection_points'
    )
      .where({
        scoring_format_id: season.scoring_format_id,
        season_year: current_season.year
      })
      .count('* as n')
      .first()
    expect(Number(projection_rows.n)).to.be.greaterThan(0)

    // Having rebuilt it, the pass must not keep finding it -- the property that
    // makes a derived work set safe to poll every 20 seconds.
    const stale_after = await find_stale_scoring_format_ids({
      db: knex,
      year: current_season.year
    })
    expect(stale_after).to.not.include(season.scoring_format_id)
  })

  // Mint a fresh id by changing a scoring field, so each attempts test gets its
  // own empty slice. Source rows are already in projections_index by this point.
  const mint_stale_scoring_format_id = async ({ value }) => {
    const res = await chai_request
      .execute(server)
      .put('/api/leagues/1')
      .set('Authorization', `Bearer ${user1}`)
      .send({ field: 'receptions', value })
    res.should.have.status(200)
    const season = await knex('seasons')
      .where({ lid: 1, season_year: current_season.year })
      .first()
    const stale = await find_stale_scoring_format_ids({
      db: knex,
      year: current_season.year
    })
    expect(stale).to.include(season.scoring_format_id)
    return season.scoring_format_id
  }

  // The attempts counter is what stops a format that cannot be rebuilt from
  // pinning the worker at its 20s active interval and writing a ledger failure
  // row every pass. Both halves are asserted because either one alone passes
  // over a deleted cap: the increment, and the skip once it is reached.
  it('a pass records one attempt per format it tries', async () => {
    const scoring_format_id = await mint_stale_scoring_format_id({ value: 1.6 })
    const attempts_by_format_id = new Map()

    const { rebuilt } = await refresh_projection_caches({
      db: knex,
      year: current_season.year,
      attempts_by_format_id
    })

    expect(rebuilt).to.include(`scoring:${scoring_format_id}`)
    expect(attempts_by_format_id.get(scoring_format_id)).to.equal(1)
  })

  it('a format at the attempt cap is skipped rather than retried', async () => {
    const scoring_format_id = await mint_stale_scoring_format_id({ value: 1.8 })
    const attempts_by_format_id = new Map([
      [scoring_format_id, MAX_ATTEMPTS_PER_FORMAT]
    ])

    const { rebuilt, failures } = await refresh_projection_caches({
      db: knex,
      year: current_season.year,
      attempts_by_format_id
    })

    expect(rebuilt).to.not.include(`scoring:${scoring_format_id}`)
    expect(failures).to.deep.equal([])
    // Not attempted at all, so the counter must not have moved.
    expect(attempts_by_format_id.get(scoring_format_id)).to.equal(
      MAX_ATTEMPTS_PER_FORMAT
    )

    // And the slice it would have filled is still empty.
    const projection_rows = await knex(
      'scoring_format_player_projection_points'
    )
      .where({
        scoring_format_id,
        season_year: current_season.year
      })
      .count('* as n')
      .first()
    expect(Number(projection_rows.n)).to.equal(0)
  })
})
