/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import get_jobs from '#libs-server/get-jobs.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// `get_jobs` picks the LATEST run of each job type out of an append-only run
// log, and it does that through the table's surrogate key rather than through
// `run_at`: a `max(<surrogate>)` sub-query grouped by `type`, joined back to the
// table on that maximum. Both halves of that live in raw SQL
// (`db.raw('max(uid) as maxuid')`), so `check-knex-column-resolution` cannot
// resolve either one and a word-boundary sweep of the column name does not
// match the derived alias at all. Nothing in the gate suite covers this file.
//
// That is why this spec exists and why it is shaped the way it is. It NEVER
// names the surrogate column, in a seed or in an assertion -- every row is
// inserted without it so the sequence default assigns the value. So the spec is
// blind to what the column is called and pins only what the function promises,
// which lets the identical assertions run unchanged on both sides of the
// `uid` -> `job_id` rename. A spec that named the column would fail after the
// rename on a missing column, which proves the schema moved and nothing else.
//
// Insertion ORDER is therefore the load-bearing fixture property: the surrogate
// ascends with it, so seeding the older run first and the newer run second is
// what makes "the joined row is the later one" a real assertion rather than a
// coincidence of row order.
//
// The fixtures deliberately vary in SHAPE rather than at one value -- distinct
// `type`, `is_successful`, `reason` and `run_at` per row -- because a fixture
// holding two columns at the same value cannot detect a transposition between
// them, which is the natural failure of a mechanical rename sweep.

const JOB_TYPE_WAIVERS = 2
const JOB_TYPE_POACHING_WAIVERS = 3
const JOB_TYPE_POACHING_CLAIMS = 4

describe('LIBS-SERVER get_jobs', function () {
  this.timeout(30 * 1000)

  before(async () => {
    await knex('jobs').del()
  })

  beforeEach(async () => {
    await knex('jobs').del()
  })

  it('returns the latest run of each job type', async () => {
    // Seeded oldest-first per type so the surrogate ascends with recency. The
    // two runs of a type differ in every non-key column, so a row picked by the
    // wrong half of the join is distinguishable from the right one.
    await knex('jobs').insert({
      type: JOB_TYPE_WAIVERS,
      is_successful: false,
      reason: 'stale waivers run',
      run_at: '2020-09-04T01:30:06.000Z'
    })
    await knex('jobs').insert({
      type: JOB_TYPE_POACHING_WAIVERS,
      is_successful: false,
      reason: 'stale poaching-waivers run',
      run_at: '2021-01-02T03:04:05.000Z'
    })
    await knex('jobs').insert({
      type: JOB_TYPE_WAIVERS,
      is_successful: true,
      reason: 'latest waivers run',
      run_at: '2024-07-16T21:00:18.000Z'
    })
    await knex('jobs').insert({
      type: JOB_TYPE_POACHING_WAIVERS,
      is_successful: true,
      reason: 'latest poaching-waivers run',
      run_at: '2025-03-09T11:22:33.000Z'
    })

    const jobs = await get_jobs()

    expect(jobs).to.have.lengthOf(2)

    const by_type = new Map(jobs.map((job) => [job.type, job]))

    expect(by_type.get(JOB_TYPE_WAIVERS).reason).to.equal('latest waivers run')
    expect(by_type.get(JOB_TYPE_WAIVERS).is_successful).to.equal(true)

    expect(by_type.get(JOB_TYPE_POACHING_WAIVERS).reason).to.equal(
      'latest poaching-waivers run'
    )
    expect(by_type.get(JOB_TYPE_POACHING_WAIVERS).is_successful).to.equal(true)
  })

  it('returns exactly one row per job type', async () => {
    // Three runs of one type against one run of another. The count is what goes
    // red if the join collapses to a cross product or drops its grouping --
    // the shape a half-applied rename of the sub-query alias produces.
    for (const reason of ['first', 'second', 'third']) {
      await knex('jobs').insert({
        type: JOB_TYPE_WAIVERS,
        is_successful: true,
        reason,
        run_at: '2024-07-16T21:00:18.000Z'
      })
    }
    await knex('jobs').insert({
      type: JOB_TYPE_POACHING_CLAIMS,
      is_successful: false,
      reason: 'only claims run',
      run_at: '2024-07-17T21:00:18.000Z'
    })

    const jobs = await get_jobs()

    expect(jobs).to.have.lengthOf(2)
    expect(jobs.map((job) => job.type).sort()).to.deep.equal([
      JOB_TYPE_WAIVERS,
      JOB_TYPE_POACHING_CLAIMS
    ])
    expect(
      jobs.filter((job) => job.type === JOB_TYPE_WAIVERS)
    ).to.have.lengthOf(1)
  })

  it('carries the full run payload of the row it selects', async () => {
    // The function selects `*` through a join, so a broken join can still return
    // a row while dropping the base table's columns. Asserting the payload is
    // what separates "returned the right row" from "returned a row".
    await knex('jobs').insert({
      type: JOB_TYPE_POACHING_CLAIMS,
      is_successful: false,
      reason: 'no poaching claims to process',
      run_at: '2024-07-16T21:00:18.000Z'
    })

    const jobs = await get_jobs()

    expect(jobs).to.have.lengthOf(1)
    expect(jobs[0].type).to.equal(JOB_TYPE_POACHING_CLAIMS)
    expect(jobs[0].is_successful).to.equal(false)
    expect(jobs[0].reason).to.equal('no poaching claims to process')
    expect(jobs[0].run_at).to.be.a('date')
  })

  it('returns nothing when the run log is empty', async () => {
    const jobs = await get_jobs()
    expect(jobs).to.have.lengthOf(0)
  })
})
