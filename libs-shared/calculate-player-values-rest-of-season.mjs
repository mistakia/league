import calculatePrices from './calculate-prices.mjs'
import { current_season } from '#constants'

export default function ({ players, league }) {
  // calculate total available points added
  let total_pts_added = 0

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
        total_pts_added += pts_added
      }
    }
    player.pts_added.ros = player_ros_pts_added
    player.pts_added.ros_net = player_ros_pts_added_net
  }

  calculatePrices({
    league_format: league,
    total_pts_added,
    players,
    week: 'ros'
  })

  return players
}
