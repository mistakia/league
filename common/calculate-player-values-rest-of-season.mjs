import getRosterSize from './get-roster-size.mjs'
import calculatePrices from './calculate-prices.mjs'
import * as constants from './constants.mjs'

export default function ({ players, league }) {
  // calculate total available points added
  let total_pts_added = 0

  const { num_teams, cap, min_bid } = league
  const league_roster_size = getRosterSize(league)
  const league_total_salary_cap =
    num_teams * cap - num_teams * league_roster_size * min_bid

  for (const player of players) {
    let player_ros_pts_added = 0
    for (const [week, pts_added] of Object.entries(player.pts_added)) {
      const wk = Number(week)
      if (wk && wk >= constants.season.week) {
        if (pts_added < 0) {
          continue
        }

        player_ros_pts_added += pts_added
        total_pts_added += pts_added
      }
    }
    player.pts_added.ros = player_ros_pts_added
  }

  // calculate ros contract value
  calculatePrices({
    cap: league_total_salary_cap,
    total_pts_added,
    players,
    week: 'ros'
  })

  return players
}
