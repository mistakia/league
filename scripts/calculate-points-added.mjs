import debug from 'debug'
import chalk from 'chalk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'

import db from '#db'
import { is_main, getLeague } from '#libs-server'
import {
  sum,
  groupBy,
  getRosterSize,
  calculateValues,
  calculatePrices,
  calculateBaselines
} from '#libs-shared'
import { fantasy_positions } from '#constants'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('calculate-points-added')
debug.enable('calculate-points-added')

const calculate_points_added = async ({
  year,
  rookie,
  league,
  week = 'ALL'
}) => {
  if (!Number.isInteger(year)) {
    throw new Error(`${year} invalid year`)
  }

  const { num_teams, cap, min_bid } = league
  const rosterSize = getRosterSize(league)
  const leagueTotalCap = num_teams * cap - num_teams * rosterSize * min_bid

  log(`calculating Points Added for ${year}`)

  const query = db('scoring_format_player_gamelogs')
    .select(
      'scoring_format_player_gamelogs.pid',
      'scoring_format_player_gamelogs.points',
      'player.short_name',
      // Aliased (not renamed) to `pos`: this row shape flows unmodified into
      // libs-shared/calculate-baselines.mjs + calculate-values.mjs, which are
      // out of scope here and still read `.pos`/`{ pos } = player` as a plain
      // JS property (not a DB read, so the compat view can't shield them).
      // Renaming this key would silently zero out every pts_added calculation.
      // A `primary_position` duplicate is added at push-time below for this
      // file's own (non-libs-shared) reads; drop the `pos` alias + duplicate
      // once calculate-baselines.mjs/calculate-values.mjs are repointed.
      'player.primary_position as pos',
      'player.nfl_draft_year',
      'nfl_games.week',
      'nfl_games.year',
      'nfl_games.esbid'
    )
    .join(
      'nfl_games',
      'nfl_games.esbid',
      'scoring_format_player_gamelogs.esbid'
    )
    .join('player', 'scoring_format_player_gamelogs.pid', 'player.pid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')
    .whereIn('player.primary_position', fantasy_positions) // TODO - filter using player_gamelogs.pos
    .where(
      'scoring_format_player_gamelogs.scoring_format_id',
      league.scoring_format_id
    )

  if (week !== 'ALL') {
    query.where('nfl_games.week', week)
  }

  const rows = await query

  // Fetch pos_rnk from player_seasonlogs in a separate query
  const pos_rnk_query = db('scoring_format_player_seasonlogs')
    .select('pid', 'points_pos_rnk')
    .where('year', year)
    .where('scoring_format_id', league.scoring_format_id)

  const pos_rnk_rows = await pos_rnk_query
  const pos_rnk_map = pos_rnk_rows.reduce((acc, row) => {
    acc[row.pid] = row.points_pos_rnk
    return acc
  }, {})

  const weeks = [...new Set(rows.map((r) => r.week))]
  const grouped_by_pid = groupBy(rows, 'pid')

  const players = []
  for (const pid of Object.keys(grouped_by_pid)) {
    const item = {}
    const games = grouped_by_pid[pid]
    item.games = games

    item.points = {}
    item.pts_added = {}
    item.salary_adj_pts_added = {}
    item.market_salary = {}

    // set default values
    for (const week of weeks) {
      item.points[week] = { total: 0 }
      item.pts_added[week] = -999
      item.salary_adj_pts_added[week] = 0
      item.market_salary[week] = 0
    }

    // get fantasy points from query results
    for (const game of games) {
      item.points[game.week] = { total: game.points }
    }

    const { short_name, pos, nfl_draft_year } = games[0]
    const pos_rnk = pos_rnk_map[pid] || null
    players.push({
      pid,
      short_name,
      pos, // kept for libs-shared/calculate-baselines.mjs + calculate-values.mjs
      primary_position: pos, // this file's own reads use this key
      nfl_draft_year,
      pos_rnk,
      ...item
    })
  }

  log(`calculating Points Added for ${rows.length} players`)

  const baselines = {}
  const baselineTotals = {}
  fantasy_positions.forEach((p) => (baselineTotals[p] = 0))
  for (const week of weeks) {
    const baseline = calculateBaselines({ players, league, week })
    baselines[week] = baseline

    for (const position of fantasy_positions) {
      const p = baseline[position].starter
      baselineTotals[position] += p.points[week].total
      log(
        `Baseline ${position} of week ${week} is ${p.short_name} (${p.primary_position}) with ${p.points[week].total}pts`
      )
    }

    // calculate values
    const total_pts_added = calculateValues({
      players,
      baselines: baseline,
      week
    })
    calculatePrices({ cap: leagueTotalCap, total_pts_added, players, week })
  }

  const points_by_position = {}
  for (const pos of fantasy_positions) {
    points_by_position[pos] = []
  }

  // The -999 sentinel guard applies to BOTH raw_by_week (prevents leak into
  // persisted points_added_net) and earned_net (prevents shifting the aggregate
  // by -999 * weeks_missed).
  let total_pts_added = 0
  for (const player of players) {
    player.pts_added.earned = 0
    let earned_net = 0
    const raw_by_week = {}
    player.starts = 0
    player.points = sum(Object.values(player.points).map((p) => p.total))
    for (const [key, value] of Object.entries(player.pts_added)) {
      const week_number = Number(key)
      if (!Number.isFinite(week_number)) continue
      if (value === -999) continue
      raw_by_week[week_number] = value
      earned_net += value
      if (value > 0) {
        player.starts += 1
        player.pts_added.earned += value
        total_pts_added += value
      }
    }
    player.pts_added.earned_net = earned_net
    player.pts_added_raw_by_week = raw_by_week

    points_by_position[player.primary_position].push(player.points)
  }

  calculatePrices({
    cap: leagueTotalCap,
    total_pts_added,
    players,
    week: 'earned'
  })

  const output = {}
  for (const player of players) {
    output[player.pid] = {
      player: player.short_name,
      rookie: player.nfl_draft_year === year,
      primary_position: player.primary_position,
      pos_rnk: player.pos_rnk,
      pts_added_earned: player.pts_added.earned,
      pts_added_net: player.pts_added.earned_net,
      pts_added_raw_by_week: player.pts_added_raw_by_week,
      value: player.market_salary.earned,
      points: player.points,
      games: player.games,
      starts: player.starts
    }
  }

  if (rookie) {
    for (const pid in players) {
      const isRookie = output[pid].rookie
      if (!isRookie) {
        delete output[pid]
      }
    }
  }

  return { players: output, baselineTotals, weeks: weeks.length }
}

const main = async () => {
  try {
    const argv = initialize_cli()
    const year = argv.year
    const rookie = argv.rookie
    const lid = argv.lid
    const week = argv.week
    if (!lid) {
      console.log('missing --lid')
      return
    }
    const league = await getLeague({ lid })
    const { players, baselineTotals, weeks } = await calculate_points_added({
      year,
      rookie,
      league,
      week
    })
    const top200 = Object.values(players)
      .sort((a, b) => b.pts_added_earned - a.pts_added_earned)
      .slice(0, 200)
    const p = new Table()
    const getColor = (pos) => {
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
    for (const [index, player] of top200.entries()) {
      p.addRow(
        {
          index: index + 1,
          name: player.player,
          pts_added: player.pts_added_earned.toFixed(2),
          points: player.points.toFixed(2),
          rank: `${player.primary_position}${player.pos_rnk}`,
          value: `$${player.value}`,
          rookie: player.rookie ? 'rookie' : '',
          startable: player.starts
        },
        {
          color: getColor(player.primary_position)
        }
      )
    }
    console.log(
      chalk.bold(
        `${year} ${rookie ? 'Rookie ' : ''}Player end-of-season values`
      )
    )
    p.printTable()

    for (const position of fantasy_positions) {
      const total = baselineTotals[position]
      const avg = total / weeks
      log(`${position} baseline per week: ${avg.toFixed(2)}`)
    }
  } catch (e) {
    log(e)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  debug.enable('calculate-points-added')
  main()
}

export default calculate_points_added
