import {
  calculateStatsFromPlays,
  groupBy,
  constants,
  calculatePercentiles
} from '@common'

export function calculate(params) {
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
