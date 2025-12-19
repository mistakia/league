import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, batch_insert, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { ARCHETYPE_THRESHOLDS } from '#libs-shared/simulation/correlation-constants.mjs'
import { current_season } from '#constants'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-player-archetypes')
debug.enable('calculate-player-archetypes')

/**
 * Determine QB archetype based on rushing rate.
 * Priority: rushing_qb > mobile_qb > pocket_passer
 *
 * @param {number} rushing_rate - Rush attempts per game
 * @returns {string} Archetype name
 */
function get_qb_archetype(rushing_rate) {
  const thresholds = ARCHETYPE_THRESHOLDS.QB

  if (rushing_rate >= thresholds.rushing_qb.min_rushing_rate) {
    return 'rushing_qb'
  }
  if (
    rushing_rate >= thresholds.mobile_qb.min_rushing_rate &&
    rushing_rate <= thresholds.mobile_qb.max_rushing_rate
  ) {
    return 'mobile_qb'
  }
  if (rushing_rate <= thresholds.pocket_passer.max_rushing_rate) {
    return 'pocket_passer'
  }

  // Fallback (should not happen with proper thresholds)
  return 'pocket_passer'
}

/**
 * Determine WR archetype based on target share.
 * Priority: target_hog_wr > wr1_level > wr2_level > wr3_level
 *
 * @param {number} target_share - Player target share (0-1)
 * @returns {string} Archetype name
 */
function get_wr_archetype(target_share) {
  const thresholds = ARCHETYPE_THRESHOLDS.WR

  if (target_share >= thresholds.target_hog_wr.min_target_share) {
    return 'target_hog_wr'
  }
  if (
    target_share >= thresholds.wr1_level.min_target_share &&
    target_share <= thresholds.wr1_level.max_target_share
  ) {
    return 'wr1_level'
  }
  if (
    target_share >= thresholds.wr2_level.min_target_share &&
    target_share <= thresholds.wr2_level.max_target_share
  ) {
    return 'wr2_level'
  }
  if (target_share <= thresholds.wr3_level.max_target_share) {
    return 'wr3_level'
  }

  // Fallback
  return 'wr3_level'
}

/**
 * Determine RB archetype based on target ratio (targets / opportunities).
 * Priority: pass_catching_rb > hybrid_rb > traditional_rb
 *
 * @param {number} target_ratio - Targets / (targets + rush attempts)
 * @returns {string} Archetype name
 */
function get_rb_archetype(target_ratio) {
  const thresholds = ARCHETYPE_THRESHOLDS.RB

  if (target_ratio >= thresholds.pass_catching_rb.min_target_ratio) {
    return 'pass_catching_rb'
  }
  if (
    target_ratio >= thresholds.hybrid_rb.min_target_ratio &&
    target_ratio <= thresholds.hybrid_rb.max_target_ratio
  ) {
    return 'hybrid_rb'
  }
  if (target_ratio <= thresholds.traditional_rb.max_target_ratio) {
    return 'traditional_rb'
  }

  // Fallback
  return 'traditional_rb'
}

/**
 * Calculate player archetypes from historical gamelogs.
 * Single-archetype design: each player gets exactly one archetype per year.
 *
 * @param {Object} params
 * @param {number} params.year - Year to calculate archetypes for
 * @returns {Promise<number>} Number of archetype records inserted
 */
const calculate_player_archetypes = async ({ year } = {}) => {
  if (!year) {
    throw new Error('year is required')
  }

  log(`Calculating player archetypes for year ${year}`)

  // Get player stats aggregated by year
  const player_stats = await db('player_gamelogs')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .join('player', 'player_gamelogs.pid', 'player.pid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')
    .select(
      'player_gamelogs.pid',
      'player.pos',
      db.raw('SUM(player_gamelogs.ra) as total_rush_att'),
      db.raw('SUM(player_gamelogs.trg) as total_targets'),
      db.raw('COUNT(DISTINCT player_gamelogs.esbid) as games_played')
    )
    .groupBy('player_gamelogs.pid', 'player.pos')

  log(`Found ${player_stats.length} players with gamelogs`)

  // Get team totals for target share calculations
  const team_totals = await db('player_gamelogs')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')
    .select(
      'player_gamelogs.tm',
      db.raw('SUM(player_gamelogs.trg) as total_team_targets')
    )
    .groupBy('player_gamelogs.tm')

  const team_target_map = new Map()
  for (const t of team_totals) {
    team_target_map.set(t.tm, parseInt(t.total_team_targets, 10) || 0)
  }

  // Get player primary team (team with most games)
  const player_teams = await db('player_gamelogs')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')
    .select(
      'player_gamelogs.pid',
      'player_gamelogs.tm',
      db.raw('COUNT(*) as games_on_team')
    )
    .groupBy('player_gamelogs.pid', 'player_gamelogs.tm')
    .orderBy([
      { column: 'player_gamelogs.pid' },
      { column: 'games_on_team', order: 'desc' }
    ])

  const player_primary_team = new Map()
  for (const pt of player_teams) {
    if (!player_primary_team.has(pt.pid)) {
      player_primary_team.set(pt.pid, pt.tm)
    }
  }

  const archetype_records = []
  const min_games = 4 // Minimum games for reliable classification

  for (const player of player_stats) {
    const games = parseInt(player.games_played, 10) || 0

    if (games < min_games) {
      continue
    }

    const rush_att = parseInt(player.total_rush_att, 10) || 0
    const targets = parseInt(player.total_targets, 10) || 0
    const primary_team = player_primary_team.get(player.pid)
    const team_targets = team_target_map.get(primary_team) || 1

    let archetype = null
    let rushing_rate = null
    let target_share = null
    let opportunity_share = null

    // QB archetype: based on rushing rate (rush attempts per game)
    if (player.pos === 'QB') {
      rushing_rate = rush_att / games
      archetype = get_qb_archetype(rushing_rate)
    }

    // WR archetype: based on target share
    if (player.pos === 'WR') {
      target_share = targets / team_targets
      archetype = get_wr_archetype(target_share)
    }

    // RB archetype: based on target ratio (targets / opportunities)
    if (player.pos === 'RB') {
      const opportunities = rush_att + targets
      if (opportunities > 0) {
        opportunity_share = targets / opportunities
        archetype = get_rb_archetype(opportunity_share)
      }
    }

    // TE, K, DST: no archetypes defined (use position defaults for correlations)
    if (archetype) {
      archetype_records.push({
        pid: player.pid,
        year,
        pos: player.pos,
        archetype,
        rushing_rate: rushing_rate !== null ? rushing_rate.toFixed(2) : null,
        target_share: target_share !== null ? target_share.toFixed(3) : null,
        opportunity_share:
          opportunity_share !== null ? opportunity_share.toFixed(3) : null,
        confidence: 1.0,
        calculated_at: new Date()
      })
    }
  }

  log(`Inserting ${archetype_records.length} archetype records`)

  // Insert in batches with single-archetype upsert
  if (archetype_records.length > 0) {
    await batch_insert({
      items: archetype_records,
      batch_size: 1000,
      save: async (batch) => {
        await db('player_archetypes')
          .insert(batch)
          .onConflict(['pid', 'year'])
          .merge()
      }
    })
  }

  log(`Completed: inserted ${archetype_records.length} archetype records`)
  return archetype_records.length
}

const main = async () => {
  let error
  try {
    const year = argv.year || current_season.year - 1
    await calculate_player_archetypes({ year })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.CALCULATE_PLAYER_ARCHETYPES,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_player_archetypes
