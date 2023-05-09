import getRosterSize from './get-roster-size.mjs'
import calculatePrices from './calculate-prices.mjs'
import * as constants from './constants.mjs'

export default function ({ players, league }) {
  // calculate total available vorp
  let totalVorp = 0

  const { num_teams, cap, min_bid } = league
  const rosterSize = getRosterSize(league)
  const leagueTotalCap = num_teams * cap - num_teams * rosterSize * min_bid

  for (const player of players) {
    let vorpRos = 0
    for (const [week, value] of Object.entries(player.vorp)) {
      const wk = parseInt(week, 10)
      if (wk && wk >= constants.season.week) {
        if (value < 0) {
          continue
        }

        vorpRos += value
        totalVorp += value
      }
    }
    player.vorp.ros = vorpRos
  }

  // calculate ros contract value
  calculatePrices({
    cap: leagueTotalCap,
    total: totalVorp,
    players,
    week: 'ros'
  })

  return players
}
