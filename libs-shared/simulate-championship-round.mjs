import gaussian from 'gaussian'

const SIMULATIONS = 10000
const STD_DEV = 20

/**
 * Simulate championship odds for the 4 remaining teams in championship round
 *
 * @param {Object} params
 * @param {Array} params.championship_teams - Array of 4 championship team objects with tid
 * @param {Object} params.rosters - Object keyed by tid with lineup projections for weeks 16-17
 * @param {number} params.week - Current week (16 or 17)
 * @param {Object} params.week_16_points - Optional: Object keyed by tid with actual week 16 points (for week 17 simulation)
 * @returns {Object} Object keyed by tid with championship_odds
 */
export default function simulate_championship_round({
  championship_teams,
  rosters,
  week,
  week_16_points = {}
}) {
  const result = {}

  // Initialize result for all 4 championship teams
  for (const team of championship_teams) {
    result[team.tid] = {
      tid: team.tid,
      championship_wins: 0
    }
  }

  // Pre-calculate distributions for remaining weeks
  const distributions = {}
  for (const team of championship_teams) {
    distributions[team.tid] = {}

    // Week 16 - only if we're simulating week 16 (not using actual points)
    if (week === 16) {
      const lineup_16 = rosters[team.tid].lineups[16]
      distributions[team.tid][16] = gaussian(
        lineup_16.baseline_total,
        Math.pow(STD_DEV, 2)
      )
    }

    // Week 17 - always need this
    const lineup_17 = rosters[team.tid].lineups[17]
    distributions[team.tid][17] = gaussian(
      lineup_17.baseline_total,
      Math.pow(STD_DEV, 2)
    )
  }

  // Run simulations
  for (let i = 0; i < SIMULATIONS; i++) {
    const championship_scores = []

    for (const team of championship_teams) {
      let total_score = 0

      // Week 16: use actual points if available (week 17), otherwise simulate
      if (week === 17 && week_16_points[team.tid] !== undefined) {
        total_score += week_16_points[team.tid]
      } else if (week === 16) {
        total_score += distributions[team.tid][16].random(1)[0]
      }

      // Week 17: always simulate
      total_score += distributions[team.tid][17].random(1)[0]

      championship_scores.push({
        tid: team.tid,
        score: total_score
      })
    }

    // Highest combined score wins championship
    championship_scores.sort((a, b) => b.score - a.score)
    const champion = championship_scores[0]
    result[champion.tid].championship_wins += 1
  }

  // Calculate championship odds
  for (const tid in result) {
    result[tid].championship_odds = result[tid].championship_wins / SIMULATIONS
  }

  return result
}
