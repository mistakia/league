import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { sum, groupBy, calculatePrices } from '#libs-shared'
import { current_season } from '#constants'
import { is_main, getLeague } from '#libs-server'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('generate-league-format-player-seasonlogs')
debug.enable('generate-league-format-player-seasonlogs')

const generate_league_format_player_seasonlogs = async ({
  year = current_season.year,
  league_format_id,
  dry = false
}) => {
  if (!league_format_id) {
    throw new Error('league_format_id required')
  }
  log(
    `generating player seasonlogs for league_format ${league_format_id} in ${year}`
  )
  const league_format = await db('league_formats')
    .where({ id: league_format_id })
    .first()

  if (!league_format) {
    throw new Error(`league_format ${league_format_id} not found`)
  }

  // get league player gamelogs for season
  const gamelogs = await db('league_format_player_gamelogs')
    .select('league_format_player_gamelogs.*', 'player.primary_position')
    .join('player', 'player.pid', 'league_format_player_gamelogs.pid')
    .join('nfl_games', 'league_format_player_gamelogs.esbid', 'nfl_games.esbid')
    .where({
      'nfl_games.season_year': year,
      'nfl_games.season_type': 'REG',
      'league_format_player_gamelogs.league_format_id': league_format_id
    })

  log(`loaded ${gamelogs.length} gamelogs`)

  const inserts = []

  const pids = [...new Set(gamelogs.map((g) => g.pid))]
  for (const pid of pids) {
    // get gamelogs for pid
    const player_gamelogs = gamelogs.filter((g) => g.pid === pid)
    const pos = player_gamelogs[0].primary_position

    const games = player_gamelogs.length
    const points_added_earned = sum(
      player_gamelogs.map((g) => g.points_added_earned)
    )
    const points_added_net = sum(player_gamelogs.map((g) => g.points_added_net))

    // process / create inserts
    inserts.push({
      pid,
      year,
      league_format_id,
      pos,
      points_added_earned,
      points_added_earned_per_game: points_added_earned / games,
      points_added_net,
      points_added_net_per_game: points_added_net / games,
      startable_games: player_gamelogs.filter((p) => p.points_added_earned > 0)
        .length
    })
  }

  const seasons_by_pos = groupBy(inserts, 'pos')
  const sorted_by_points_added_earned_by_pos = {}
  const sorted_by_points_added_earned_per_game_by_pos = {}
  for (const pos in seasons_by_pos) {
    sorted_by_points_added_earned_by_pos[pos] = seasons_by_pos[pos]
      .map((i) => i.points_added_earned)
      .sort((a, b) => b - a)
    sorted_by_points_added_earned_per_game_by_pos[pos] = seasons_by_pos[pos]
      .map((i) => i.points_added_earned_per_game)
      .sort((a, b) => b - a)
  }

  const sorted_by_points_added_earned = inserts
    .map((i) => i.points_added_earned)
    .sort((a, b) => b - a)
  const sorted_by_points_added_earned_per_game = inserts
    .map((i) => i.points_added_earned_per_game)
    .sort((a, b) => b - a)

  // Calculate total points added for the season
  const total_points_added_earned = sum(
    inserts.map((i) => i.points_added_earned)
  )

  // earned_salary is the realized-season half of the SAME points-added-to-cap-
  // dollars arithmetic the forward path prices market_salary with, so it runs
  // through calculatePrices rather than open-coding a second rate. This file
  // used to derive its own, over the FULL cap rather than the discretionary
  // one, which priced identical points added ~8% higher on the seven formats
  // carrying min_bid = 1 and agreed with the shipped arithmetic only on the
  // eight where min_bid = 0 -- genesis_10_team among them, so the format anyone
  // would test against was the one that hid it.
  //
  // calculatePrices reads pts_added[week] and writes market_salary[week], and
  // its week parameter is an aggregation key rather than a week number, so the
  // season aggregate is passed as 'earned' exactly as calculate-points-added.mjs
  // passes it for the realized season.
  for (const insert of inserts) {
    insert.pts_added = { earned: insert.points_added_earned }
  }
  calculatePrices({
    league_format,
    total_pts_added: total_points_added_earned,
    players: inserts,
    week: 'earned'
  })

  for (const insert of inserts) {
    insert.points_added_earned_rank =
      sorted_by_points_added_earned.indexOf(insert.points_added_earned) + 1
    insert.points_added_earned_position_rank =
      sorted_by_points_added_earned_by_pos[insert.pos].indexOf(
        insert.points_added_earned
      ) + 1
    insert.points_added_earned_per_game_rank =
      sorted_by_points_added_earned_per_game.indexOf(
        insert.points_added_earned_per_game
      ) + 1
    insert.points_added_earned_per_game_position_rank =
      sorted_by_points_added_earned_per_game_by_pos[insert.pos].indexOf(
        insert.points_added_earned_per_game
      ) + 1

    // A dfs_fixed format publishes per-player salaries externally, so
    // calculatePrices declines to price it and earned_salary is null rather
    // than a number derived from a contest-entry cap.
    insert.earned_salary = insert.market_salary?.earned ?? null

    delete insert.pos
    delete insert.pts_added
    delete insert.market_salary
    delete insert.salary_adj_pts_added
  }

  // Output oracles. Both numbers are already computed above; asserting on them
  // is what separates a run that did nothing from a run that had nothing to do.
  // Scoped to the SELECTION count rather than fired unconditionally, so a year
  // the caller legitimately has no gamelogs for stays quiet.
  if (gamelogs.length && !inserts.length) {
    throw new Error(
      `league_format ${league_format_id} ${year}: loaded ${gamelogs.length} gamelogs and produced 0 seasonlogs`
    )
  }

  // An auction format must come out priced. Only a dfs_fixed format may be
  // entirely unpriced, and it must be entirely so rather than partly. Without
  // this, calculatePrices silently declining an auction format -- a bad
  // pricing_model, a zero denominator -- would blank earned_salary across the
  // whole format and read as a clean run.
  const priced_count = inserts.filter((i) => i.earned_salary !== null).length
  const pricing_model = league_format.pricing_model || 'auction'
  if (pricing_model === 'auction' && inserts.length && !priced_count) {
    throw new Error(
      `league_format ${league_format_id} ${year}: pricing_model is auction but 0 of ${inserts.length} seasonlogs are priced`
    )
  }
  if (pricing_model !== 'auction' && priced_count) {
    throw new Error(
      `league_format ${league_format_id} ${year}: pricing_model is ${pricing_model} but ${priced_count} seasonlogs carry a salary`
    )
  }
  log(
    `${inserts.length} seasonlogs, ${priced_count} priced (pricing_model=${pricing_model})`
  )

  if (dry) {
    // Shuffle the inserts array to get random elements
    const shuffled_inserts = inserts.sort(() => 0.5 - Math.random())

    // Select 10 random inserts or all if less than 10
    const random_inserts = shuffled_inserts.slice(0, 10)

    log('10 Random Inserts:')
    for (const insert of random_inserts) {
      log(insert)
    }
    return
  }

  // save inserts
  if (inserts.length) {
    const pids = inserts.map((p) => p.pid)
    const deleted_count = await db('league_format_player_seasonlogs')
      .where({ league_format_id, year })
      .whereNotIn('pid', pids)
      .del()
    log(`Deleted ${deleted_count} excess player seasonlogs`)

    log(`Updating ${inserts.length} player regular seasons`)
    await db('league_format_player_seasonlogs')
      .insert(inserts)
      .onConflict(['pid', 'year', 'league_format_id'])
      .merge()
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    // Use CLI argument if provided, otherwise fall back to league lookup
    let league_format_id = argv.league_format_id

    if (!league_format_id) {
      const lid = argv.lid || 1
      const league = await getLeague({ lid })
      league_format_id = league.league_format_id
    }

    await handle_season_args_for_script({
      argv,
      script_name: 'generate-league-format-player-seasonlogs',
      script_function: generate_league_format_player_seasonlogs,
      year_query: ({ seas_type = 'REG' }) =>
        db('league_format_player_gamelogs')
          .join(
            'nfl_games',
            'nfl_games.esbid',
            'league_format_player_gamelogs.esbid'
          )
          .select('nfl_games.season_year as year')
          .where('nfl_games.season_type', seas_type)
          .where(
            'league_format_player_gamelogs.league_format_id',
            league_format_id
          )
          .groupBy('nfl_games.season_year')
          .orderBy('nfl_games.season_year', 'asc'),
      script_args: { league_format_id, dry: argv.dry },
      season_only: true // This script processes entire seasons, not individual weeks
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_league_format_player_seasonlogs
