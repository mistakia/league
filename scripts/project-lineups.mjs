import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, Roster, optimizeLineup } from '#libs-shared'
import { getLeague, getRoster, getPlayers, isMain } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('project-lineups')

const run = async (lid) => {
  if (isNaN(lid)) {
    throw new Error(`Missing lid param: ${lid}`)
  }

  const { year } = constants.season
  const league = await getLeague({ lid })
  const teams = await db('teams').where({
    lid,
    year: constants.season.year
  })
  const team_lineup_inserts = []
  const team_lineup_starter_inserts = []
  const team_lineup_contribution_inserts = []
  const team_lineup_contribution_week_inserts = []
  const baselines = await db('league_baselines').where({ lid, year })
  const baseline_pids = [...new Set(baselines.map((p) => p.pid))]
  const baseline_players = await getPlayers({ pids: baseline_pids })

  for (const team of teams) {
    const tid = team.uid
    const rosterRows = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRows, league })
    const player_pids = roster.players.map((p) => p.pid)
    const active_pids = roster.active.map((p) => p.pid)
    const player_rows = await getPlayers({ leagueId: lid, pids: player_pids })
    const active_players = player_rows.filter((p) =>
      active_pids.includes(p.pid)
    )
    const lineups = optimizeLineup({
      players: active_players,
      league
    })

    const baseline_lineups = optimizeLineup({
      players: active_players,
      league,
      use_baseline_when_missing: true
    })

    for (const [week, lineup] of Object.entries(lineups)) {
      team_lineup_inserts.push({
        week,
        tid,
        lid,
        year,
        total: lineup.total,
        baseline_total: baseline_lineups[week].baseline_total
      })
      for (const pid of lineup.starter_pids) {
        team_lineup_starter_inserts.push({
          pid,
          week,
          lid,
          year,
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
          start: 0,
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
          weekData.start = 1
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
              b.pos === player_row.pos &&
              b.type === 'available'
          )
          const baseline_player = baseline_players.find(
            (b) => b.pid === baseline.pid
          )

          // bench+ is difference between player output and best available
          const diff = projectedPoints - baseline_player.points[week].total
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
        year,
        starts,
        sp,
        bp
      })
      for (const week in playerData.weeks) {
        const { start, sp, bp } = playerData.weeks[week]
        team_lineup_contribution_week_inserts.push({
          week,
          tid,
          lid,
          pid,
          year,
          start,
          sp,
          bp
        })
      }
    }
  }

  if (team_lineup_inserts.length) {
    await db('league_team_lineups')
      .insert(team_lineup_inserts)
      .onConflict()
      .merge()
    log(`saved ${team_lineup_inserts.length} team lineups`)
  }

  if (team_lineup_starter_inserts.length) {
    await db('league_team_lineup_starters').del().where({ lid, year })
    await db('league_team_lineup_starters')
      .insert(team_lineup_starter_inserts)
      .onConflict()
      .merge()
    log(`saved ${team_lineup_starter_inserts.length} team lineup starters`)
  }

  if (team_lineup_contribution_inserts.length) {
    await db('league_team_lineup_contributions').del().where({ lid, year })
    await db('league_team_lineup_contributions')
      .insert(team_lineup_contribution_inserts)
      .onConflict()
      .merge()
    log(
      `saved ${team_lineup_contribution_inserts.length} team lineup contributions`
    )
  }

  if (team_lineup_contribution_week_inserts.length) {
    await db('league_team_lineup_contribution_weeks').del().where({ lid, year })
    await db('league_team_lineup_contribution_weeks')
      .insert(team_lineup_contribution_week_inserts)
      .onConflict()
      .merge()
    log(
      `saved ${team_lineup_contribution_week_inserts.length} team lineup contribution weeks`
    )
  }
}

const main = async () => {
  debug.enable('project-lineups')
  let error
  try {
    const lid = argv.lid || 1
    await run(lid)
  } catch (err) {
    error = err
    console.log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
