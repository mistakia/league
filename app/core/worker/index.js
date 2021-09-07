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
  optimizeStandingsLineup,
  optimizeLineup,
  simulate,
  calculatePlayerValuesRestOfSeason
} from '@common'
import solver from 'javascript-lp-solver'

export function workerSimulate(params) {
  return simulate(params)
}

export function workerOptimizeLineup(params) {
  return optimizeLineup(params)
}

export function calculateStats(params) {
  return calculateStatsFromPlays(params)
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

export function processTeamGamelogs(gamelogs) {
  return calculatePercentiles({
    items: gamelogs,
    stats: constants.teamStats
  })
}

export function calculatePlayerValues(payload) {
  const { league, players, rosterRows } = payload
  const customBaselines = payload.baselines

  const { nteams, cap, minBid } = league
  const rosterSize = getRosterSize(league)
  const leagueTotalCap = nteams * cap - nteams * rosterSize * minBid

  const finalWeek = constants.season.finalWeek
  for (const player of players) {
    for (let week = 0; week <= finalWeek; week++) {
      player.points[week] = player.points[week] || { total: 0 }
      player.vorp[week] = {}
      player.market_salary[week] = {}
    }
  }

  const baselines = {}
  for (let week = 0; week <= finalWeek; week++) {
    // calculate baseline
    const b = calculateBaselines({ players, league, rosterRows, week })

    // set manual baselines if they exist, use starter baseline by default
    for (const pos in b) {
      if (customBaselines[pos] && customBaselines[pos].manual) {
        b[pos].manual = players.find(
          (p) => p.player === customBaselines[pos].manual
        )
      }

      if (!b[pos].manual) {
        b[pos].manual = b[pos].starter
      }
    }

    baselines[week] = b

    // calculate values
    const total = calculateValues({ players, baselines: b, week })
    calculatePrices({ cap: leagueTotalCap, total, players, week })
  }

  calculatePlayerValuesRestOfSeason({ players, rosterRows, league })

  return { baselines: baselines, players }
}

const average = (data) => data.reduce((sum, value) => sum + value) / data.length
const standardDeviation = (values) =>
  Math.sqrt(average(values.map((value) => (value - average(values)) ** 2)))

export function calculateStandings({
  league,
  tids,
  starters,
  active,
  gamelogs,
  matchups
}) {
  const currentWeek = constants.season.week
  const result = {}
  for (const tid of tids) {
    result[tid] = {
      tid,
      gamelogs: [],
      games: {},
      points: {
        weeks: {}
      },
      stats: constants.createFantasyTeamStats(),
      potentialPoints: {},
      potentialPointsPenalty: {}
    }

    result[tid].stats.pmin = 99999
  }

  const minStarters =
    league.sqb +
    league.srb +
    league.swr +
    league.ste +
    league.srbwr +
    league.srbwrte +
    league.sqbrbwrte +
    league.swrte +
    league.sdst +
    league.sk

  for (let week = 1; week < currentWeek; week++) {
    for (const tid of tids) {
      const startingPlayers = starters[week][tid]
      const starterIds = startingPlayers.map((p) => p.player)
      let total = 0
      result[tid].games[week] = {}
      const optimizePlayers = []
      for (const { player, pos } of active[week][tid]) {
        const gamelog = gamelogs.find(
          (g) => g.week === week && g.player === player
        )
        if (!gamelog) {
          continue
        }

        result[tid].gamelogs.push(gamelog)
        const points = calculatePoints({
          stats: gamelog,
          position: pos,
          league
        })
        result[tid].games[week][player] = points.total
        if (starterIds.includes(player)) {
          const starter = startingPlayers.find((p) => p.player === player)
          total = points.total + total
          result[tid].stats[`pPos${pos}`] += points.total
          result[tid].stats[`pSlot${starter.slot}`] += points.total
        }
        optimizePlayers.push({
          player,
          pos,
          points: points.total
        })
      }

      // calculate optimal lineup
      const optimizeResult = optimizeStandingsLineup({
        players: optimizePlayers,
        league
      })
      if (optimizeResult.starters.length < minStarters) {
        result[tid].potentialPointsPenalty[week] = true
      }
      result[tid].potentialPoints[week] = optimizeResult.total
      result[tid].stats.pp += optimizeResult.total

      if (result[tid].stats.pmax < total) result[tid].stats.pmax = total
      if (result[tid].stats.pmin > total) result[tid].stats.pmin = total

      result[tid].points.weeks[week] = total
      result[tid].stats.pf += total
    }
  }

  for (let week = 1; week < currentWeek; week++) {
    const weekMatchups = matchups.filter((m) => m.week === week)
    for (const m of weekMatchups) {
      const homeScore = result[m.hid].points.weeks[week]
      const awayScore = result[m.aid].points.weeks[week]

      const pHomeScore = result[m.hid].potentialPoints[week]
      const pAwayScore = result[m.aid].potentialPoints[week]

      result[m.hid].stats.pa += awayScore
      result[m.aid].stats.pa += homeScore

      if (homeScore > awayScore) {
        result[m.hid].stats.wins += 1
        result[m.aid].stats.losses += 1

        if (pAwayScore > homeScore) {
          result[m.aid].stats.pw += 1
          result[m.hid].stats.pl += 1
        }
      } else if (homeScore < awayScore) {
        result[m.hid].stats.losses += 1
        result[m.aid].stats.wins += 1

        if (pHomeScore > awayScore) {
          result[m.hid].stats.pw += 1
          result[m.aid].stats.pl += 1
        }
      } else {
        result[m.hid].stats.ties += 1
        result[m.aid].stats.ties += 1
      }
    }

    // calculate all play record

    for (const tid of tids) {
      const scores = Object.values(result)
        .filter((p) => p.tid !== tid)
        .map((p) => p.points.weeks[week])
      const score = result[tid].points.weeks[week]
      result[tid].stats.apWins += scores.filter((p) => p < score).length
      result[tid].stats.apLosses += scores.filter((p) => p > score).length
      result[tid].stats.apTies += scores.filter((p) => p === score).length

      if (result[tid].potentialPointsPenalty[week]) {
        const pps = Object.values(result).map((p) => p.potentialPoints[week])
        const max = Math.max(...pps)
        result[tid].stats.ppp += max - result[tid].potentialPoints[week]
      }
    }
  }

  // calculate draft order
  const potentialPoints = Object.values(result).map(
    (p) => p.stats.pp + p.stats.ppp
  )
  const allPlayLosses = Object.values(result).map((p) => p.stats.apLosses)
  const minPP = Math.min(...potentialPoints)
  const maxPP = Math.max(...potentialPoints)
  const minAPL = Math.min(...allPlayLosses)
  const maxAPL = Math.max(...allPlayLosses)
  for (const tid of tids) {
    const pp = result[tid].stats.pp + result[tid].stats.ppp
    const apl = result[tid].stats.apLosses
    const normPP = (pp - minPP) / (maxPP - minPP)
    const normAPL = (apl - minAPL) / (maxAPL - minAPL)
    result[tid].stats.doi = 9 * normPP + normAPL

    const points = Object.values(result[tid].points.weeks)
    result[tid].stats.pdev = points.length ? standardDeviation(points) : null
    result[tid].stats.pdiff = result[tid].stats.pf - result[tid].stats.pa
    result[tid].stats.pp_pct =
      (result[tid].stats.pf / result[tid].stats.pp) * 100
  }

  const percentiles = calculatePercentiles({
    items: Object.values(result).map((t) => t.stats),
    stats: constants.fantasyTeamStats
  })

  return { teams: result, percentiles }
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
  active = [],
  valueType = '0'
}) {
  const variables = {}
  const ints = {}

  const pool = players.concat(active)
  const positions = pool.map((p) => p.pos)
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
    variables[player.player] = {
      points: Math.round(player.points[valueType].total || 0),
      starter: 1
    }
    variables[player.player][player.player] = 1
    // variables[player.player][player.pos] = 1
    if (constraints[player.player]) {
      constraints[player.player].max = 1
    } else {
      constraints[player.player] = { max: 1 }
    }
    ints[player.player] = 1
    for (const pos of constants.positions) {
      variables[player.player][pos] = player.pos === pos ? 1 : 0
    }

    if (freeAgent) {
      variables[player.player].fa = 1
      variables[player.player].value = Math.round(
        player.market_salary[valueType] || 0
      )
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
