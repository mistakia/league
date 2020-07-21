import percentile from 'percentile'
import { calculateStatsFromPlays, groupBy, constants } from '@common'

export function calculate (params) {
  return calculateStatsFromPlays(params)
}

export function calculateTeam (teams) {
  const grouped = groupBy(teams, 'seas')
  const overall = {}

  for (const group in grouped) {
    overall[group] = {}
    for (const stat of constants.teamStats) {
      const teams = grouped[group]
      const values = teams.map(t => t[stat])
      const result = percentile([50, 75, 90, 95, 98, 99, 0, 100], values)
      overall[group][stat] = {
        p50: result[0],
        p75: result[1],
        p90: result[2],
        p95: result[3],
        p98: result[4],
        p99: result[5],
        min: result[6],
        max: result[7]
      }
    }
  }

  return { overall }
}
