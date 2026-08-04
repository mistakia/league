import calculatePrices from './calculate-prices.mjs'
import { current_season } from '#constants'

// Two rest-of-season aggregates, both priced.
//
//   ros      positive-only -- what he adds when you can bench him
//   ros_net  signed        -- what he adds when you must start him every week
//
// They answer different questions for different league formats and are NOT a
// rescale of one another: a player can carry a positive `ros` and a negative
// `ros_net`, so he belongs in the first denominator and not the second.
// Measured on live 2026 genesis_10_team data the two positive-part totals are
// 3,230.7 and 3,114.5.
//
// `ros_net` was computed and persisted here for months while only `ros` was
// priced, so the net variant reached no consumer that speaks in cap dollars.
// calculatePrices now derives its own denominator from the aggregate key, which
// is what makes pricing the second one a second call rather than a second
// hand-accumulated total that can be -- and was -- forgotten.
export default function ({ players, league }) {
  for (const player of players) {
    let player_ros_pts_added = 0
    let player_ros_pts_added_net = 0
    for (const [week, pts_added] of Object.entries(player.pts_added)) {
      const wk = Number(week)
      if (wk && wk >= current_season.week) {
        // -999 is the "player did not play / not initialized" sentinel
        // from calculate-points-added.mjs. Must skip BEFORE the net
        // accumulator picks it up.
        if (pts_added === -999) {
          continue
        }
        player_ros_pts_added_net += pts_added
        if (pts_added < 0) {
          continue
        }

        player_ros_pts_added += pts_added
      }
    }
    player.pts_added.ros = player_ros_pts_added
    player.pts_added.ros_net = player_ros_pts_added_net
  }

  calculatePrices({
    league_format: league,
    players,
    aggregate_key: 'ros'
  })

  calculatePrices({
    league_format: league,
    players,
    aggregate_key: 'ros_net'
  })

  return players
}
