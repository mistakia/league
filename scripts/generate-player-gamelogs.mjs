/**
 * Generate Player Gamelogs
 *
 * This script creates comprehensive player gamelogs from play-by-play data.
 *
 * Process Overview:
 * 1. Load play stats from nfl_plays table
 * 2. Calculate stats from play-by-play data (targets, receptions, yards, etc.)
 * 3. Generate receiving and rushing advanced metrics
 * 4. Create defense/special teams gamelogs
 * 5. Add snap-based gamelogs for players without counting stats
 *    (ensures all active players have gamelogs even with 0 targets/carries)
 *
 * Data Sources:
 * - nfl_plays: Play-by-play data with player stats
 * - nfl_snaps: Snap participation data
 * - player_receiving_gamelogs: Route data
 *
 * Usage:
 *   node scripts/generate-player-gamelogs.mjs --year 2025 --week 8
 *   node scripts/generate-player-gamelogs.mjs --year 2025 --week 8 --dry
 */

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

const format_receiving_gamelog = ({
  esbid,
  pid,
  stats,
  year,
  team_stats,
  player_routes,
  team_dropbacks
}) => {
  const team_target_share = team_stats.trg ? stats.trg / team_stats.trg : 0
  const team_air_yard_share = team_stats.passing_air_yards
    ? stats.targeted_air_yards / team_stats.passing_air_yards
    : 0
  const route_share =
    player_routes && team_dropbacks
      ? (player_routes / team_dropbacks) * 100
      : null

  return {
    esbid,
    pid,
    year,
    longest_reception: stats.longest_reception,
    recv_yards_15_plus_count: stats.recv_yards_15_plus_count,
    team_target_share,
    team_air_yard_share,
    route_share,
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
  player_receiving_gamelog_inserts,
  player_routes_by_game,
  team_dropbacks_by_game
}) => {
  const player_routes =
    player_routes_by_game[`${player_gamelog.pid}_${player_gamelog.esbid}`] ||
    null

  if (
    player_gamelog.rec > 0 ||
    player_gamelog.recy > 0 ||
    player_gamelog.trg > 0 ||
    player_routes > 0
  ) {
    const team_gamelog = team_gamelog_inserts.find(
      (t) =>
        t.tm === fixTeam(player_gamelog.tm) && t.esbid === player_gamelog.esbid
    )
    const team_dropbacks =
      team_dropbacks_by_game[
        `${fixTeam(player_gamelog.tm)}_${player_gamelog.esbid}`
      ] || null
    const receiving_gamelog = format_receiving_gamelog({
      pid: player_gamelog.pid,
      esbid: player_gamelog.esbid,
      year: player_gamelog.year,
      stats,
      team_stats: team_gamelog,
      player_routes,
      team_dropbacks
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

/**
 * Generate gamelogs for players who played snaps but didn't record any counting stats
 * This ensures all active players have gamelogs, even if they had 0 targets, 0 carries, etc.
 *
 * @param {Array<number>} unique_esbids - Array of game IDs to process
 * @param {number} year - Season year
 * @param {Array<Object>} player_gamelog_inserts - Existing gamelogs (will be modified)
 * @returns {Promise<number>} Number of snap-based gamelogs added
 */
const generate_snap_based_gamelogs = async ({
  unique_esbids,
  year,
  player_gamelog_inserts
}) => {
  log('Checking for players with snaps but no stats...')

  // Query players who played snaps in these games
  const players_with_snaps = await db('nfl_snaps')
    .select(
      'player.pid',
      'player.pos',
      'player.current_nfl_team',
      'nfl_snaps.esbid'
    )
    .join('player', 'player.gsis_it_id', 'nfl_snaps.gsis_it_id')
    .whereIn('nfl_snaps.esbid', unique_esbids)
    .where('nfl_snaps.year', year)
    .groupBy(
      'player.pid',
      'player.pos',
      'player.current_nfl_team',
      'nfl_snaps.esbid'
    )
    .havingRaw('COUNT(*) > 0')

  log(`Found ${players_with_snaps.length} players with snap data`)

  // Build game lookup for opponent determination
  const games_by_esbid = await db('nfl_games')
    .whereIn('esbid', unique_esbids)
    .then((games) =>
      games.reduce((acc, game) => {
        acc[game.esbid] = game
        return acc
      }, {})
    )

  // Add gamelogs for players with snaps but no existing gamelog
  let added_count = 0
  for (const snap_player of players_with_snaps) {
    const already_has_gamelog = player_gamelog_inserts.some(
      (gamelog) =>
        gamelog.pid === snap_player.pid && gamelog.esbid === snap_player.esbid
    )

    if (!already_has_gamelog) {
      const game = games_by_esbid[snap_player.esbid]
      if (!game) {
        log(`Warning: Could not find game for esbid ${snap_player.esbid}`)
        continue
      }

      const team = fixTeam(snap_player.current_nfl_team)
      const opponent =
        fixTeam(game.h) === team ? fixTeam(game.v) : fixTeam(game.h)

      player_gamelog_inserts.push({
        esbid: snap_player.esbid,
        pid: snap_player.pid,
        pos: snap_player.pos,
        tm: team,
        opp: opponent,
        year,
        active: true
        // All counting stats default to NULL/0
      })
      added_count++
    }
  }

  log(
    `Added ${added_count} snap-based gamelogs for players without counting stats`
  )

  return added_count
}

/**
 * Generate player gamelogs from play-by-play data
 *
 * This script processes NFL play data to create comprehensive player gamelogs including:
 * - Basic player stats (passing, rushing, receiving)
 * - Advanced receiving metrics (routes, target share, etc.)
 * - Advanced rushing metrics (rush share, opportunity, etc.)
 * - Team aggregates
 * - Defense/special teams stats
 * - Snap-based gamelogs for players without counting stats
 *
 * @param {number} week - Week number to process
 * @param {number} year - Season year
 * @param {string} seas_type - Season type (REG, PRE, POST)
 * @param {boolean} dry_run - If true, shows what would be generated without saving
 */
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

  // Load player routes data from existing gamelogs
  const player_routes_query = await db('player_receiving_gamelogs')
    .select('pid', 'esbid', 'routes')
    .whereIn('esbid', unique_esbids)
    .where({ year })
    .whereNotNull('routes')
  log(`loaded routes data for ${player_routes_query.length} players`)

  // Create player routes lookup structure
  const player_routes_by_game = player_routes_query.reduce((acc, row) => {
    acc[`${row.pid}_${row.esbid}`] = row.routes
    return acc
  }, {})

  // Load team dropbacks from nfl_plays
  const team_dropbacks_query = await db('nfl_plays')
    .select('pos_team as tm', 'esbid')
    .count('* as dropbacks')
    .whereIn('esbid', unique_esbids)
    .where({ qb_dropback: true })
    .whereNot({ play_type: 'NOPL' })
    .groupBy('pos_team', 'esbid')
  log(`loaded dropback counts for ${team_dropbacks_query.length} team-games`)

  // Create team dropbacks lookup structure
  const team_dropbacks_by_game = team_dropbacks_query.reduce((acc, row) => {
    acc[`${fixTeam(row.tm)}_${row.esbid}`] = parseInt(row.dropbacks, 10)
    return acc
  }, {})

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
      player_receiving_gamelog_inserts,
      player_routes_by_game,
      team_dropbacks_by_game
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
      player_receiving_gamelog_inserts,
      player_routes_by_game,
      team_dropbacks_by_game
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

  // Generate gamelogs for players who played snaps but didn't record any counting stats
  // This ensures complete coverage (e.g., WR with 0 targets still gets a gamelog)
  await generate_snap_based_gamelogs({
    unique_esbids,
    year,
    player_gamelog_inserts
  })

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
