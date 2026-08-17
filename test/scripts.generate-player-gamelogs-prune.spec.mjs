/* global describe before beforeEach it */
import * as chai from 'chai'

import db from '#db'
import {
  prune_unreferenced_gamelogs,
  PLAY_STATS_GAMELOG_SOURCE
} from '../scripts/generate-player-gamelogs.mjs'

const expect = chai.expect

// The prune reads "this run did not produce the row" as evidence the row is
// stale, which only holds when the run was ABLE to produce it. An era rejection
// is the case where it was not: `player_could_have_played` removes the player as
// a candidate upstream, so the row's absence is fully explained by the predicate.
//
// 8f4292e08 is the incident. Its predicate consulted only `nfl_draft_year` --
// the field a conflated `player` row gets wrong -- and the run deleted 1,560
// gamelogs of which 450 were real.
describe('SCRIPTS generate-player-gamelogs prune', function () {
  this.timeout(30 * 1000)

  const esbid = 2014090400
  const season_year = 2014

  // Ten rows the run reproduces. The reproduction floor is proportional, so a
  // fixture has to be large enough for one stale row to sit above it.
  const produced_pids = Array.from(
    { length: 10 },
    (unused, index) => `PRUN-PROD-9000${String(index).padStart(2, '0')}`
  )
  const stale_pid = 'PRUN-STAL-900020'
  const era_pid = 'PRUN-ERAX-900021'
  const snap_only_pid = 'PRUN-SNAP-900022'
  const all_pids = [...produced_pids, stale_pid, era_pid, snap_only_pid]

  const gamelog = (pid) => ({
    esbid,
    pid,
    season_year,
    nfl_team: 'NE',
    opponent_nfl_team: 'BUF',
    player_position: 'WR',
    targets: 4,
    rushing_first_downs: 0,
    receiving_first_downs: 0,
    rushing_yards_excluding_kneels: 0,
    source: PLAY_STATS_GAMELOG_SOURCE
  })

  // What `scripts/generate-player-snaps.mjs` writes: snap counts, no counting
  // stat, no `source`. The prune must not read this as its own row.
  const snap_only_gamelog = (pid) => ({
    esbid,
    pid,
    season_year,
    nfl_team: 'NE',
    opponent_nfl_team: 'BUF',
    player_position: 'DE',
    snaps_defense: 48
  })

  const player_row = ({ pid, last_name, date_of_birth }) => ({
    pid,
    first_name: 'prune',
    last_name,
    short_name: `p.${last_name}`,
    formatted_name: `prune ${last_name}`,
    primary_position: 'WR',
    secondary_position: 'WR',
    current_nfl_team: 'NE',
    date_of_birth
  })

  const run_prune = (produced, unseparable_by_esbid) =>
    prune_unreferenced_gamelogs({
      unique_esbids: [esbid],
      player_gamelog_inserts: produced.map((pid) => ({ esbid, pid })),
      unseparable_by_esbid,
      year: season_year,
      dry_run: false
    })

  before(async () => {
    await db('player')
      .insert([
        ...produced_pids.map((pid) =>
          player_row({
            pid,
            last_name: 'produced',
            date_of_birth: '1990-01-01'
          })
        ),
        // Not produced, and the predicate has nothing against them: a genuinely
        // stale attribution, which the prune must still delete.
        player_row({
          pid: stale_pid,
          last_name: 'stale',
          date_of_birth: '1990-01-01'
        }),
        // Not produced, and era-rejected -- a conflated row carrying the
        // intruder's birth date, so it reads as 15 years old in 2014. This is
        // the CHRI-SMIT-007265 shape. Its row must survive.
        player_row({
          pid: era_pid,
          last_name: 'era rejected',
          date_of_birth: '1999-12-15'
        }),
        player_row({
          pid: snap_only_pid,
          last_name: 'snap only',
          date_of_birth: '1990-01-01'
        })
      ])
      .onConflict('pid')
      .ignore()
  })

  beforeEach(async () => {
    for (const table of [
      'player_gamelogs',
      'player_receiving_gamelogs',
      'player_rushing_gamelogs'
    ]) {
      await db(table).where({ esbid }).del()
    }

    await db('player_gamelogs').insert([
      ...produced_pids.map(gamelog),
      gamelog(stale_pid),
      gamelog(era_pid),
      snap_only_gamelog(snap_only_pid)
    ])
  })

  it('deletes an unproduced row the era predicate does not reject', async () => {
    const deleted = await run_prune(produced_pids)

    expect(deleted).to.equal(1)
    expect(
      await db('player_gamelogs').where({ esbid, pid: stale_pid }).first()
    ).to.equal(undefined)
  })

  it('retains an unproduced row whose player the era predicate rejects', async () => {
    await run_prune(produced_pids)

    const survivor = await db('player_gamelogs')
      .where({ esbid, pid: era_pid })
      .first()

    // Without the era bound this row is indistinguishable from the stale one
    // above, and the prune deletes it. That is the 450-row half of 8f4292e08.
    expect(survivor).to.not.equal(undefined)
  })

  it('never claims a snap-only row, which another writer also produces', async () => {
    await run_prune(produced_pids)

    // `generate-player-snaps.mjs` writes `snaps_offense`/`snaps_defense`/`snaps_special_teams` from
    // its own derivation, sets no `source`, and runs AFTER this script in both
    // pipelines. Reading a snap count as proof of ownership let a single-game
    // regeneration delete that writer's data.
    const survivor = await db('player_gamelogs')
      .where({ esbid, pid: snap_only_pid })
      .first()

    expect(survivor).to.not.equal(undefined)
    expect(survivor.snaps_defense).to.equal(48)
  })

  it('deletes nothing for a game the run produced no rows for', async () => {
    // A run that resolved nothing is a resolution regression, not a game whose
    // rows are all stale. Deleting on it turns the first into data loss.
    const deleted = await run_prune([])

    expect(deleted).to.equal(0)
    expect(
      await db('player_gamelogs').where({ esbid }).pluck('pid')
    ).to.have.length(all_pids.length)
  })

  it('deletes nothing for a game whose play stats did not all resolve', async () => {
    // The partial-failure case the "produced at least one row" bound misses: the
    // run resolved half the game and failed on the rest, so its output is not
    // evidence that the rows it skipped are stale. One unseparable play stat is
    // the run's own report that it failed, and it needs no threshold.
    const deleted = await run_prune(
      produced_pids.slice(0, 5),
      new Map([[esbid, 1]])
    )

    expect(deleted).to.equal(0)
    expect(
      await db('player_gamelogs').where({ esbid }).pluck('pid')
    ).to.have.length(all_pids.length)
  })

  it('still prunes a clean run that retracts a large share of a game', async () => {
    // The proportional floor this replaced got this case wrong: a run that
    // resolved everything it saw and legitimately no longer supports most of a
    // game's rows is exactly what the prune exists for.
    const deleted = await run_prune(produced_pids.slice(0, 2))

    expect(deleted).to.equal(9)
  })

  it('retracts the receiving and rushing gamelogs of a deleted pair', async () => {
    const facet_row = (pid) => ({ esbid, pid, season_year })
    await db('player_receiving_gamelogs').insert([
      facet_row(stale_pid),
      facet_row(era_pid)
    ])
    await db('player_rushing_gamelogs').insert([
      facet_row(stale_pid),
      facet_row(era_pid)
    ])

    await run_prune(produced_pids)

    // Nothing else prunes these tables, so retracting only the parent left
    // orphans -- 239 of them after the 8f4292e08 repair.
    for (const table of [
      'player_receiving_gamelogs',
      'player_rushing_gamelogs'
    ]) {
      expect(await db(table).where({ esbid }).pluck('pid')).to.eql([era_pid])
    }
  })
})
