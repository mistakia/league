/* global describe it before after */

import * as chai from 'chai'

import db from '#db'

const expect = chai.expect

// idx_24719_play_stat was a STANDARD unique index on
// (esbid, play_id, stat_id, player_name), so NULLs were distinct and every row
// with a null player_name escaped it. That is not merely permissive:
// import-plays-nfl-v1 re-imports a game by invalidating it and re-inserting
// with onConflict(...).merge(), and a conflict that is never detected appends a
// new row instead of merging, stranding the prior copy at is_valid false. Every
// re-import minted another copy of every team-level stat row -- 296,443
// duplicate key groups and 496,129 excess rows in production by the time it was
// found, all of them with a null player_name and none with a non-null one.
//
// db/adhoc/2026-09-03-nfl-play-stats-nulls-not-distinct.sql merged those forward
// and rebuilt the index NULLS NOT DISTINCT. What is guarded here is the INDEX
// INVARIANT rather than that one-time migration: the migration cannot be
// re-executed against a schema that already carries the fixed index, but the
// index can be dropped and recreated without NULLS NOT DISTINCT by anyone
// editing the schema, and nothing else would notice until the duplicates came
// back.

const ESBID = 99200001
const PLAY_ID = 1
const STAT_ID = 5

const stat_row = (overrides) => ({
  esbid: ESBID,
  play_id: PLAY_ID,
  stat_id: STAT_ID,
  nfl_team: 'KC',
  player_name: null,
  stat_yards: 0,
  gsis_player_id: null,
  smart_player_id: null,
  nfl_team_id: null,
  is_valid: true,
  ...overrides
})

describe('DB nfl_play_stats unique index NULLS NOT DISTINCT', function () {
  before(async () => {
    await db('nfl_play_stats').where({ esbid: ESBID }).del()
    await db('nfl_play_stats').insert(stat_row({}))
  })

  after(async () => {
    await db('nfl_play_stats').where({ esbid: ESBID }).del()
  })

  it('declares the index NULLS NOT DISTINCT', async () => {
    // Read from the live catalog rather than from schema.postgres.sql, so this
    // fails on the database the suite actually runs against.
    const { rows } = await db.raw(
      "select indexdef from pg_indexes where indexname = 'idx_24719_play_stat'"
    )

    expect(rows.length, 'the play-stat unique index must exist').to.equal(1)
    expect(
      rows[0].indexdef,
      'a standard unique index lets every null-player_name row escape it'
    ).to.match(/NULLS NOT DISTINCT/)
  })

  it('rejects a second row with the same key and a null player_name', async () => {
    // The behavioral half. The declaration test above would still pass if the
    // index existed but did not cover the rows it names, so this one inserts.
    let thrown = null
    try {
      await db('nfl_play_stats').insert(stat_row({ stat_yards: 3 }))
    } catch (err) {
      thrown = err
    }

    expect(
      thrown,
      'a duplicate null-player_name row must violate the unique index -- before the fix this insert silently succeeded'
    ).to.be.an('error')
    expect(String(thrown.message)).to.match(/idx_24719_play_stat|duplicate key/)
  })

  it('still admits a genuinely different key that differs only in player_name', async () => {
    // The control for the test above, and the reason NULLS NOT DISTINCT is
    // narrower than it sounds: it makes two NULLs equal, it does not make a null
    // equal to a name. Without this, an index that rejected EVERYTHING would
    // pass the rejection test and look correct.
    await db('nfl_play_stats').insert(stat_row({ player_name: 'A.Player' }))

    const rows = await db('nfl_play_stats').where({ esbid: ESBID }).select()
    expect(
      rows.length,
      'a non-null player_name is a different key and must still insert'
    ).to.equal(2)
  })

  it('lets onConflict merge reach a null player_name row', async () => {
    // What the index gap actually broke, and the reason this is a schema fix
    // rather than a one-time cleanup: with NULLS distinct this merge never found
    // its target and appended a row instead.
    const before_rows = await db('nfl_play_stats')
      .where({ esbid: ESBID })
      .whereNull('player_name')
      .select()
    expect(
      before_rows.length,
      'one null-player_name row to merge onto'
    ).to.equal(1)

    await db('nfl_play_stats')
      .insert(stat_row({ stat_yards: 17, is_valid: false }))
      .onConflict(['esbid', 'play_id', 'stat_id', 'player_name'])
      .merge()

    const after_rows = await db('nfl_play_stats')
      .where({ esbid: ESBID })
      .whereNull('player_name')
      .select()

    expect(
      after_rows.length,
      'the merge must update in place rather than append a duplicate'
    ).to.equal(1)
    expect(
      after_rows[0].stat_yards,
      'the merge must have written through to the existing row'
    ).to.equal(17)
  })
})
