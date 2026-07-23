import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { Roster, calculateStandings } from '#libs-shared'
import { current_season } from '#constants'
import { is_main, getRoster, getLeague, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process-matchups')
debug.enable('process-matchups,calculate-standings')

const run = async ({ lid = 1, year = current_season.year }) => {
  const league = await getLeague({ lid, year })
  const matchups = await db('matchups').where({ lid, year })
  const teams = await db('teams').where({ lid, year })

  const finalWeek =
    year === current_season.year
      ? Math.min(
          Math.max(current_season.week - 1, 0),
          current_season.regularSeasonFinalWeek
        )
      : current_season.regularSeasonFinalWeek

  const starters = {}
  const active = {}
  const player_pids = {}
  for (let week = 1; week <= finalWeek; week++) {
    starters[week] = {}
    active[week] = {}
    for (const team of teams) {
      const rosterRow = await getRoster({ tid: team.uid, week, year })
      const roster = new Roster({ roster: rosterRow, league })
      starters[week][team.uid] = roster.starters.map((p) => ({
        pid: p.pid,
        pos: p.pos,
        slot: p.slot
      }))
      active[week][team.uid] = roster.active.map((p) => ({
        pid: p.pid,
        pos: p.pos
      }))
      for (const p of roster.active) {
        player_pids[p.pid] = true
      }
    }
  }

  const gamelogs = await db('player_gamelogs')
    .select('player_gamelogs.*', 'nfl_games.week')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.season_year', year)
    .where('player_gamelogs.active', true)
    .where('nfl_games.season_type', 'REG')
    .whereIn('player_gamelogs.pid', Object.keys(player_pids))

  const result = calculateStandings({
    starters,
    active,
    league,
    teams,
    gamelogs,
    matchups,
    year
  })

  for (const matchup of matchups) {
    const { week } = matchup
    matchup.hp = result[matchup.hid].points.weeks[week]
    matchup.ap = result[matchup.aid].points.weeks[week]

    matchup.hpp = result[matchup.hid].potential_points_weekly[week]
    matchup.app = result[matchup.aid].potential_points_weekly[week]
  }

  // Constitution Article XI section 3 + Amendment XXVI: when a team had a
  // weekly optimal lineup that did not fill every required starter slot AND
  // still owns its own upcoming first-round pick, replace that team's weekly
  // potential points with the league-max for that week. Stored as a delta in
  // potential_points_penalty; draft_order_index consumes (potential_points + penalty).
  const potential_points_max_by_week = {}
  for (const team of Object.values(result)) {
    for (const [week_str, pp] of Object.entries(team.potential_points_weekly)) {
      const week = Number(week_str)
      if (
        potential_points_max_by_week[week] === undefined ||
        pp > potential_points_max_by_week[week]
      ) {
        potential_points_max_by_week[week] = pp
      }
    }
  }

  for (const team of Object.values(result)) {
    if (team.incomplete_optimal_lineup_weeks.size === 0) continue
    const owns_own_first_round_pick = await db('draft')
      .where({
        lid,
        year: year + 1,
        round: 1,
        otid: team.tid,
        tid: team.tid,
        comp: false
      })
      .first('uid')
    if (!owns_own_first_round_pick) continue
    let penalty = 0
    for (const week of team.incomplete_optimal_lineup_weeks) {
      penalty +=
        potential_points_max_by_week[week] - team.potential_points_weekly[week]
    }
    team.stats.potential_points_penalty = penalty
  }

  // Recompute draft_order_index now that penalties are applied. The placeholder
  // values calculateStandings wrote (with penalty=0) are overwritten in place
  // before the upsert spread.
  const adjusted_pp_per_team = Object.values(result).map(
    (t) => t.stats.potential_points + t.stats.potential_points_penalty
  )
  const apl_per_team = Object.values(result).map((t) => t.stats.all_play_losses)
  const min_pp = Math.min(...adjusted_pp_per_team)
  const max_pp = Math.max(...adjusted_pp_per_team)
  const min_apl = Math.min(...apl_per_team)
  const max_apl = Math.max(...apl_per_team)
  for (const team of Object.values(result)) {
    const adjusted_pp =
      team.stats.potential_points + team.stats.potential_points_penalty
    const norm_pp = (adjusted_pp - min_pp) / (max_pp - min_pp)
    const norm_apl =
      (team.stats.all_play_losses - min_apl) / (max_apl - min_apl)
    team.stats.draft_order_index = 9 * norm_pp + norm_apl || 0
  }

  const league_team_seasonlogs = []
  for (const [tid, team] of Object.entries(result)) {
    const tm = teams.find((t) => t.uid === team.tid)
    // Remove post_season_finish and overall_finish from the stats object as they are not calculated and should not overwrite existing values
    const { post_season_finish, overall_finish, ...remainingStats } = team.stats
    league_team_seasonlogs.push({
      tid,
      lid,
      year,
      division: tm.div,
      ...remainingStats
    })
  }

  if (league_team_seasonlogs.length) {
    await db('league_team_seasonlogs')
      .insert(league_team_seasonlogs)
      .onConflict(['tid', 'year'])
      .merge()
    log(`saved team stats for ${league_team_seasonlogs.length} teams`)
  }

  if (matchups.length) {
    await db('matchups').insert(matchups).onConflict('uid').merge()
    log(`saved ${matchups.length} matchups`)
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const lid = argv.lid
    const year = argv.year
    await run({ year, lid })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROCESS_MATCHUPS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
