import {
  calculateStatsFromPlays,
  groupBy,
  uniqBy,
  constants,
  calculatePercentiles,
  calculatePoints,
  calculateBaselines,
  calculateValues,
  calculatePrices,
  getRosterSize,
  getOptimizerPositionConstraints,
  optimizeLineup,
  calculatePlayerValuesRestOfSeason
} from '@common'
import solver from 'javascript-lp-solver'

export function workerOptimizeLineup(params) {
  return optimizeLineup(params)
}

export function workerCalculateStatsFromPlays({ plays, qualifiers, league }) {
  const players = calculateStatsFromPlays(plays)
  const percentiles = calculatePercentiles({
    items: Object.values(players),
    stats: constants.fullStats,
    qualifiers,
    prefix: 'stats.'
  })

  // TODO - calculate player fantasy points
  // TODO - need player position for te premium, etc
  // const points = calculatePoints({ stats, league })
  // stats.pts = points.total

  return { players, percentiles }
}

export function calculateTeamPercentiles(teams) {
  const grouped = groupBy(teams, 'seas')
  const percentiles = {}

  for (const group in grouped) {
    percentiles[group] = calculatePercentiles({
      items: grouped[group],
      stats: constants.teamStats
    })
  }

  return percentiles
}

export function calculatePlayerValues(payload) {
  const { league, players, rosterRows } = payload

  const { nteams, cap, minBid } = league
  const rosterSize = getRosterSize(league)
  const leagueTotalCap = nteams * cap - nteams * rosterSize * minBid

  const finalWeek = constants.season.finalWeek
  for (const player of players) {
    player.points = player.points || {}
    player.projection = player.projection || {}
    for (let week = 0; week <= finalWeek; week++) {
      const projection = player.projection[week]
      if (projection) {
        const points = calculatePoints({
          stats: projection,
          position: player.pos,
          league
        })
        player.points[week] = points
      } else {
        player.points[week] = player.points[week] || { total: 0 }
      }
      player.vorp[week] = {}
      player.market_salary[week] = {}
    }

    if (player.projection.ros) {
      player.points.ros = calculatePoints({
        stats: player.projection.ros,
        position: player.pos,
        league
      })
    }
  }

  const baselinesByWeek = {}
  for (let week = 0; week <= finalWeek; week++) {
    // calculate baseline
    const baselines = calculateBaselines({ players, league, rosterRows, week })
    baselinesByWeek[week] = baselines

    // calculate values
    const total = calculateValues({
      players,
      baselines,
      week,
      league
    })
    calculatePrices({ cap: leagueTotalCap, total, players, week })
  }

  calculatePlayerValuesRestOfSeason({ players, rosterRows, league })

  return { baselines: baselinesByWeek, players }
}

function rollup(group) {
  const stats = {
    total: [],
    avg: []
  }

  for (const gamelogs of Object.values(group)) {
    const t = sum(gamelogs, constants.fantasyStats)
    const weeks = uniqBy(gamelogs, 'week').length
    stats.avg.push(avg(t, constants.fantasyStats, weeks))
    stats.total.push(t)
  }

  const percentiles = {}
  for (const type in stats) {
    percentiles[type] = calculatePercentiles({
      items: stats[type],
      stats: constants.fantasyStats
    })
  }

  return {
    stats,
    percentiles
  }
}

const copy = ({ opp, tm }) => ({ opp, tm })

const sum = (items = [], keys = []) => {
  const r = copy(items[0])
  for (const key of keys) {
    r[key] = items.reduce((acc, item) => acc + item[key], 0)
  }
  return r
}

const avg = (item, props, num) => {
  const obj = copy(item)
  for (const prop of props) {
    obj[prop] = item[prop] / num
  }
  return obj
}

const adj = (actual, average, props) => {
  const obj = copy(actual)
  for (const prop of props) {
    obj[prop] = actual[prop] - average[prop]
  }
  return obj
}

export function processPlayerGamelogs(gamelogs) {
  const positions = groupBy(gamelogs, 'pos')

  const defense = {}
  const offense = {}
  const individual = {}

  for (const position in positions) {
    const glogs = positions[position]

    const defenseGroups = groupBy(glogs, 'opp')
    defense[position] = rollup(defenseGroups)

    const offenseGroups = groupBy(glogs, 'tm')
    offense[position] = rollup(offenseGroups)

    const adjusted = []
    for (const team of constants.nflTeams) {
      // get defense gamelogs
      const gs = defenseGroups[team]
      // group by week
      const weekGroups = groupBy(gs, 'week')
      const weeks = []
      for (const logs of Object.values(weekGroups)) {
        // sum week
        const gamelog = sum(logs, constants.fantasyStats)
        // get offense (opponent) average
        const offenseAverage = offense[position].stats.avg.find(
          (g) => g.tm === gamelog.tm
        )
        // calculate difference (adjusted)
        const adjusted = adj(gamelog, offenseAverage, constants.fantasyStats)
        weeks.push(adjusted)
      }
      const total = sum(weeks, constants.fantasyStats, weeks.length)
      adjusted.push(avg(total, constants.fantasyStats, weeks.length))
    }

    defense[position].stats.adj = adjusted
    defense[position].percentiles.adj = calculatePercentiles({
      items: adjusted,
      stats: constants.fantasyStats
    })

    individual[position] = calculatePercentiles({
      items: glogs,
      stats: constants.fantasyStats
    })
  }

  return {
    offense,
    defense,
    individual
  }
}

export function optimizeAuctionLineup({
  limits = {},
  players,
  league,
  active = []
}) {
  const variables = {}
  const ints = {}

  const pool = players.concat(active)
  const positions = pool.map((p) => p.pos).filter(Boolean)
  const positionConstraints = getOptimizerPositionConstraints({
    positions,
    league
  })
  const constraints = {
    value: { max: Math.round(league.cap * 0.9) },
    ...positionConstraints,
    ...limits
  }

  const addPlayer = ({ player, freeAgent }) => {
    variables[player.pid] = {
      points: Math.round(player.points || 0),
      starter: 1
    }
    variables[player.pid][player.pid] = 1
    // variables[player.pid][player.pos] = 1
    if (constraints[player.pid]) {
      constraints[player.pid].max = 1
    } else {
      constraints[player.pid] = { max: 1 }
    }
    ints[player.pid] = 1
    for (const pos of constants.positions) {
      variables[player.pid][pos] = player.pos === pos ? 1 : 0
    }

    if (freeAgent) {
      variables[player.pid].fa = 1
      variables[player.pid].value = Math.round(player.market_salary || 0)
    }
  }

  active.forEach((player) => addPlayer({ player, freeAgent: false }))
  players.forEach((player) => addPlayer({ player, freeAgent: true }))

  const model = {
    optimize: 'points',
    opType: 'max',
    constraints,
    variables,
    ints
  }

  return solver.Solve(model)
}
