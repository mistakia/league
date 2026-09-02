import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { sum, groupBy, calculatePrices } from '#libs-shared'
import { current_season } from '#constants'
import { is_main, getLeague } from '#libs-server'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('generate-league-format-player-seasonlogs')
enable_debug_namespaces('generate-league-format-player-seasonlogs')

const generate_league_format_player_seasonlogs = async ({
  season_year = current_season.year,
  league_format_id,
  dry = false
}) => {
  if (!league_format_id) {
    throw new Error('league_format_id required')
  }
  log(
    `generating player seasonlogs for league_format ${league_format_id} in ${season_year}`
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
      'nfl_games.season_year': season_year,
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
      season_year,
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

  // Rank every metric overall and within position. The net variant carries the
  // same four ranks the earned side always had -- it was ranked nowhere at all
  // while it was also priced nowhere, and the two omissions had the same cause.
  //
  // `indexOf` into a descending sort gives tied values the same rank, which is
  // the behaviour the earned side has always had and is preserved deliberately.
  const seasons_by_pos = groupBy(inserts, 'pos')
  const ranked_metrics = [
    'points_added_earned',
    'points_added_earned_per_game',
    'points_added_net',
    'points_added_net_per_game'
  ]
  for (const metric of ranked_metrics) {
    const sorted_overall = inserts.map((i) => i[metric]).sort((a, b) => b - a)
    const sorted_by_pos = {}
    for (const pos in seasons_by_pos) {
      sorted_by_pos[pos] = seasons_by_pos[pos]
        .map((i) => i[metric])
        .sort((a, b) => b - a)
    }

    for (const insert of inserts) {
      insert[`${metric}_rank`] = sorted_overall.indexOf(insert[metric]) + 1
      insert[`${metric}_position_rank`] =
        sorted_by_pos[insert.pos].indexOf(insert[metric]) + 1
    }
  }

  // The realized-season half of the SAME points-added-to-cap-dollars arithmetic
  // the forward path prices market_salary with, so it runs through
  // calculatePrices rather than open-coding a second rate. This file used to
  // derive its own, over the FULL cap rather than the discretionary one, which
  // priced identical points added ~8% higher on the seven formats carrying
  // min_bid = 1 and agreed with the shipped arithmetic only on the eight where
  // min_bid = 0 -- genesis_10_team among them, so the format anyone would test
  // against was the one that hid it.
  //
  // calculatePrices reads pts_added[aggregate_key] and writes
  // market_salary[aggregate_key], and the key is an aggregation key rather than
  // a week number, so each season aggregate is passed by name.
  //
  // BOTH variants are priced. The denominator is derived per aggregate inside
  // calculatePrices as the sum of that aggregate's own positive parts, which is
  // what makes the net call safe: points_added_net is signed and sums negative
  // across the board, so a raw-total denominator would floor the whole net
  // board to $0 with no error and no failing test.
  for (const insert of inserts) {
    insert.pts_added = {
      earned: insert.points_added_earned,
      net: insert.points_added_net
    }
  }
  calculatePrices({ league_format, players: inserts, aggregate_key: 'earned' })
  calculatePrices({ league_format, players: inserts, aggregate_key: 'net' })

  for (const insert of inserts) {
    // A dfs_fixed format publishes per-player salaries externally, so
    // calculatePrices declines to price it and both salaries are null rather
    // than numbers derived from a contest-entry cap.
    insert.earned_salary = insert.market_salary?.earned ?? null
    insert.points_added_net_cap_dollars = insert.market_salary?.net ?? null

    delete insert.pos
    delete insert.pts_added
    delete insert.market_salary
    delete insert.projected_points_added_positive_including_cap_savings
  }

  // Output oracles. Both numbers are already computed above; asserting on them
  // is what separates a run that did nothing from a run that had nothing to do.
  // Scoped to the SELECTION count rather than fired unconditionally, so a year
  // the caller legitimately has no gamelogs for stays quiet.
  if (gamelogs.length && !inserts.length) {
    throw new Error(
      `league_format ${league_format_id} ${season_year}: loaded ${gamelogs.length} gamelogs and produced 0 seasonlogs`
    )
  }

  // An auction format must come out priced, on BOTH variants. Only a dfs_fixed
  // format may be entirely unpriced, and it must be entirely so rather than
  // partly. Without this, calculatePrices silently declining an auction format
  // -- a bad pricing_model, a zero denominator -- would blank a whole format's
  // salaries and read as a clean run.
  //
  // The net arm is the one that matters going forward: the net variant was
  // computed and persisted for months with no salary at all, and nothing here
  // would have said so. An oracle that covers only the variant someone
  // remembered to price is how the omission stayed invisible.
  const pricing_model = league_format.pricing_model || 'auction'
  const priced_counts = {
    earned_salary: inserts.filter((i) => i.earned_salary !== null).length,
    points_added_net_cap_dollars: inserts.filter(
      (i) => i.points_added_net_cap_dollars !== null
    ).length
  }
  for (const [column, priced_count] of Object.entries(priced_counts)) {
    if (pricing_model === 'auction' && inserts.length && !priced_count) {
      throw new Error(
        `league_format ${league_format_id} ${season_year}: pricing_model is auction but 0 of ${inserts.length} seasonlogs carry ${column}`
      )
    }
    if (pricing_model !== 'auction' && priced_count) {
      throw new Error(
        `league_format ${league_format_id} ${season_year}: pricing_model is ${pricing_model} but ${priced_count} seasonlogs carry ${column}`
      )
    }
  }
  log(
    `${inserts.length} seasonlogs, ${priced_counts.earned_salary} earned / ${priced_counts.points_added_net_cap_dollars} net priced (pricing_model=${pricing_model})`
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
      .where({ league_format_id, season_year })
      .whereNotIn('pid', pids)
      .del()
    log(`Deleted ${deleted_count} excess player seasonlogs`)

    log(`Updating ${inserts.length} player regular seasons`)
    await db('league_format_player_seasonlogs')
      .insert(inserts)
      .onConflict(['pid', 'season_year', 'league_format_id'])
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
      year_query: ({ season_type = 'REG' }) =>
        db('league_format_player_gamelogs')
          .join(
            'nfl_games',
            'nfl_games.esbid',
            'league_format_player_gamelogs.esbid'
          )
          .select('nfl_games.season_year')
          .where('nfl_games.season_type', season_type)
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

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_league_format_player_seasonlogs
