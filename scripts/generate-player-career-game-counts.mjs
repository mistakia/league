import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, batch_insert } from '#libs-server'
import { career_year_from_distinct_prior_reg_seasons } from '#libs-shared/career-year-definition.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
// import { job_types } from '#libs-shared/job-.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-player-career-game-counts')
enable_debug_namespaces('generate-player-career-game-counts')

const generate_player_career_game_counts = async () => {
  const years = await db('nfl_games')
    .distinct('season_year')
    .whereIn('season_type', ['REG', 'POST'])
    .orderBy('season_year', 'asc')

  const player_career_games = {}
  const player_career_years = {}

  let total_game_updates = 0
  let total_season_updates = 0

  const seas_type_order = { REG: 0, POST: 1 }

  for (const { season_year } of years) {
    const rows = await db('player_gamelogs')
      .select(
        'player_gamelogs.pid',
        'player_gamelogs.esbid',
        'player_gamelogs.opponent_nfl_team',
        'player_gamelogs.nfl_team',
        'player_gamelogs.player_position',
        'nfl_games.season_year',
        'nfl_games.week',
        'nfl_games.season_type'
      )
      .innerJoin('nfl_games', function () {
        this.on('nfl_games.esbid', '=', 'player_gamelogs.esbid').andOn(
          'nfl_games.season_year',
          '=',
          'player_gamelogs.season_year'
        )
      })
      .where({ 'nfl_games.season_year': season_year })
      .whereIn('nfl_games.season_type', ['REG', 'POST'])

    log(
      `processing year ${season_year}: loaded ${rows.length} player games (excluding preseason)`
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
          (seas_type_order[a.season_type] ?? 0) -
          (seas_type_order[b.season_type] ?? 0)
        if (seas_cmp !== 0) return seas_cmp
        return a.week - b.week
      })

      // Declared career_year for this (pid, season_year): distinct REG seasons
      // the player has played before this season, plus one (single definition,
      // libs-shared/career-year-definition.mjs). Computed once per season so
      // every seasonlog row of the season -- PRE, REG or POST -- carries the
      // same value.
      const season_career_year = career_year_from_distinct_prior_reg_seasons(
        player_career_years[pid].size
      )

      for (const game of games) {
        player_career_games[pid]++

        game_updates.push({
          pid: game.pid,
          esbid: game.esbid,
          opponent_nfl_team: game.opponent_nfl_team,
          nfl_team: game.nfl_team,
          player_position: game.player_position,
          season_year: game.season_year,
          career_game: player_career_games[pid]
        })

        const season_key = `${game.pid}_${game.season_year}_${game.season_type}`
        if (!season_updates[season_key]) {
          season_updates[season_key] = {
            pid: game.pid,
            season_year: game.season_year,
            career_year: season_career_year,
            season_type: game.season_type
          }
        }

        // Only a REG game marks this season in the career set; a POST-only or
        // PRE-only season is not counted, matching the declared definition
        // (career_year = distinct REG seasons < season_year + 1).
        if (game.season_type === 'REG') {
          player_career_years[pid].add(game.season_year)
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
            .onConflict(['season_year', 'esbid', 'pid'])
            .merge(['career_game'])
        },
        batch_size: 1000
      })

      total_game_updates += game_updates.length
      log(
        `updated career game counts for ${game_updates.length} games in ${season_year}`
      )
    }

    if (season_updates_array.length) {
      await batch_insert({
        items: season_updates_array,
        save: async (batch) => {
          await db('player_seasonlogs')
            .insert(batch)
            .onConflict(['pid', 'season_year', 'season_type'])
            .merge(['career_year'])
        },
        batch_size: 500
      })

      total_season_updates += season_updates_array.length
      log(
        `updated career year counts for ${season_updates_array.length} seasons in ${season_year}`
      )
    }
  }

  // Phase 2 -- preseason career_year. The loop above iterates
  // whereIn('nfl_games.season_type', ['REG', 'POST']), so it materializes
  // career_year for REG/POST seasonlog rows only. A PRE row is never touched by
  // it and keeps whatever stale number it was last given (Wheatley Jr inherited
  // his father's; 726 rows still read null/0). Under the single declared
  // definition in libs-shared/career-year-definition.mjs, career_year is a
  // function of season_year alone: a PRE row carries the same value as its
  // season's REG row, and a preseason-only season gets `prior REG seasons + 1`
  // rather than null/0. Set it here from each player's set of REG seasons. The
  // same definition also covers season years with no REG/POST games at all
  // (e.g. the in-progress preseason), which the year loop never reaches.
  const reg_season_years_by_pid = {}
  const reg_career_rows = await db('player_gamelogs')
    .select('player_gamelogs.pid', 'nfl_games.season_year')
    .innerJoin('nfl_games', function () {
      this.on('nfl_games.esbid', '=', 'player_gamelogs.esbid').andOn(
        'nfl_games.season_year',
        '=',
        'player_gamelogs.season_year'
      )
    })
    .where({ 'nfl_games.season_type': 'REG' })

  for (const row of reg_career_rows) {
    if (!reg_season_years_by_pid[row.pid]) {
      reg_season_years_by_pid[row.pid] = new Set()
    }
    reg_season_years_by_pid[row.pid].add(Number(row.season_year))
  }

  const pre_seasonlogs = await db('player_seasonlogs')
    .select('pid', 'season_year')
    .where({ season_type: 'PRE' })

  const pre_updates = []
  for (const { pid, season_year } of pre_seasonlogs) {
    const reg_seasons = reg_season_years_by_pid[pid]
    let prior_reg_seasons = 0
    if (reg_seasons) {
      for (const y of reg_seasons) {
        if (y < season_year) prior_reg_seasons++
      }
    }
    pre_updates.push({
      pid,
      season_year,
      season_type: 'PRE',
      career_year:
        career_year_from_distinct_prior_reg_seasons(prior_reg_seasons)
    })
  }

  if (pre_updates.length) {
    await batch_insert({
      items: pre_updates,
      save: async (batch) => {
        await db('player_seasonlogs')
          .insert(batch)
          .onConflict(['pid', 'season_year', 'season_type'])
          .merge(['career_year'])
      },
      batch_size: 500
    })
    log(`updated career year counts for ${pre_updates.length} PRE season rows`)
  }

  log(
    `totals: updated ${total_game_updates} game rows and ${total_season_updates} season rows, ${pre_updates.length} PRE rows`
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
