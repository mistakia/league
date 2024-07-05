import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, batch_insert } from '#libs-server'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-player-career-game-counts')
debug.enable('generate-player-career-game-counts')

const generate_player_career_game_counts = async () => {
  const player_gamelogs = await db('player_gamelogs')
    .select('pid', 'esbid', 'year', 'nfl_games.date')
    .leftJoin('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .orderBy('date', 'asc')

  const player_career_games = {}
  const player_career_years = {}
  const game_updates = []
  const season_updates = []

  for (const game of player_gamelogs) {
    if (!player_career_games[game.pid]) {
      player_career_games[game.pid] = 0
      player_career_years[game.pid] = new Set()
    }
    player_career_games[game.pid]++
    player_career_years[game.pid].add(game.year)

    game_updates.push({
      pid: game.pid,
      esbid: game.esbid,
      career_game: player_career_games[game.pid]
    })
  }

  for (const pid of Object.keys(player_career_years)) {
    const sorted_years = Array.from(player_career_years[pid]).sort()
    for (let i = 0; i < sorted_years.length; i++) {
      const year = sorted_years[i]
      season_updates.push({
        pid,
        year,
        career_year: i + 1
      })
    }
  }

  if (game_updates.length) {
    // Perform bulk upsert for game logs using batch_insert
    await batch_insert({
      items: game_updates,
      save: async (batch) => {
        await db('player_gamelogs')
          .insert(batch)
          .onConflict(['pid', 'esbid'])
          .merge(['career_game'])
      },
      batch_size: 1000
    })

    log(`Updated career game counts for ${game_updates.length} games`)
  }

  if (season_updates.length) {
    // Perform bulk upsert for season logs
    await batch_insert({
      items: season_updates,
      save: async (batch) => {
        await db('player_seasonlogs')
          .insert(batch)
          .onConflict(['pid', 'year'])
          .merge(['career_year'])
      },
      batch_size: 1000
    })

    log(`Updated career year counts for ${season_updates.length} seasons`)
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

  await db('jobs').insert({
    type: constants.jobs.EXAMPLE,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default generate_player_career_game_counts
