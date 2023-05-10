import getRosterSize from './get-roster-size.mjs'
import calculatePrices from './calculate-prices.mjs'
import * as constants from './constants.mjs'

export default function ({ players, league }) {
  // calculate total available vorp
  let total_vorp = 0

  const { num_teams, cap, min_bid } = league
  const league_roster_size = getRosterSize(league)
  const league_total_salary_cap =
    num_teams * cap - num_teams * league_roster_size * min_bid

  for (const player of players) {
    let player_ros_vorp = 0
    for (const [week, week_vorp_value] of Object.entries(player.vorp)) {
      const wk = Number(week)
      if (wk && wk >= constants.season.week) {
        if (week_vorp_value < 0) {
          continue
        }

        player_ros_vorp += week_vorp_value
        total_vorp += week_vorp_value
      }
    }
    player.vorp.ros = player_ros_vorp
  }

  // calculate ros contract value
  calculatePrices({
    cap: league_total_salary_cap,
    total_vorp,
    players,
    week: 'ros'
  })

  return players
}
