import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { Roster, optimizeLineup } from '#libs-shared'
import { current_season, roster_slot_types } from '#constants'
import { getLeague, getRoster, getPlayers, is_main } from '#libs-server'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
// import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('project-lineups')

const project_lineups = async (lid) => {
  if (isNaN(lid)) {
    throw new Error(`Missing lid param: ${lid}`)
  }

  const { year } = current_season
  const league = await getLeague({ lid })
  const teams = await db('teams').where({
    lid,
    season_year: current_season.year
  })
  const team_lineup_inserts = []
  const team_lineup_starter_inserts = []
  const team_lineup_contribution_inserts = []
  const team_lineup_contribution_week_inserts = []
  const baselines = await db('league_baselines').where({
    lid,
    season_year: year
  })

  // Replacement-level points per week/position, from the 'starter' baseline --
  // used to score optimizeLineup's phantom slot when a roster cannot fill a
  // starting position, so it lands at replacement level instead of zero.
  //
  // Read straight off the row. This used to resolve the baseline's pid back to
  // a player and read that player's points, which the season baseline made
  // impossible: it is an expectation over drawn seasons and no player holds it.
  const baseline_points = {}
  for (const baseline of baselines) {
    if (baseline.type !== 'starter') continue
    baseline_points[baseline.week] = baseline_points[baseline.week] || {}
    baseline_points[baseline.week][baseline.player_position] =
      Number(baseline.points) || 0
  }

  for (const team of teams) {
    const tid = team.team_id
    const rosterRows = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRows, league })
    const player_pids = roster.players.map((p) => p.pid)
    const ineligible_slots = [roster_slot_types.PSP, roster_slot_types.PSDP]
    const eligible_starters_pids = roster.players
      .filter((p) => !ineligible_slots.includes(p.slot))
      .map((p) => p.pid)
    const player_rows = await getPlayers({ leagueId: lid, pids: player_pids })
    const eligible_players = player_rows.filter((p) =>
      eligible_starters_pids.includes(p.pid)
    )
    const lineups = optimizeLineup({
      players: eligible_players,
      league
    })

    const baseline_lineups = optimizeLineup({
      players: eligible_players,
      league,
      use_baseline_when_missing: true,
      baseline_points
    })

    // optimizeLineup keys its result by week, so Object.entries hands back a
    // string. Every `week` column these three tables carry is smallint, so cast
    // once here rather than leaning on pg to parse the bound parameter.
    for (const [week, lineup] of Object.entries(lineups)) {
      const week_number = Number(week)
      team_lineup_inserts.push({
        week: week_number,
        tid,
        lid,
        season_year: year,
        optimal_total: lineup.total,
        baseline_total: baseline_lineups[week].baseline_total
      })
      for (const pid of lineup.starter_pids) {
        team_lineup_starter_inserts.push({
          pid,
          week: week_number,
          lid,
          season_year: year,
          tid
        })
      }
    }

    // loop through each player to calculate lineup contribution
    for (const roster_player of roster.players) {
      // calculate contribution per player
      const playerData = {
        starts: 0,
        sp: 0,
        bp: 0,
        weeks: {}
      }

      const { pid } = roster_player
      const player_row = player_rows.find((p) => p.pid === pid)
      const isActive = Boolean(roster.active.find((p) => p.pid === pid))
      let active_player_rows = roster.active.map((a) =>
        player_rows.find((p) => p.pid === a.pid)
      )
      if (isActive) {
        active_player_rows = active_player_rows.filter((p) => p.pid !== pid)
      } else {
        active_player_rows.push(player_row)
      }
      const result = optimizeLineup({ players: active_player_rows, league })

      for (const week in result) {
        const weekData = {
          is_starter: 0,
          sp: 0,
          bp: 0
        }

        const projectedPoints = player_row.points[week]
          ? player_row.points[week].total
          : 0
        if (!projectedPoints) {
          playerData.weeks[week] = weekData
          continue
        }

        const { starter_pids } = lineups[week]
        const isStarter = isActive
          ? starter_pids.includes(pid)
          : result[week].starter_pids.includes(pid)
        if (isStarter) {
          playerData.starts += 1
          weekData.is_starter = 1
          const current_projected_total = lineups[week].total

          // starter+ is difference between current lineup and lineup without player
          const diff = isActive
            ? current_projected_total - result[week].total
            : result[week].total - current_projected_total
          playerData.sp += diff
          weekData.sp = diff
        } else {
          const baseline = baselines.find(
            (b) =>
              b.week === week &&
              b.player_position === player_row.primary_position &&
              b.type === 'available'
          )

          // bench+ is difference between player output and best available
          const diff = projectedPoints - (Number(baseline?.points) || 0)
          if (diff > 0) {
            playerData.bp += diff
            weekData.bp = diff
          }
        }
        playerData.weeks[week] = weekData
      }

      // create inserts
      const { starts, sp, bp } = playerData
      team_lineup_contribution_inserts.push({
        tid,
        lid,
        pid,
        season_year: year,
        starts,
        starter_plus_points: sp,
        bench_plus_points: bp
      })
      for (const week in playerData.weeks) {
        const { is_starter, sp, bp } = playerData.weeks[week]
        team_lineup_contribution_week_inserts.push({
          week: Number(week),
          tid,
          lid,
          pid,
          season_year: year,
          is_starter,
          starter_plus_points: sp,
          bench_plus_points: bp
        })
      }
    }
  }

  if (team_lineup_inserts.length) {
    await db('league_team_lineups')
      .insert(team_lineup_inserts)
      .onConflict(['tid', 'season_year', 'week'])
      .merge()
    log(`saved ${team_lineup_inserts.length} team lineups`)
  }

  if (team_lineup_starter_inserts.length) {
    await db('league_team_lineup_starters')
      .del()
      .where({ lid, season_year: year })
    await db('league_team_lineup_starters')
      .insert(team_lineup_starter_inserts)
      .onConflict(['lid', 'pid', 'season_year', 'week'])
      .merge()
    log(`saved ${team_lineup_starter_inserts.length} team lineup starters`)
  }

  if (team_lineup_contribution_inserts.length) {
    await db('league_team_lineup_contributions')
      .del()
      .where({ lid, season_year: year })
    await db('league_team_lineup_contributions')
      .insert(team_lineup_contribution_inserts)
      .onConflict(['lid', 'pid', 'season_year'])
      .merge()
    log(
      `saved ${team_lineup_contribution_inserts.length} team lineup contributions`
    )
  }

  if (team_lineup_contribution_week_inserts.length) {
    await db('league_team_lineup_contribution_weeks')
      .del()
      .where({ lid, season_year: year })
    await db('league_team_lineup_contribution_weeks')
      .insert(team_lineup_contribution_week_inserts)
      .onConflict(['lid', 'pid', 'season_year', 'week'])
      .merge()
    log(
      `saved ${team_lineup_contribution_week_inserts.length} team lineup contribution weeks`
    )
  }
}

const main = async () => {
  enable_debug_namespaces('project-lineups')
  let error
  try {
    const argv = initialize_cli()
    const lid = argv.lid || 1
    await project_lineups(lid)
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default project_lineups
