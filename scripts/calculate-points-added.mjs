import debug from 'debug'
import chalk from 'chalk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'

import db from '#db'
import { isMain, getLeague } from '#libs-server'
import {
  sum,
  constants,
  groupBy,
  getRosterSize,
  calculateValues,
  calculatePrices,
  calculateBaselines
} from '#libs-shared'

const argv = yargs(hideBin(process.argv)).argv
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
      'player.pname',
      'player.pos',
      'player.start',
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
    .whereIn('player.pos', constants.positions) // TODO - filter using player_gamelogs.pos
    .where(
      'scoring_format_player_gamelogs.scoring_format_hash',
      league.scoring_format_hash
    )

  if (week !== 'ALL') {
    query.where('nfl_games.week', week)
  }

  const rows = await query

  // Fetch pos_rnk from player_seasonlogs in a separate query
  const pos_rnk_query = db('scoring_format_player_seasonlogs')
    .select('pid', 'points_pos_rnk')
    .where('year', year)
    .where('scoring_format_hash', league.scoring_format_hash)

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

    const { pname, pos, start } = games[0]
    const pos_rnk = pos_rnk_map[pid] || null
    players.push({ pid, pname, pos, start, pos_rnk, ...item })
  }

  log(`calculating Points Added for ${rows.length} players`)

  const baselines = {}
  const baselineTotals = {}
  constants.positions.forEach((p) => (baselineTotals[p] = 0))
  for (const week of weeks) {
    const baseline = calculateBaselines({ players, league, week })
    baselines[week] = baseline

    for (const position of constants.positions) {
      const p = baseline[position].starter
      baselineTotals[position] += p.points[week].total
      log(
        `Baseline ${position} of week ${week} is ${p.pname} (${p.pos}) with ${p.points[week].total}pts`
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
  for (const pos of constants.positions) {
    points_by_position[pos] = []
  }

  // calculate earned contract value
  let total_pts_added = 0
  for (const player of players) {
    player.pts_added.earned = 0
    player.starts = Object.values(player.pts_added).filter((v) => v > 0).length
    player.points = sum(Object.values(player.points).map((p) => p.total))
    for (const value of Object.values(player.pts_added)) {
      if (value <= 0) {
        continue
      }

      player.pts_added.earned += value
      total_pts_added += value
    }

    points_by_position[player.pos].push(player.points)
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
      player: player.pname,
      rookie: player.start === year,
      pos: player.pos,
      pos_rnk: player.pos_rnk,
      pts_added: player.pts_added.earned,
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
      .sort((a, b) => b.pts_added - a.pts_added)
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
          pts_added: player.pts_added.toFixed(2),
          points: player.points.toFixed(2),
          rank: `${player.pos}${player.pos_rnk}`,
          value: `$${player.value}`,
          rookie: player.rookie ? 'rookie' : '',
          startable: player.starts
        },
        {
          color: getColor(player.pos)
        }
      )
    }
    console.log(
      chalk.bold(
        `${year} ${rookie ? 'Rookie ' : ''}Player end-of-season values`
      )
    )
    p.printTable()

    for (const position of constants.positions) {
      const total = baselineTotals[position]
      const avg = total / weeks
      log(`${position} baseline per week: ${avg.toFixed(2)}`)
    }
  } catch (e) {
    log(e)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  debug.enable('calculate-points-added')
  main()
}

export default calculate_points_added
