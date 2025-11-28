import {
  calculateStatsFromPlays,
  calculatePercentiles,
  calculatePoints,
  calculateBaselines,
  calculateValues,
  calculatePrices,
  getRosterSize,
  getOptimizerPositionConstraints,
  optimizeLineup,
  calculatePlayerValuesRestOfSeason
} from '@libs-shared'
import solver from 'javascript-lp-solver'
import {
  current_season,
  fantasy_positions,
  extended_player_stats
} from '@constants'

export function workerOptimizeLineup(params) {
  return optimizeLineup(params)
}

export function workerCalculateStatsFromPlays({ plays, qualifiers, league }) {
  const players = calculateStatsFromPlays(plays)

  for (const pid in players) {
    const stats = players[pid]
    // TODO - need player position for te premium, etc
    const points = calculatePoints({ stats, league })
    stats.pts = points.total
  }

  const percentiles = calculatePercentiles({
    items: Object.values(players),
    stats: extended_player_stats,
    qualifiers
  })

  return { players, percentiles }
}

export function calculatePlayerValues(payload) {
  const { league, players, rosterRows } = payload

  const { num_teams, cap, min_bid } = league
  const rosterSize = getRosterSize(league)
  const leagueTotalCap = num_teams * cap - num_teams * rosterSize * min_bid

  const finalWeek = current_season.finalWeek
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

      if (!player.pts_added) {
        player.pts_added = {}
      }
      player.pts_added[week] = {}

      if (!player.market_salary) {
        player.market_salary = {}
      }
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
    const total_pts_added = calculateValues({
      players,
      baselines,
      week,
      league
    })
    calculatePrices({ cap: leagueTotalCap, total_pts_added, players, week })
  }

  calculatePlayerValuesRestOfSeason({ players, rosterRows, league })

  return { baselines: baselinesByWeek, players }
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
    for (const pos of fantasy_positions) {
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
