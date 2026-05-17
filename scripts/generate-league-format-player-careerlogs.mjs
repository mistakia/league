import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { sum, groupBy } from '#libs-shared'
import { fantasy_positions } from '#constants'
import { is_main, getLeague, batch_insert } from '#libs-server'
// import { job_types } from '#libs-shared/job-.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('generate-league-format-player-careerlogs')
debug.enable('generate-league-format-player-careerlogs')

const generate_league_format_player_careerlogs = async ({
  league_format_hash,
  dry = false
} = {}) => {
  if (!league_format_hash) {
    throw new Error('missing league_format_hash')
  }

  log(`generating league_format_player_careerlogs for ${league_format_hash}`)

  const inserts = []

  const player_seasons = await db('league_format_player_seasonlogs').where({
    league_format_hash
  })

  // Partial-backfill guard: abort if any seasonlog row has the earned column
  // populated but the net column NULL. Without this guard, the net sum would
  // silently treat missing rows as zero and persist understated career totals
  // that survive future re-derivations.
  const partial_backfill_count = player_seasons.filter(
    (s) => s.points_added_earned !== null && s.points_added_net === null
  ).length
  if (partial_backfill_count > 0) {
    throw new Error(
      `cannot generate careerlogs for ${league_format_hash}: ${partial_backfill_count} seasonlog rows have points_added_earned populated but points_added_net NULL. Re-run the seasonlog generator first.`
    )
  }

  const seasons_by_pid = groupBy(player_seasons, 'pid')
  const pids = Object.keys(seasons_by_pid)

  // Active-game counts per pid: each row in league_format_player_gamelogs is
  // a game the player produced a player_gamelogs entry for (i.e. was active).
  // The seasonlog table has no `games` column, so career totals must come from
  // the gamelog source. REG-only matches the upstream scope.
  const game_count_rows = await db('league_format_player_gamelogs as g')
    .join('nfl_games as ng', 'ng.esbid', 'g.esbid')
    .where('g.league_format_hash', league_format_hash)
    .where('ng.seas_type', 'REG')
    .select('g.pid')
    .count('* as games')
    .groupBy('g.pid')
  const games_by_pid = game_count_rows.reduce((acc, row) => {
    acc[row.pid] = Number(row.games)
    return acc
  }, {})
  const draft_classes_query = await db('player')
    .select('nfl_draft_year', 'pid', 'dpos')
    .whereIn('pos', fantasy_positions)
    .whereIn('pid', pids)
  const draft_classes = draft_classes_query.map((i) => i.nfl_draft_year)
  const sorted_pids_by_draft_classes = {}
  for (const draft_class of draft_classes) {
    const players = draft_classes_query.filter(
      (i) => i.nfl_draft_year === draft_class && i.dpos
    )
    sorted_pids_by_draft_classes[draft_class] = players
      .sort((a, b) => a.dpos - b.dpos)
      .map((i) => i.pid)

    // TODO have a rank based on adp instead of draft position
  }

  for (const pid in seasons_by_pid) {
    const draft_class = draft_classes_query.find(
      (i) => i.pid === pid
    ).nfl_draft_year
    const seasons = seasons_by_pid[pid]

    const sorted = seasons.sort((a, b) => a.year - b.year)
    const first_three_seasons = sorted.slice(0, 3)
    const first_four_seasons = sorted.slice(0, 4)
    const first_five_seasons = sorted.slice(0, 5)
    const first_season = sorted.slice(0, 1)
    const second_season = sorted.slice(1, 2)
    const third_season = sorted.slice(2, 3)

    const points_added_earned = sum(seasons.map((s) => s.points_added_earned))
    const net_of = (s) => s.points_added_net ?? 0
    const points_added_net = sum(seasons.map(net_of))
    const games = games_by_pid[pid] || 0
    const startable_games = sum(seasons.map((s) => s.startable_games))

    const draft_rank =
      sorted_pids_by_draft_classes[draft_class].indexOf(pid) + 1

    inserts.push({
      pid,
      league_format_hash,

      draft_rank,

      startable_games,
      points_added_earned,
      points_added_earned_per_game: games ? points_added_earned / games : null,
      points_added_net,
      points_added_net_per_game: games ? points_added_net / games : null,
      best_season_points_added_earned_per_game: Math.max(
        ...seasons.map((s) => s.points_added_earned_per_game ?? 0)
      ),
      best_season_points_added_net_per_game: Math.max(
        ...seasons.map((s) => s.points_added_net_per_game ?? 0)
      ),
      best_season_earned_salary: Math.max(
        ...seasons.map((s) => s.earned_salary)
      ),
      points_added_earned_first_three_seasons: sum(
        first_three_seasons.map((s) => s.points_added_earned)
      ),
      points_added_earned_first_four_seasons: sum(
        first_four_seasons.map((s) => s.points_added_earned)
      ),
      points_added_earned_first_five_seasons: sum(
        first_five_seasons.map((s) => s.points_added_earned)
      ),
      points_added_earned_first_season: sum(
        first_season.map((s) => s.points_added_earned)
      ),
      points_added_earned_second_season: sum(
        second_season.map((s) => s.points_added_earned)
      ),
      points_added_earned_third_season: sum(
        third_season.map((s) => s.points_added_earned)
      ),
      points_added_net_first_three_seasons: sum(
        first_three_seasons.map(net_of)
      ),
      points_added_net_first_four_seasons: sum(first_four_seasons.map(net_of)),
      points_added_net_first_five_seasons: sum(first_five_seasons.map(net_of)),
      points_added_net_first_season: sum(first_season.map(net_of)),
      points_added_net_second_season: sum(second_season.map(net_of)),
      points_added_net_third_season: sum(third_season.map(net_of))
    })
  }

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

  if (inserts.length) {
    const pids = inserts.map((p) => p.pid)
    const deleted_count = await db('league_format_player_careerlogs')
      .where({ league_format_hash })
      .whereNotIn('pid', pids)
      .del()
    log(`Deleted ${deleted_count} excess league player rows`)

    log(
      `updating ${inserts.length} league players for league_format ${league_format_hash}`
    )
    // 23 columns per row * thousands of players exceeds Postgres' 65535
    // bind-parameter wire-protocol limit on a single insert; batch.
    await batch_insert({
      items: inserts,
      save: (items) =>
        db('league_format_player_careerlogs')
          .insert(items)
          .onConflict(['pid', 'league_format_hash'])
          .merge(),
      batch_size: 1000
    })
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    // Use CLI argument if provided, otherwise fall back to league lookup
    let league_format_hash = argv.league_format_hash

    if (!league_format_hash) {
      const lid = argv.lid || 1
      const league = await getLeague({ lid })
      league_format_hash = league.league_format_hash
    }

    await generate_league_format_player_careerlogs({
      league_format_hash,
      dry: argv.dry
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

export default generate_league_format_player_careerlogs
