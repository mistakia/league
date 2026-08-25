/* global describe before beforeEach it */
import * as chai from 'chai'

import db from '#db'
import { recompute_route_share } from '#libs-server'

const expect = chai.expect

// route_share is derived from routes the gamelog generator reads back out of
// player_receiving_gamelogs, and routes are written by the NGS gamelog import
// that runs AFTER the generator -- so every route imported on that pipeline
// lands too late for its own share. 6,924 rows across 2020-2025 carried routes
// with a null share when this pass was written.
//
// The two teams here run different dropback counts against different route
// counts on purpose: a fixture that gives both teams the same numbers cannot
// tell a correct team resolution from a swapped one.
describe('SCRIPTS recompute-route-share', function () {
  this.timeout(30 * 1000)

  const esbid = 2025091401
  const no_dropback_esbid = 2025091402
  const season_year = 2025
  const home_nfl_team = 'NE'
  const away_nfl_team = 'BUF'

  const home_pid = 'ROUT-HOME-900001'
  const away_pid = 'ROUT-AWAY-900002'
  const excess_routes_pid = 'ROUT-EXCS-900003'
  const no_dropbacks_pid = 'ROUT-NODB-900004'
  const already_shared_pid = 'ROUT-DONE-900005'

  const all_pids = [
    home_pid,
    away_pid,
    excess_routes_pid,
    no_dropbacks_pid,
    already_shared_pid
  ]

  const player_row = (pid) => ({
    pid,
    first_name: 'route',
    last_name: pid,
    short_name: `r.${pid}`,
    formatted_name: `route ${pid}`,
    primary_position: 'WR',
    secondary_position: 'WR',
    current_nfl_team: home_nfl_team
  })

  const play_row = ({
    play_id,
    possession_nfl_team,
    is_qb_dropback,
    play_type,
    game_esbid = esbid
  }) => ({
    esbid: game_esbid,
    play_id,
    season_year,
    season_type: 'REG',
    week: 2,
    possession_nfl_team,
    is_qb_dropback,
    play_type,
    updated: new Date()
  })

  // 20 dropbacks for NE and 10 for BUF, plus plays that must NOT be counted:
  // three NOPL dropbacks on NE (which would take it to 23) and two NE rushes.
  const plays = [
    ...Array.from({ length: 20 }, (unused, index) =>
      play_row({
        play_id: 100 + index,
        possession_nfl_team: home_nfl_team,
        is_qb_dropback: true,
        play_type: 'PASS'
      })
    ),
    ...Array.from({ length: 3 }, (unused, index) =>
      play_row({
        play_id: 200 + index,
        possession_nfl_team: home_nfl_team,
        is_qb_dropback: true,
        play_type: 'NOPL'
      })
    ),
    ...Array.from({ length: 2 }, (unused, index) =>
      play_row({
        play_id: 300 + index,
        possession_nfl_team: home_nfl_team,
        is_qb_dropback: false,
        play_type: 'RUSH'
      })
    ),
    ...Array.from({ length: 10 }, (unused, index) =>
      play_row({
        play_id: 400 + index,
        possession_nfl_team: away_nfl_team,
        is_qb_dropback: true,
        play_type: 'PASS'
      })
    )
  ]

  const gamelog = ({
    pid,
    nfl_team,
    opponent_nfl_team,
    game_esbid = esbid
  }) => ({
    esbid: game_esbid,
    pid,
    season_year,
    nfl_team,
    opponent_nfl_team,
    player_position: 'WR'
  })

  const receiving_gamelog = ({
    pid,
    routes,
    route_share = null,
    game_esbid = esbid
  }) => ({
    esbid: game_esbid,
    pid,
    season_year,
    routes,
    route_share
  })

  const get_route_share = async ({ pid, game_esbid = esbid }) => {
    const row = await db('player_receiving_gamelogs')
      .where({ pid, esbid: game_esbid, season_year })
      .first()

    return row.route_share === null ? null : Number(row.route_share)
  }

  before(async () => {
    await db('player')
      .insert(all_pids.map(player_row))
      .onConflict('pid')
      .ignore()
  })

  beforeEach(async () => {
    for (const game_esbid of [esbid, no_dropback_esbid]) {
      await db('player_receiving_gamelogs').where({ esbid: game_esbid }).del()
      await db('player_gamelogs').where({ esbid: game_esbid }).del()
      await db('nfl_plays').where({ esbid: game_esbid }).del()
      await db('nfl_games').where({ esbid: game_esbid }).del()
    }

    await db('nfl_games').insert(
      [esbid, no_dropback_esbid].map((game_esbid, index) => ({
        esbid: game_esbid,
        season_year,
        week: 2 + index,
        season_type: 'REG',
        home_nfl_team,
        away_nfl_team
      }))
    )

    await db('nfl_plays').insert(plays)

    await db('player_gamelogs').insert([
      gamelog({
        pid: home_pid,
        nfl_team: home_nfl_team,
        opponent_nfl_team: away_nfl_team
      }),
      gamelog({
        pid: away_pid,
        nfl_team: away_nfl_team,
        opponent_nfl_team: home_nfl_team
      }),
      gamelog({
        pid: excess_routes_pid,
        nfl_team: home_nfl_team,
        opponent_nfl_team: away_nfl_team
      }),
      gamelog({
        pid: already_shared_pid,
        nfl_team: home_nfl_team,
        opponent_nfl_team: away_nfl_team
      }),
      gamelog({
        pid: no_dropbacks_pid,
        nfl_team: home_nfl_team,
        opponent_nfl_team: away_nfl_team,
        game_esbid: no_dropback_esbid
      })
    ])

    await db('player_receiving_gamelogs').insert([
      receiving_gamelog({ pid: home_pid, routes: 10 }),
      receiving_gamelog({ pid: away_pid, routes: 4 }),
      // More routes than the team has dropbacks: impossible, so the dropback
      // data is incomplete and a computed share would be nonsense.
      receiving_gamelog({ pid: excess_routes_pid, routes: 30 }),
      receiving_gamelog({
        pid: already_shared_pid,
        routes: 10,
        route_share: 12.34
      }),
      receiving_gamelog({
        pid: no_dropbacks_pid,
        routes: 8,
        game_esbid: no_dropback_esbid
      })
    ])
  })

  it('fills route_share from the player own team dropbacks', async () => {
    const result = await recompute_route_share({ season_year })

    expect(result.updated).to.be.at.least(2)

    // 10 of NE's 20 dropbacks. A swapped team resolution gives 100.
    expect(await get_route_share({ pid: home_pid })).to.equal(50)
    // 4 of BUF's 10. A swapped team resolution gives 20.
    expect(await get_route_share({ pid: away_pid })).to.equal(40)
  })

  it('leaves route_share null when the dropback data cannot support it', async () => {
    const result = await recompute_route_share({ season_year })

    expect(await get_route_share({ pid: excess_routes_pid })).to.equal(null)
    expect(
      await get_route_share({
        pid: no_dropbacks_pid,
        game_esbid: no_dropback_esbid
      })
    ).to.equal(null)

    expect(result.skipped_invalid_dropbacks).to.be.at.least(1)
    expect(result.skipped_missing_dropbacks).to.be.at.least(1)
  })

  it('does not overwrite a route_share that is already set', async () => {
    await recompute_route_share({ season_year })

    expect(await get_route_share({ pid: already_shared_pid })).to.equal(12.34)
  })

  it('is idempotent -- a second run has nothing left to fill', async () => {
    await recompute_route_share({ season_year })
    const second_run = await recompute_route_share({ season_year })

    expect(second_run.updated).to.equal(0)
    expect(await get_route_share({ pid: home_pid })).to.equal(50)
  })

  // `scanned` is what the registered route-share-unfilled check grades against.
  // It must count every row carrying routes, not the unfilled subset, or a
  // fully-repaired corpus and a selector matching nothing read identically.
  it('reports the scanned population separately from the candidates', async () => {
    const first_run = await recompute_route_share({ season_year })

    expect(first_run.scanned).to.be.at.least(first_run.candidates)
    expect(first_run.candidates).to.be.at.least(1)

    const second_run = await recompute_route_share({ season_year })

    // The repair drained every FILLABLE candidate, so the candidate count
    // shrinks -- the rows that remain are the ones the healer deliberately
    // skips and can never fill. The scanned population must NOT move, which is
    // the whole reason the check grades against it.
    expect(second_run.candidates).to.be.below(first_run.candidates)
    expect(second_run.updated).to.equal(0)
    expect(second_run.scanned).to.equal(first_run.scanned)
  })

  it('counts a row that already carries a share as scanned', async () => {
    const result = await recompute_route_share({ season_year })

    // already_shared_pid is excluded from candidates but carries routes, so it
    // belongs to the scanned population.
    expect(result.scanned).to.be.above(result.candidates)
  })

  it('writes nothing on a dry run', async () => {
    const result = await recompute_route_share({
      season_year,
      dry_run: true
    })

    expect(result.updated).to.be.at.least(2)
    expect(await get_route_share({ pid: home_pid })).to.equal(null)
  })
})
