import db from '#db'
import { is_main, getLeague } from '#libs-server'
import { groupBy, calculatePoints } from '#libs-shared'
import { fantasy_positions, stat_countable_play_types } from '#constants'
import chalk from 'chalk'
import { Table } from 'console-table-printer'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import debug from 'debug'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('calculate-points')
// Guarded: a module-scope debug.enable REPLACES the enabled namespace set, and
// ESM evaluates imports before the importing module's body -- so an unguarded
// call here is clobbered by any script that imports this one, taking its own
// logging with it. An explicit DEBUG is authoritative; this stays the default
// for a bare CLI run.
if (!process.env.DEBUG) {
  debug.enable('calculate-points')
}

// Per-play yardage arrays for big-play bonuses.
//
// A `big_play` rule scores per PLAY of at least N yards, which no gamelog
// column can answer -- a gamelog carries game totals. calculatePoints reads the
// arrays off `stats` and degrades to 0 when they are absent, which is what
// projections and live weekly scoring get.
//
// Fetched ONLY when the format carries such a rule, and only for the stats its
// rules actually name, so every existing format pays nothing: no rules, no
// query. That matters because this runs per scoring format over a whole season.
const BIG_PLAY_ROLES = {
  passing_yards: {
    pid_column: 'passer_pid',
    yards_column: 'pass_yards',
    stats_key: 'pass_play_yards'
  },
  rushing_yards: {
    pid_column: 'ball_carrier_pid',
    yards_column: 'rush_yards',
    stats_key: 'rush_play_yards'
  },
  receiving_yards: {
    pid_column: 'target_pid',
    yards_column: 'receiving_yards',
    stats_key: 'recv_play_yards'
  }
}

const load_big_play_yards = async ({ league, year, week }) => {
  const rules = Array.isArray(league.bonuses) ? league.bonuses : []
  const stats_needed = [
    ...new Set(
      rules
        .filter((rule) => rule && rule.type === 'big_play')
        .map((rule) => rule.stat)
    )
  ].filter((stat) => BIG_PLAY_ROLES[stat])

  if (!stats_needed.length) {
    return null
  }

  // Keyed by `${pid}__${esbid}` -- the grain a gamelog row is at, and the grain
  // a big play must be counted within.
  const by_player_game = new Map()

  for (const stat of stats_needed) {
    const { pid_column, yards_column, stats_key } = BIG_PLAY_ROLES[stat]
    const query = db('nfl_plays')
      .select(
        `nfl_plays.${pid_column} as pid`,
        'nfl_plays.esbid',
        db.raw(`array_agg(nfl_plays.${yards_column}) as yards`)
      )
      .join('nfl_games', 'nfl_games.esbid', 'nfl_plays.esbid')
      .where('nfl_games.season_year', year)
      .where('nfl_games.season_type', 'REG')
      .whereIn('nfl_plays.play_type', stat_countable_play_types)
      .whereNotNull(`nfl_plays.${pid_column}`)
      .whereNotNull(`nfl_plays.${yards_column}`)
      .groupBy(`nfl_plays.${pid_column}`, 'nfl_plays.esbid')

    if (week !== 'ALL') {
      query.where('nfl_games.week', week)
    }

    for (const row of await query) {
      const key = `${row.pid}__${row.esbid}`
      if (!by_player_game.has(key)) by_player_game.set(key, {})
      by_player_game.get(key)[stats_key] = row.yards.map(Number)
    }
  }

  log(
    `loaded big-play yardage for ${by_player_game.size} player-games across ${stats_needed.length} stat(s)`
  )
  return by_player_game
}

const calculate_points = async ({
  year,
  lid,
  scoring_format_id,
  week = 'ALL'
}) => {
  if (!Number.isInteger(year)) {
    throw new Error(`${year} invalid year`)
  }

  let league

  if (lid) {
    league = await getLeague(lid)
  } else if (scoring_format_id) {
    league = await db('league_scoring_formats')
      .where('id', scoring_format_id)
      .first()
  }

  if (!league) {
    throw new Error(`${lid} or ${scoring_format_id} is missing or invalid`)
  }

  log(`calculating Points for ${year}`)

  // get player stats for year
  const query = db('player_gamelogs')
    .select(
      'player_gamelogs.*',
      'player.short_name',
      'player.primary_position',
      'player.nfl_draft_year',
      'player_gamelogs.pid',
      'nfl_games.week'
    )
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.season_year', year)
    .where('nfl_games.season_type', 'REG')
    .whereIn('player.primary_position', fantasy_positions)
    .join('player', 'player_gamelogs.pid', 'player.pid')

  if (week !== 'ALL') {
    query.where('nfl_games.week', week)
  }

  const rows = await query
  const big_play_yards = await load_big_play_yards({ league, year, week })
  const weeks = [...new Set(rows.map((r) => r.week))]
  const grouped_by_pid = groupBy(rows, 'pid')

  const players = []
  for (const pid of Object.keys(grouped_by_pid)) {
    const item = {}
    const games = grouped_by_pid[pid]
    item.games = games

    item.points = {}

    // set default values
    for (const week of weeks) {
      item.points[week] = { total: 0 }
    }

    // calculate fantasy points
    for (const game of games) {
      // Spread rather than mutate: `game` is also pushed onto item.games and
      // read by the caller that builds the insert rows.
      const play_yards = big_play_yards
        ? big_play_yards.get(`${pid}__${game.esbid}`)
        : null
      const points = calculatePoints({
        stats: play_yards ? { ...game, ...play_yards } : game,
        position: game.primary_position,
        league
      })
      item.points[game.week] = points
    }

    const { short_name, primary_position, nfl_draft_year } = games[0]
    players.push({ pid, short_name, primary_position, nfl_draft_year, ...item })
  }

  const points_by_position = {}
  for (const pos of fantasy_positions) {
    points_by_position[pos] = []
  }

  for (const player of players) {
    player.total_points = Object.values(player.points).reduce(
      (sum, p) => sum + p.total,
      0
    )
    points_by_position[player.primary_position].push(player.total_points)
  }

  for (const pos of fantasy_positions) {
    points_by_position[pos] = points_by_position[pos].sort((a, b) => b - a)
  }

  log(`calculated Points for ${rows.length} players`)

  const output = {}
  for (const player of players) {
    output[player.pid] = {
      player: player.short_name,
      rookie: player.nfl_draft_year === year,
      position_rank:
        points_by_position[player.primary_position].indexOf(
          player.total_points
        ) + 1,
      primary_position: player.primary_position,
      points: player.total_points,
      games: player.games
    }
  }

  return { players: output, weeks: weeks.length }
}

const main = async () => {
  try {
    const argv = initialize_cli()
    const result = await calculate_points({
      year: argv.year,
      lid: argv.lid,
      scoring_format_id: argv.scoring_format_id,
      week: argv.week
    })

    const top_200 = Object.values(result.players)
      .sort((a, b) => b.points - a.points)
      .slice(0, 200)

    const table = new Table()

    const get_color = (pos) => {
      switch (pos) {
        case 'QB':
          return 'red'
        case 'RB':
          return 'green'
        case 'WR':
          return 'white'
        case 'TE':
          return 'cyan'
      }
    }

    for (const [index, player] of top_200.entries()) {
      table.addRow(
        {
          index: index + 1,
          name: player.player,
          points: player.points.toFixed(2),
          pos: player.primary_position,
          rookie: player.rookie ? 'rookie' : '',
          games: player.games.length
        },
        {
          color: get_color(player.primary_position)
        }
      )
    }

    console.log(
      chalk.bold(`${argv.year} Player Points (${result.weeks} weeks)`)
    )
    table.printTable()
  } catch (e) {
    log(e)
  }

  process.exit()
}

// If this script is run directly, execute the main function
if (is_main(import.meta.url)) {
  debug.enable('calculate-points')
  main()
}

export default calculate_points
