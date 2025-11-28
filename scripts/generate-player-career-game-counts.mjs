import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, batch_insert } from '#libs-server'
// import { job_types } from '#libs-shared/job-.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-player-career-game-counts')
debug.enable('generate-player-career-game-counts')

const generate_player_career_game_counts = async () => {
  const years = await db('nfl_games')
    .distinct('year')
    .whereIn('seas_type', ['REG', 'POST'])
    .orderBy('year', 'asc')

  const player_career_games = {}
  const player_career_years = {}

  let total_game_updates = 0
  let total_season_updates = 0

  const seas_type_order = { REG: 0, POST: 1 }

  for (const { year } of years) {
    const rows = await db('player_gamelogs')
      .select(
        'player_gamelogs.pid',
        'player_gamelogs.esbid',
        'player_gamelogs.opp',
        'player_gamelogs.tm',
        'player_gamelogs.pos',
        'nfl_games.year',
        'nfl_games.week',
        'nfl_games.seas_type'
      )
      .innerJoin('nfl_games', function () {
        this.on('nfl_games.esbid', '=', 'player_gamelogs.esbid').andOn(
          'nfl_games.year',
          '=',
          'player_gamelogs.year'
        )
      })
      .where({ 'nfl_games.year': year })
      .whereIn('nfl_games.seas_type', ['REG', 'POST'])

    log(
      `processing year ${year}: loaded ${rows.length} player games (excluding preseason)`
    )

    const pid_to_rows = {}
    for (const row of rows) {
      if (!pid_to_rows[row.pid]) pid_to_rows[row.pid] = []
      pid_to_rows[row.pid].push(row)
    }

    const game_updates = []
    const season_updates = {}

    for (const pid of Object.keys(pid_to_rows)) {
      if (!player_career_games[pid]) {
        player_career_games[pid] = 0
        player_career_years[pid] = new Set()
      }

      const games = pid_to_rows[pid]
      games.sort((a, b) => {
        const seas_cmp =
          (seas_type_order[a.seas_type] ?? 0) -
          (seas_type_order[b.seas_type] ?? 0)
        if (seas_cmp !== 0) return seas_cmp
        return a.week - b.week
      })

      for (const game of games) {
        player_career_games[pid]++
        player_career_years[pid].add(game.year)

        game_updates.push({
          pid: game.pid,
          esbid: game.esbid,
          opp: game.opp,
          tm: game.tm,
          pos: game.pos,
          year: game.year,
          career_game: player_career_games[pid]
        })

        const season_key = `${game.pid}_${game.year}_${game.seas_type}`
        if (!season_updates[season_key]) {
          season_updates[season_key] = {
            pid: game.pid,
            year: game.year,
            pos: game.pos,
            career_year: player_career_years[pid].size,
            seas_type: game.seas_type
          }
        }
      }
    }

    const season_updates_array = Object.values(season_updates)

    if (game_updates.length) {
      await batch_insert({
        items: game_updates,
        save: async (batch) => {
          await db('player_gamelogs')
            .insert(batch)
            .onConflict(['year', 'esbid', 'pid'])
            .merge(['career_game'])
        },
        batch_size: 1000
      })

      total_game_updates += game_updates.length
      log(
        `updated career game counts for ${game_updates.length} games in ${year}`
      )
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

      total_season_updates += season_updates_array.length
      log(
        `updated career year counts for ${season_updates_array.length} seasons in ${year}`
      )
    }
  }

  log(
    `totals: updated ${total_game_updates} game rows and ${total_season_updates} season rows`
  )
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
