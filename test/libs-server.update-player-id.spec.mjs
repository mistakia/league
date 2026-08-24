/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import update_player_id from '#libs-server/update-player-id.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// Must satisfy the player_pid_format check constraint.
const survivor_pid = 'TEST-UPID-999101'
const folded_pid = 'TEST-UPID-999102'

// The two ends of the repoint. `player_changelog` carries no unique key on
// `pid`, so every row must move; `keeptradecut_valuations` is keyed on
// (pid, is_superflex, observed_at), so a row moves only where that key is free.
const conflicting_observed_at = '2026-01-01T00:00:00Z'
const free_observed_at = '2026-02-01T00:00:00Z'

const insert_player = async ({ pid, last_name }) => {
  await knex('player').insert({
    pid,
    first_name: 'Repoint',
    last_name,
    short_name: `R.${last_name}`,
    formatted_name: `repoint ${last_name.toLowerCase()}`,
    primary_position: 'WR',
    secondary_position: 'WR',
    position_depth: 'WR',
    current_nfl_team: 'INA'
  })
}

const insert_changelog = async ({ pid, column_name }) =>
  knex('player_changelog').insert({
    pid,
    column_name,
    previous_value: 'before',
    new_value: 'after',
    source: 'update-player-id-spec',
    changed_at: new Date()
  })

const insert_valuation = async ({ pid, observed_at, keeptradecut_value }) =>
  knex('keeptradecut_valuations').insert({
    pid,
    is_superflex: false,
    observed_at,
    keeptradecut_value
  })

const reset = async () => {
  const pids = [survivor_pid, folded_pid]
  await knex('player_changelog').whereIn('pid', pids).del()
  await knex('keeptradecut_valuations').whereIn('pid', pids).del()
  await knex('player').whereIn('pid', pids).del()

  await insert_player({ pid: survivor_pid, last_name: 'Survivor' })
  await insert_player({ pid: folded_pid, last_name: 'Folded' })
}

describe('LIBS-SERVER update_player_id', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await reset()
  })

  // The regression. The survivor always has changelog rows of its own, so the
  // old presence check skipped this table on essentially every merge -- and it
  // skipped BEFORE the delete, leaving the folded pid's rows pointing at a row
  // the caller was about to delete. That is how 21 production pids ended up
  // holding orphaned changelog rows.
  it('repoints every row in a table with no unique key on pid', async function () {
    this.timeout(60 * 1000)

    await insert_changelog({ pid: survivor_pid, column_name: 'height_inches' })
    await insert_changelog({ pid: folded_pid, column_name: 'weight_pounds' })
    await insert_changelog({ pid: folded_pid, column_name: 'date_of_birth' })

    await update_player_id({ current_pid: folded_pid, new_pid: survivor_pid })

    const survivor_rows = await knex('player_changelog').where(
      'pid',
      survivor_pid
    )
    const folded_rows = await knex('player_changelog').where('pid', folded_pid)

    expect(survivor_rows.length).to.equal(3)
    expect(folded_rows.length).to.equal(0)
    expect(survivor_rows.map((row) => row.column_name).sort()).to.deep.equal([
      'date_of_birth',
      'height_inches',
      'weight_pounds'
    ])
  })

  it('repoints a unique-keyed row whose key is free under the survivor', async function () {
    this.timeout(60 * 1000)

    await insert_valuation({
      pid: survivor_pid,
      observed_at: conflicting_observed_at,
      keeptradecut_value: 100
    })
    await insert_valuation({
      pid: folded_pid,
      observed_at: free_observed_at,
      keeptradecut_value: 200
    })

    await update_player_id({ current_pid: folded_pid, new_pid: survivor_pid })

    const rows = await knex('keeptradecut_valuations')
      .where('pid', survivor_pid)
      .orderBy('observed_at')

    expect(rows.length).to.equal(2)
    expect(rows.map((row) => row.keeptradecut_value)).to.deep.equal([100, 200])
  })

  // The case the presence check was reaching for, and the only case where
  // dropping a row is correct: the survivor already holds an equivalent one.
  it('drops a unique-keyed row the survivor already has, without raising', async function () {
    this.timeout(60 * 1000)

    await insert_valuation({
      pid: survivor_pid,
      observed_at: conflicting_observed_at,
      keeptradecut_value: 100
    })
    await insert_valuation({
      pid: folded_pid,
      observed_at: conflicting_observed_at,
      keeptradecut_value: 200
    })

    await update_player_id({ current_pid: folded_pid, new_pid: survivor_pid })

    const rows = await knex('keeptradecut_valuations').where(
      'pid',
      survivor_pid
    )

    expect(rows.length).to.equal(1)
    // The survivor's own row wins; the conflicting one is dropped rather than
    // overwriting it.
    expect(rows[0].keeptradecut_value).to.equal(100)
    expect(
      await knex('keeptradecut_valuations').where('pid', folded_pid)
    ).to.have.length(0)
  })

  // Mixed, because the two branches run against the SAME table in one pass and
  // a conflict-gated update has to move one row while refusing the other. A
  // per-table all-or-nothing rule passes both cases above and fails this one.
  it('moves the free row and drops the conflicting one in a single table', async function () {
    this.timeout(60 * 1000)

    await insert_valuation({
      pid: survivor_pid,
      observed_at: conflicting_observed_at,
      keeptradecut_value: 100
    })
    await insert_valuation({
      pid: folded_pid,
      observed_at: conflicting_observed_at,
      keeptradecut_value: 200
    })
    await insert_valuation({
      pid: folded_pid,
      observed_at: free_observed_at,
      keeptradecut_value: 300
    })

    await update_player_id({ current_pid: folded_pid, new_pid: survivor_pid })

    const rows = await knex('keeptradecut_valuations')
      .where('pid', survivor_pid)
      .orderBy('observed_at')

    expect(rows.map((row) => row.keeptradecut_value)).to.deep.equal([100, 300])
    expect(
      await knex('keeptradecut_valuations').where('pid', folded_pid)
    ).to.have.length(0)
  })

  it('leaves the folded pid referenced by nothing', async function () {
    this.timeout(60 * 1000)

    await insert_changelog({ pid: survivor_pid, column_name: 'height_inches' })
    await insert_changelog({ pid: folded_pid, column_name: 'weight_pounds' })
    await insert_valuation({
      pid: survivor_pid,
      observed_at: conflicting_observed_at,
      keeptradecut_value: 100
    })
    await insert_valuation({
      pid: folded_pid,
      observed_at: conflicting_observed_at,
      keeptradecut_value: 200
    })

    await update_player_id({ current_pid: folded_pid, new_pid: survivor_pid })

    for (const table of ['player_changelog', 'keeptradecut_valuations']) {
      expect(
        await knex(table).where('pid', folded_pid),
        `${table} still references the folded pid`
      ).to.have.length(0)
    }
  })
})
