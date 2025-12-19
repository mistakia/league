import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { sampleCorrelation } from 'simple-statistics'

import db from '#db'
import { is_main, batch_insert, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { CORRELATION_THRESHOLDS } from '#libs-shared/simulation/correlation-constants.mjs'
import { current_season } from '#constants'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-player-correlations')
debug.enable('calculate-player-correlations')

/**
 * Calculate all player-pair correlations from historical gamelogs.
 */
const calculate_player_correlations = async ({
  year,
  scoring_format_hash
} = {}) => {
  if (!year) {
    throw new Error('year is required')
  }
  if (!scoring_format_hash) {
    throw new Error('scoring_format_hash is required')
  }

  log(`Calculating player correlations for year ${year}`)

  // Get all games for the year
  const games = await db('nfl_games')
    .where({ year, seas_type: 'REG' })
    .select('esbid', 'v', 'h')

  const game_map = new Map()
  for (const game of games) {
    game_map.set(game.esbid, { v: game.v, h: game.h })
  }

  log(`Found ${games.length} regular season games`)

  // Get all fantasy points per game per player
  const gamelogs = await db('scoring_format_player_gamelogs')
    .join(
      'nfl_games',
      'scoring_format_player_gamelogs.esbid',
      'nfl_games.esbid'
    )
    .join('player', 'scoring_format_player_gamelogs.pid', 'player.pid')
    .where('nfl_games.year', year)
    .where(
      'scoring_format_player_gamelogs.scoring_format_hash',
      scoring_format_hash
    )
    .select(
      'scoring_format_player_gamelogs.pid',
      'scoring_format_player_gamelogs.esbid',
      'scoring_format_player_gamelogs.points',
      'player.current_nfl_team'
    )

  log(`Found ${gamelogs.length} gamelog entries`)

  // Group by player
  const player_games = new Map()
  for (const gl of gamelogs) {
    if (!player_games.has(gl.pid)) {
      player_games.set(gl.pid, new Map())
    }
    player_games.get(gl.pid).set(gl.esbid, {
      points: parseFloat(gl.points),
      team: gl.current_nfl_team
    })
  }

  // Get team for each player in each game from gamelogs
  const player_game_teams = await db('player_gamelogs')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .where('nfl_games.year', year)
    .select(
      'player_gamelogs.pid',
      'player_gamelogs.esbid',
      'player_gamelogs.tm'
    )

  const player_team_by_game = new Map()
  for (const pgt of player_game_teams) {
    const key = `${pgt.pid}:${pgt.esbid}`
    player_team_by_game.set(key, pgt.tm)
  }

  const player_ids = [...player_games.keys()]
  log(`Processing ${player_ids.length} players`)

  const correlations_to_insert = []

  // Calculate correlations for all player pairs
  for (let i = 0; i < player_ids.length; i++) {
    const pid_a = player_ids[i]
    const games_a = player_games.get(pid_a)

    for (let j = i + 1; j < player_ids.length; j++) {
      const pid_b = player_ids[j]
      const games_b = player_games.get(pid_b)

      // Find games where both players played
      const common_games = []
      for (const [esbid, data_a] of games_a) {
        if (games_b.has(esbid)) {
          const data_b = games_b.get(esbid)
          const game_info = game_map.get(esbid)

          const team_a =
            player_team_by_game.get(`${pid_a}:${esbid}`) || data_a.team
          const team_b =
            player_team_by_game.get(`${pid_b}:${esbid}`) || data_b.team

          common_games.push({
            esbid,
            points_a: data_a.points,
            points_b: data_b.points,
            team_a,
            team_b,
            game_info
          })
        }
      }

      if (common_games.length < CORRELATION_THRESHOLDS.MIN_GAMES_FOR_BLENDING) {
        continue
      }

      // Calculate correlation
      const points_a = common_games.map((g) => g.points_a)
      const points_b = common_games.map((g) => g.points_b)

      let corr_value
      try {
        corr_value = sampleCorrelation(points_a, points_b)
      } catch {
        // correlation calculation failed (e.g., zero variance)
        continue
      }

      if (isNaN(corr_value)) {
        continue
      }

      // Determine relationship type
      const first_game = common_games[0]
      let relationship_type
      if (first_game.team_a === first_game.team_b) {
        relationship_type = 'same_team'
      } else {
        // Check if they were in the same NFL game
        const { game_info } = first_game
        if (
          (first_game.team_a === game_info.h ||
            first_game.team_a === game_info.v) &&
          (first_game.team_b === game_info.h ||
            first_game.team_b === game_info.v)
        ) {
          relationship_type = 'cross_team_same_game'
        } else {
          // Different games - skip (independent)
          continue
        }
      }

      // Enforce pid_a < pid_b ordering
      const [ordered_pid_a, ordered_pid_b] =
        pid_a < pid_b ? [pid_a, pid_b] : [pid_b, pid_a]
      const [ordered_team_a, ordered_team_b] =
        pid_a < pid_b
          ? [first_game.team_a, first_game.team_b]
          : [first_game.team_b, first_game.team_a]

      correlations_to_insert.push({
        pid_a: ordered_pid_a,
        pid_b: ordered_pid_b,
        year,
        team_a: ordered_team_a,
        team_b: ordered_team_b,
        games_together: common_games.length,
        correlation: corr_value.toFixed(4),
        relationship_type,
        calculated_at: new Date()
      })
    }

    if (i % 100 === 0) {
      log(
        `Processed ${i}/${player_ids.length} players, ${correlations_to_insert.length} correlations so far`
      )
    }
  }

  log(`Inserting ${correlations_to_insert.length} correlations`)

  // Insert in batches
  if (correlations_to_insert.length > 0) {
    await batch_insert({
      items: correlations_to_insert,
      batch_size: 1000,
      save: async (batch) => {
        await db('player_pair_correlations')
          .insert(batch)
          .onConflict(['pid_a', 'pid_b', 'year'])
          .merge()
      }
    })
  }

  log(`Completed: inserted ${correlations_to_insert.length} correlations`)
  return correlations_to_insert.length
}

const main = async () => {
  let error
  try {
    const year = argv.year || current_season.year - 1
    const scoring_format_hash = argv.scoring_format_hash

    if (!scoring_format_hash) {
      // Get default scoring format from league 1
      const league = await db('seasons').where({ lid: 1 }).first()
      if (league) {
        await calculate_player_correlations({
          year,
          scoring_format_hash: league.scoring_format_hash
        })
      } else {
        throw new Error('No scoring_format_hash provided and no default found')
      }
    } else {
      await calculate_player_correlations({ year, scoring_format_hash })
    }
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.CALCULATE_PLAYER_CORRELATIONS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_player_correlations
