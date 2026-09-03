/* global describe it before after */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import * as chai from 'chai'

import db from '#db'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MIGRATION_PATH = path.join(
  __dirname,
  '..',
  'db',
  'adhoc',
  '2026-09-03-nfl-play-stats-nulls-not-distinct.sql'
)

// The unique index on nfl_play_stats is a STANDARD unique index, so NULLs are
// distinct and every row with a null player_name escapes it. That is not merely
// permissive -- import-plays-nfl-v1 re-imports a game by invalidating it and
// re-inserting with onConflict(...).merge(), and a conflict that is never
// detected appends a new row instead of merging, stranding the prior copy at
// is_valid false. Production carries 296,443 such groups.
//
// The remediation is a merge-forward rather than a dedupe, because the stranded
// copies hold columns the survivor does not (192,827 groups where the valid row
// has a null nfl_team_id and a stranded copy has one). GROUP_MERGE_FORWARD below
// is that case, and it is the one a plain keep-the-valid-row delete gets wrong.

// db:exec owns the STATUS banner and rewrites it on apply; strip it so this test
// runs the same file whatever state that header is in.
const load_migration = () =>
  fs
    .readFileSync(MIGRATION_PATH, 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('-- STATUS:'))
    .join('\n')

const GROUP_MERGE_FORWARD = 99200001 // 1 valid + 2 stranded, stranded holds nfl_team_id
const GROUP_NO_VALID = 99200002 // 0 valid -- the 25,282-group case
const GROUP_TWO_VALID = 99200003 // 2 identical valid -- the 17-group case
const GROUP_NAMED = 99200004 // non-null player_name control
const GROUP_SINGLETON = 99200005 // null player_name, not duplicated -- control

const ALL_ESBIDS = [
  GROUP_MERGE_FORWARD,
  GROUP_NO_VALID,
  GROUP_TWO_VALID,
  GROUP_NAMED,
  GROUP_SINGLETON
]

const TEAM_ID = '10041200-2021-6fbf-aaa9-8b50898d954e'

const stat_row = (overrides) => ({
  play_id: 1,
  stat_id: 5,
  nfl_team: 'KC',
  player_name: null,
  stat_yards: 0,
  gsis_player_id: null,
  smart_player_id: null,
  nfl_team_id: null,
  is_valid: true,
  ...overrides
})

describe('DB nfl_play_stats NULLS NOT DISTINCT migration', function () {
  this.timeout(60000)

  before(async () => {
    await db('nfl_play_stats').whereIn('esbid', ALL_ESBIDS).del()
    await db('nfl_play_stats').insert([
      // The merge-forward case: the current row lost nfl_team_id, and only the
      // stranded copies still carry it.
      stat_row({ esbid: GROUP_MERGE_FORWARD, is_valid: true }),
      stat_row({
        esbid: GROUP_MERGE_FORWARD,
        is_valid: false,
        nfl_team_id: TEAM_ID
      }),
      stat_row({
        esbid: GROUP_MERGE_FORWARD,
        is_valid: false,
        smart_player_id: 'SMART-1'
      }),

      stat_row({ esbid: GROUP_NO_VALID, is_valid: false }),
      stat_row({ esbid: GROUP_NO_VALID, is_valid: false }),

      stat_row({ esbid: GROUP_TWO_VALID, is_valid: true }),
      stat_row({ esbid: GROUP_TWO_VALID, is_valid: true }),

      // Controls: neither is a duplicate, so the migration must not touch them.
      stat_row({ esbid: GROUP_NAMED, player_name: 'A.Player' }),
      stat_row({ esbid: GROUP_SINGLETON, nfl_team_id: TEAM_ID })
    ])
  })

  after(async () => {
    await db('nfl_play_stats').whereIn('esbid', ALL_ESBIDS).del()
    await db.raw(
      'drop table if exists nulls_not_distinct_backup_20260903_nfl_play_stats'
    )
  })

  it('the duplicate shape exists before the migration runs', async () => {
    // The premise. Without this the whole spec could pass against a table that
    // never held a duplicate, which is the vacuous-input trap.
    const rows = await db('nfl_play_stats')
      .whereIn('esbid', ALL_ESBIDS)
      .whereNull('player_name')
      .count('* as n')
      .groupBy('esbid', 'play_id', 'stat_id')
      .havingRaw('count(*) > 1')

    expect(
      rows.length,
      'fixture must contain three duplicate groups or the migration has nothing to prove'
    ).to.equal(3)
  })

  it('applies, collapsing duplicates and carrying merged values forward', async () => {
    await db.transaction(async (trx) => {
      await trx.raw(load_migration())
    })

    const remaining = await db('nfl_play_stats')
      .whereIn('esbid', ALL_ESBIDS)
      .count('* as n')
      .groupBy('esbid', 'play_id', 'stat_id', 'player_name')
      .havingRaw('count(*) > 1')
    expect(remaining.length, 'no duplicate key group may survive').to.equal(0)

    // The assertion the merge-forward exists for: a plain keep-the-valid-row
    // delete passes every other check in this spec and fails this one.
    const merged = await db('nfl_play_stats')
      .where({ esbid: GROUP_MERGE_FORWARD })
      .first()
    expect(merged.is_valid, 'the valid row must be the survivor').to.equal(true)
    expect(
      merged.nfl_team_id,
      'nfl_team_id lived only on a stranded copy and must be carried forward'
    ).to.equal(TEAM_ID)
    expect(
      merged.smart_player_id,
      'smart_player_id lived only on a stranded copy and must be carried forward'
    ).to.equal('SMART-1')

    const no_valid = await db('nfl_play_stats')
      .where({ esbid: GROUP_NO_VALID })
      .select()
    expect(
      no_valid.length,
      'an all-invalid group collapses to one row'
    ).to.equal(1)
    expect(
      no_valid[0].is_valid,
      'collapsing must not invent validity a group never had'
    ).to.equal(false)

    const two_valid = await db('nfl_play_stats')
      .where({ esbid: GROUP_TWO_VALID })
      .select()
    expect(two_valid.length, 'identical valid copies collapse to one').to.equal(
      1
    )

    // Controls: untouched rows stay exactly as inserted.
    const named = await db('nfl_play_stats')
      .where({ esbid: GROUP_NAMED })
      .select()
    expect(named.length, 'a non-null player_name row is out of scope').to.equal(
      1
    )
    expect(named[0].player_name).to.equal('A.Player')

    const singleton = await db('nfl_play_stats')
      .where({ esbid: GROUP_SINGLETON })
      .first()
    expect(
      singleton.nfl_team_id,
      'a non-duplicated null-player_name row must be left alone'
    ).to.equal(TEAM_ID)
  })

  it('the rebuilt index now rejects a duplicate null player_name', async () => {
    // The behavioral proof, and the reason NULLS NOT DISTINCT is the fix rather
    // than a one-time cleanup: before the migration this insert succeeded
    // silently and minted the 296,443rd duplicate group.
    let thrown = null
    try {
      await db('nfl_play_stats').insert(
        stat_row({ esbid: GROUP_TWO_VALID, is_valid: true })
      )
    } catch (err) {
      thrown = err
    }

    expect(
      thrown,
      'a second null-player_name row on an existing key must now violate the unique index'
    ).to.be.an('error')
    expect(
      String(thrown.message),
      'it must be the play-stat unique index that refuses'
    ).to.match(/idx_24719_play_stat|duplicate key/)
  })

  it('onConflict merge now reaches a null player_name row', async () => {
    // What the index gap actually broke. With NULLS distinct this merge never
    // found its target and appended a row instead; the count is the tell.
    const before_count = await db('nfl_play_stats')
      .where({ esbid: GROUP_MERGE_FORWARD })
      .count('* as n')
      .first()

    await db('nfl_play_stats')
      .insert(
        stat_row({
          esbid: GROUP_MERGE_FORWARD,
          is_valid: true,
          stat_yards: 17
        })
      )
      .onConflict(['esbid', 'play_id', 'stat_id', 'player_name'])
      .merge()

    const after = await db('nfl_play_stats')
      .where({ esbid: GROUP_MERGE_FORWARD })
      .select()

    expect(
      after.length,
      'the merge must update in place rather than append a duplicate'
    ).to.equal(Number(before_count.n))
    expect(
      after[0].stat_yards,
      'the merge must actually have written through to the existing row'
    ).to.equal(17)
  })
})
