import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#libs-shared'
import { is_main, batch_insert } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-player-career-game-counts')
debug.enable('generate-player-career-game-counts')

const generate_player_career_game_counts = async () => {
  const player_gamelogs = await db('player_gamelogs')
    .select(
      'pid',
      'player_gamelogs.esbid',
      'nfl_games.year',
      'opp',
      'tm',
      'pos',
      'nfl_games.date',
      'nfl_games.seas_type'
    )
    .innerJoin('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .whereIn('nfl_games.seas_type', ['REG', 'POST'])  // Exclude preseason games
    .orderBy('date', 'asc')

  log(`loaded ${player_gamelogs.length} player games (excluding preseason)`)

  const player_career_games = {}
  const player_career_years = {}
  const game_updates = []
  const season_updates = {}

  for (const game of player_gamelogs) {
    if (!player_career_games[game.pid]) {
      player_career_games[game.pid] = 0  // Start at 0 so first game becomes 1
      player_career_years[game.pid] = new Set()
    }
    player_career_games[game.pid]++
    player_career_years[game.pid].add(game.year)

    game_updates.push({
      pid: game.pid,
      esbid: game.esbid,
      opp: game.opp,
      tm: game.tm,
      pos: game.pos,
      year: game.year,
      career_game: player_career_games[game.pid]
    })

    // Prepare season updates in the same loop
    const season_key = `${game.pid}_${game.year}_${game.seas_type}`
    if (!season_updates[season_key]) {
      season_updates[season_key] = {
        pid: game.pid,
        year: game.year,
        pos: game.pos,
        career_year: player_career_years[game.pid].size,
        seas_type: game.seas_type
      }
    }
  }

  // Convert season_updates object to array
  const season_updates_array = Object.values(season_updates)

  if (game_updates.length) {
    // Perform bulk upsert for game logs using batch_insert
    await batch_insert({
      items: game_updates,
      save: async (batch) => {
        await db('player_gamelogs')
          .insert(batch)
          .onConflict(['pid', 'esbid', 'year'])
          .merge(['career_game'])
      },
      batch_size: 1000
    })

    log(`Updated career game counts for ${game_updates.length} games`)
  }

  if (season_updates_array.length) {
    await batch_insert({
      items: season_updates_array,
      save: async (batch) => {
        await db('player_seasonlogs')
          .insert(batch)
          .onConflict(['pid', 'year', 'seas_type'])
          .merge(['career_year'])
      },
      batch_size: 500
    })

    log(
      `Updated career year counts and season types for ${season_updates_array.length} seasons`
    )
  }
}

const main = async () => {
  let error
  try {
    await generate_player_career_game_counts()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_player_career_game_counts
