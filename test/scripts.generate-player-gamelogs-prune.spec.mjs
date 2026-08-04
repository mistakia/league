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

  const gamelog = (pid) => ({
    esbid,
    pid,
    season_year,
    nfl_team: 'NE',
    opponent_nfl_team: 'BUF',
    pos: 'WR',
    targets: 4,
    rushing_first_downs: 0,
    receiving_first_downs: 0,
    rushing_yards_excluding_kneels: 0,
    source: PLAY_STATS_GAMELOG_SOURCE
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

  before(async () => {
    await db('player')
      .insert([
        // Produced by the run. Present only so the game is prunable at all --
        // the prune skips a game the run produced no rows for.
        player_row({
          pid: 'PRUN-PROD-900001',
          last_name: 'produced',
          date_of_birth: '1990-01-01'
        }),
        // Not produced, and the predicate has nothing against them: a genuinely
        // stale attribution, which the prune must still delete.
        player_row({
          pid: 'PRUN-STAL-900002',
          last_name: 'stale',
          date_of_birth: '1990-01-01'
        }),
        // Not produced, and era-rejected -- a conflated row carrying the
        // intruder's birth date, so it reads as 15 years old in 2014. This is
        // the CHRI-SMIT-007265 shape. Its row must survive.
        player_row({
          pid: 'PRUN-ERAX-900003',
          last_name: 'era rejected',
          date_of_birth: '1999-12-15'
        })
      ])
      .onConflict('pid')
      .ignore()
  })

  beforeEach(async () => {
    await db('player_gamelogs').where({ esbid }).del()
    await db('player_gamelogs').insert([
      gamelog('PRUN-PROD-900001'),
      gamelog('PRUN-STAL-900002'),
      gamelog('PRUN-ERAX-900003')
    ])
  })

  it('deletes an unproduced row the era predicate does not reject', async () => {
    const deleted = await prune_unreferenced_gamelogs({
      unique_esbids: [esbid],
      player_gamelog_inserts: [{ esbid, pid: 'PRUN-PROD-900001' }],
      year: season_year,
      dry_run: false
    })

    expect(deleted).to.equal(1)

    const remaining = await db('player_gamelogs')
      .where({ esbid })
      .pluck('pid')
      .orderBy('pid')

    expect(remaining).to.eql(['PRUN-ERAX-900003', 'PRUN-PROD-900001'])
  })

  it('retains an unproduced row whose player the era predicate rejects', async () => {
    await prune_unreferenced_gamelogs({
      unique_esbids: [esbid],
      player_gamelog_inserts: [{ esbid, pid: 'PRUN-PROD-900001' }],
      year: season_year,
      dry_run: false
    })

    const survivor = await db('player_gamelogs')
      .where({ esbid, pid: 'PRUN-ERAX-900003' })
      .first()

    // Without the era bound this row is indistinguishable from the stale one
    // above, and the prune deletes it. That is the 450-row half of 8f4292e08.
    expect(survivor).to.not.equal(undefined)
  })

  it('deletes nothing for a game the run produced no rows for', async () => {
    // A run that resolved nothing is a resolution regression, not a game whose
    // rows are all stale. Deleting on it turns the first into data loss.
    const deleted = await prune_unreferenced_gamelogs({
      unique_esbids: [esbid],
      player_gamelog_inserts: [],
      year: season_year,
      dry_run: false
    })

    expect(deleted).to.equal(0)
    expect(
      await db('player_gamelogs').where({ esbid }).pluck('pid')
    ).to.have.length(3)
  })
})
