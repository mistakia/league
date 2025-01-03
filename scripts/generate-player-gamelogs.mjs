import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main, report_job, batch_insert } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  constants,
  groupBy,
  fixTeam,
  calculateStatsFromPlayStats,
  calculateDstStatsFromPlays
} from '#libs-shared'
import db from '#db'
import { get_play_stats } from '#libs-server/play-stats-utils.mjs'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-player-gamelogs')
debug.enable('generate-player-gamelogs')

const format_base_gamelog = ({ esbid, stats, opp, tm, year }) => {
  const cleaned_stats = Object.keys(stats)
    .filter((key) => constants.fantasyStats.includes(key))
    .reduce((obj, key) => {
      obj[key] = stats[key]
      return obj
    }, {})

  return {
    esbid,
    tm,
    opp,
    year,
    ...cleaned_stats
  }
}

const format_player_gamelog = ({ esbid, pid, stats, opp, pos, tm, year }) => {
  return {
    ...format_base_gamelog({ esbid, stats, opp, tm, year }),
    pid,
    pos,
    active: true
  }
}

const format_receiving_gamelog = ({ esbid, pid, stats, year, team_stats }) => {
  const team_target_share = team_stats.trg ? stats.trg / team_stats.trg : 0
  const team_air_yard_share = team_stats.passing_air_yards
    ? stats.targeted_air_yards / team_stats.passing_air_yards
    : 0

  return {
    esbid,
    pid,
    year,
    longest_reception: stats.longest_reception,
    recv_yards_15_plus_count: stats.recv_yards_15_plus_count,
    team_target_share,
    team_air_yard_share,
    redzone_targets: stats.redzone_targets,
    weighted_opportunity_rating:
      1.5 * team_target_share + 0.7 * team_air_yard_share
  }
}

const format_rushing_gamelog = ({ esbid, pid, stats, year, team_stats }) => {
  const rush_share = team_stats.ra ? stats.ra / team_stats.ra : null
  const weighted_opportunity =
    1.3 * stats.rush_attempts_redzone +
    2.25 * stats.redzone_targets +
    0.48 * (stats.ra - stats.rush_attempts_redzone) +
    1.43 * (stats.trg - stats.redzone_targets)
  const rush_yards_per_attempt = stats.ry / stats.ra

  return {
    esbid,
    pid,
    year,
    longest_rush: stats.longest_rush,
    rush_share,
    weighted_opportunity,
    rush_yards_per_attempt,
    rush_attempts_redzone: stats.rush_attempts_redzone,
    rush_attempts_goaline: stats.rush_attempts_goaline
  }
}

const generate_receiving_gamelog = ({
  player_gamelog,
  stats,
  team_gamelog_inserts,
  player_receiving_gamelog_inserts
}) => {
  if (
    player_gamelog.rec > 0 ||
    player_gamelog.recy > 0 ||
    player_gamelog.trg > 0
  ) {
    const team_gamelog = team_gamelog_inserts.find(
      (t) =>
        t.tm === fixTeam(player_gamelog.tm) && t.esbid === player_gamelog.esbid
    )
    const receiving_gamelog = format_receiving_gamelog({
      pid: player_gamelog.pid,
      esbid: player_gamelog.esbid,
      year: player_gamelog.year,
      stats,
      team_stats: team_gamelog
    })
    player_receiving_gamelog_inserts.push(receiving_gamelog)
  }
}

const generate_rushing_gamelog = ({
  player_gamelog,
  stats,
  team_gamelog_inserts,
  player_rushing_gamelog_inserts
}) => {
  if (player_gamelog.ra > 0) {
    const team_gamelog = team_gamelog_inserts.find(
      (t) =>
        t.tm === fixTeam(player_gamelog.tm) && t.esbid === player_gamelog.esbid
    )
    const rushing_gamelog = format_rushing_gamelog({
      pid: player_gamelog.pid,
      esbid: player_gamelog.esbid,
      year: player_gamelog.year,
      stats,
      team_stats: team_gamelog
    })
    player_rushing_gamelog_inserts.push(rushing_gamelog)
  }
}

const generate_player_gamelogs = async ({
  week = constants.season.last_week_with_stats,
  year = constants.season.year,
  seas_type = constants.season.nfl_seas_type,
  dry_run = false
}) => {
  log(`loading plays for ${year} week ${week}`)

  const playStats = await get_play_stats({ year, week, seas_type })

  const unique_esbids = [...new Set(playStats.map((p) => p.esbid))]
  log(`loaded play stats for ${unique_esbids.length} games`)
  log(unique_esbids.join(', '))

  const player_gamelog_inserts = []
  const player_receiving_gamelog_inserts = []
  const player_rushing_gamelog_inserts = []
  const team_gamelog_inserts = []
  const missing = []

  // Group play stats by team
  const play_stats_by_team = groupBy(playStats, 'clubCode')

  // Generate team gamelogs
  for (const team of Object.keys(play_stats_by_team)) {
    const team_play_stats = play_stats_by_team[team]
    const team_stats = calculateStatsFromPlayStats(team_play_stats)
    const play_stat = team_play_stats[0]
    const opp =
      fixTeam(play_stat.h) === fixTeam(team)
        ? fixTeam(play_stat.v)
        : fixTeam(play_stat.h)

    // TODO format to match table schema
    const team_gamelog = {
      ...team_stats,
      esbid: play_stat.esbid,
      tm: fixTeam(team),
      opp,
      year: play_stat.year
    }
    team_gamelog_inserts.push(team_gamelog)
  }

  const play_stats_by_gsispid = groupBy(playStats, 'gsispid')
  const gsispids = Object.keys(play_stats_by_gsispid)
  const player_gsispid_rows = await db('player').whereIn('gsispid', gsispids)

  log(
    `loaded play stats for ${Object.keys(play_stats_by_gsispid).length} gsispid players`
  )

  const play_stats_by_gsisid = groupBy(playStats, 'gsisId')
  const gsisids = Object.keys(play_stats_by_gsisid)
  const player_gsisid_rows = await db('player').whereIn('gsisid', gsisids)

  log(
    `loaded play stats for ${Object.keys(play_stats_by_gsisid).length} gsisid players`
  )

  // track generated gamelogs by gsispids
  const gamelog_gsispids = []

  // generate player gamelogs
  for (const gsispid of Object.keys(play_stats_by_gsispid)) {
    if (gsispid === 'null') continue

    const player_row = player_gsispid_rows.find((p) => p.gsispid === gsispid)
    if (!player_row) {
      log(`missing player for gsispid: ${gsispid}`)
      continue
    }

    const playStat = play_stats_by_gsispid[gsispid].find((p) => p.clubCode)
    if (!playStat) continue
    const opp =
      fixTeam(playStat.clubCode) === fixTeam(playStat.h)
        ? fixTeam(playStat.v)
        : fixTeam(playStat.h)
    const stats = calculateStatsFromPlayStats(play_stats_by_gsispid[gsispid])

    gamelog_gsispids.push(gsispid)
    const player_gamelog = format_player_gamelog({
      pid: player_row.pid,
      pos: player_row.pos,
      tm: fixTeam(playStat.clubCode),
      opp,
      esbid: playStat.esbid,
      year: playStat.year,
      stats
    })
    player_gamelog_inserts.push(player_gamelog)

    generate_receiving_gamelog({
      player_gamelog,
      stats,
      team_gamelog_inserts,
      player_receiving_gamelog_inserts
    })

    generate_rushing_gamelog({
      player_gamelog,
      stats,
      team_gamelog_inserts,
      player_rushing_gamelog_inserts
    })
  }

  for (const gsisid of Object.keys(play_stats_by_gsisid)) {
    if (gsisid === 'null') continue

    const player_row = player_gsisid_rows.find((p) => p.gsisid === gsisid)
    if (!player_row) {
      log(`missing player for gsisid: ${gsisid}`)
      continue
    }

    // check to see if gamelog was already generated using gsispid
    if (player_row.gsispid && gamelog_gsispids.includes(player_row.gsispid))
      continue

    const playStat = play_stats_by_gsisid[gsisid].find((p) => p.clubCode)
    if (!playStat) continue
    const opp =
      fixTeam(playStat.clubCode) === fixTeam(playStat.h)
        ? fixTeam(playStat.v)
        : fixTeam(playStat.h)

    const stats = calculateStatsFromPlayStats(play_stats_by_gsisid[gsisid])

    const player_gamelog = format_player_gamelog({
      pid: player_row.pid,
      pos: player_row.pos,
      tm: fixTeam(playStat.clubCode),
      opp,
      esbid: playStat.esbid,
      year: playStat.year,
      stats
    })
    player_gamelog_inserts.push(player_gamelog)

    generate_receiving_gamelog({
      player_gamelog,
      stats,
      team_gamelog_inserts,
      player_receiving_gamelog_inserts
    })

    generate_rushing_gamelog({
      player_gamelog,
      stats,
      team_gamelog_inserts,
      player_rushing_gamelog_inserts
    })
  }

  // generate defense gamelogs
  for (const team of constants.nflTeams) {
    const opponentPlays = playStats.filter((p) => {
      if (fixTeam(p.h) !== team && fixTeam(p.v) !== team) {
        return false
      }

      return (
        (Boolean(p.pos_team) && fixTeam(p.pos_team) !== team) ||
        p.play_type_nfl === 'PUNT' ||
        p.play_type_nfl === 'KICK_OFF' ||
        p.play_type_nfl === 'XP_KICK'
      )
    })
    if (!opponentPlays.length) continue
    const play = opponentPlays[0]
    const opp = fixTeam(play.h) === team ? play.v : play.h
    const groupedPlays = groupBy(opponentPlays, 'playId')
    const formattedPlays = []
    for (const playId in groupedPlays) {
      const playStats = groupedPlays[playId]
      const p = playStats[0]
      formattedPlays.push({
        pos_team: p.pos_team,
        drive_play_count: p.drive_play_count,
        play_type_nfl: p.play_type_nfl,
        playStats
      })
    }
    const stats = calculateDstStatsFromPlays(formattedPlays, team)
    const player_gamelog = format_player_gamelog({
      pid: team,
      pos: 'DST',
      tm: team,
      esbid: play.esbid,
      year: play.year,
      opp: fixTeam(opp),
      stats
    })
    player_gamelog_inserts.push(player_gamelog)
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.pname} / ${m.current_nfl_team}`)
  )

  if (dry_run) {
    log(player_gamelog_inserts[0])
    log(player_receiving_gamelog_inserts[0])
    log(player_rushing_gamelog_inserts[0])
    log(team_gamelog_inserts[0])
    log(
      `Generated ${player_gamelog_inserts.length} player gamelogs, ${player_receiving_gamelog_inserts.length} receiving gamelogs, ${player_rushing_gamelog_inserts.length} rushing gamelogs, and ${team_gamelog_inserts.length} team gamelogs for ${year} week ${week}`
    )
    return
  }

  if (player_gamelog_inserts.length) {
    await batch_insert({
      items: player_gamelog_inserts,
      save: async (batch) => {
        await db('player_gamelogs')
          .insert(batch)
          .onConflict(['esbid', 'pid', 'year'])
          .merge()
      },
      batch_size: 500
    })
    log(`Updated ${player_gamelog_inserts.length} gamelogs`)
  }

  if (player_receiving_gamelog_inserts.length) {
    await batch_insert({
      items: player_receiving_gamelog_inserts,
      save: async (batch) => {
        await db('player_receiving_gamelogs')
          .insert(batch)
          .onConflict(['esbid', 'pid', 'year'])
          .merge()
      },
      batch_size: 500
    })
    log(`Updated ${player_receiving_gamelog_inserts.length} receiving gamelogs`)
  }

  if (player_rushing_gamelog_inserts.length) {
    await batch_insert({
      items: player_rushing_gamelog_inserts,
      save: async (batch) => {
        await db('player_rushing_gamelogs')
          .insert(batch)
          .onConflict(['esbid', 'pid', 'year'])
          .merge()
      },
      batch_size: 500
    })
    log(`Updated ${player_rushing_gamelog_inserts.length} rushing gamelogs`)
  }

  // Insert team gamelogs
  // TODO
  // if (team_gamelog_inserts.length) {
  //   await batch_insert({
  //     items: team_gamelog_inserts,
  //     save: async (batch) => {
  //       await db('team_gamelogs')
  //         .insert(batch)
  //         .onConflict(['esbid', 'tm', 'year'])
  //         .merge()
  //     },
  //     batch_size: 500
  //   })
  //   log(`Updated ${team_gamelog_inserts.length} team gamelogs`)
  // }
}

const main = async () => {
  let error
  try {
    await handle_season_args_for_script({
      argv,
      script_name: 'generate-player-gamelogs',
      script_function: generate_player_gamelogs,
      year_query: ({ seas_type = 'REG' }) =>
        db('nfl_games')
          .select('year')
          .where({ seas_type })
          .groupBy('year')
          .orderBy('year', 'asc'),
      week_query: ({ year, seas_type = 'REG' }) =>
        db('nfl_games')
          .select('week')
          .where({ year, seas_type })
          .groupBy('week')
          .orderBy('week', 'asc'),
      script_args: {
        dry_run: argv.dry
      },
      seas_type: argv.seas_type
    })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.GENERATE_PLAYER_GAMELOGS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_player_gamelogs
