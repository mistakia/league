import {
  calculateStatsFromPlays,
  calculatePercentiles,
  calculatePoints,
  calculate_projection_values,
  getOptimizerPositionConstraints,
  optimizeLineup,
  calculate_player_period_values
} from '#libs-shared'
import {
  season_aggregate_key,
  season_projection_week
} from '#libs-shared/calculate-distributional-baselines.mjs'
import solver from 'javascript-lp-solver'
import {
  current_season,
  fantasy_positions,
  extended_player_stats
} from '#constants'

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

  const final_week = current_season.final_week
  for (const player of players) {
    player.points = player.points || {}
    player.projection = player.projection || {}
    for (let week = 0; week <= final_week; week++) {
      const projection = player.projection[week]
      if (projection) {
        const points = calculatePoints({
          stats: projection,
          position: player.primary_position,
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

    if (player.projection.rest_of_season) {
      player.points.rest_of_season = calculatePoints({
        stats: player.projection.rest_of_season,
        position: player.primary_position,
        league
      })
    }

    // The SEASON board, under the same named key the API payload uses. The
    // weekly loop above writes points[0] from projection[0], and that used to be
    // what the distributional model read -- so this key was never needed here.
    // It is now: the model reads points.season, and a recompute that does not
    // publish it prices the whole board at the sentinel on the first roster
    // mutation, with the server's correct values replaced in place.
    if (player.projection[season_projection_week]) {
      player.points[season_aggregate_key] = calculatePoints({
        stats: player.projection[season_projection_week],
        position: player.primary_position,
        league
      })
    }
  }

  const baselinesByWeek = {}
  for (let week = 0; week <= final_week; week++) {
    const { baselines } = calculate_projection_values({
      players,
      league,
      rosterRows,
      week
    })
    baselinesByWeek[week] = baselines
  }

  // After the weekly loop, never inside it: both period nets are sums over the
  // weekly boards above. This publishes the same aggregate keys the API payload
  // carries -- `season`, `season_net`, `rest_of_season`, `rest_of_season_net` --
  // so a recompute after a roster mutation replaces the server's values in
  // place rather than writing a second vocabulary beside them.
  calculate_player_period_values({ players, league })

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

  // `players`/`active` here are synthetic optimize candidates
  // { pid, pos, points, market_salary } built by format_auction_player;
  // `pos` is a generic position code, not the player-dimension
  // primary_position column.
  const pool = players.concat(active)
  const positions = pool
    .map((optimize_player) => optimize_player.pos)
    .filter(Boolean)
  const positionConstraints = getOptimizerPositionConstraints({
    positions,
    league
  })
  const constraints = {
    value: { max: Math.round(league.salary_cap * 0.9) },
    ...positionConstraints,
    ...limits
  }

  const addPlayer = ({ player: optimize_player, freeAgent }) => {
    variables[optimize_player.pid] = {
      points: Math.round(optimize_player.points || 0),
      starter: 1
    }
    variables[optimize_player.pid][optimize_player.pid] = 1
    // variables[optimize_player.pid][optimize_player.pos] = 1
    if (constraints[optimize_player.pid]) {
      constraints[optimize_player.pid].max = 1
    } else {
      constraints[optimize_player.pid] = { max: 1 }
    }
    ints[optimize_player.pid] = 1
    for (const pos of fantasy_positions) {
      variables[optimize_player.pid][pos] = optimize_player.pos === pos ? 1 : 0
    }

    if (freeAgent) {
      variables[optimize_player.pid].fa = 1
      variables[optimize_player.pid].value = Math.round(
        optimize_player.market_salary || 0
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
