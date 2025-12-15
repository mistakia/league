import gaussian from 'gaussian'

const SIMULATIONS = 10000
const STD_DEV = 20

/**
 * Simulate championship odds starting from the wildcard round (week 15)
 *
 * @param {Object} params
 * @param {Array} params.playoff_teams - Array of 6 playoff team objects with tid and regular_season_finish
 * @param {Object} params.rosters - Object keyed by tid with lineup projections for weeks 15-17
 * @returns {Object} Object keyed by tid with championship_odds
 */
export default function simulate_wildcard_round({ playoff_teams, rosters }) {
  const result = {}

  // Initialize result for all 6 playoff teams
  for (const team of playoff_teams) {
    result[team.tid] = {
      tid: team.tid,
      championship_wins: 0
    }
  }

  // Separate bye teams (regular_season_finish 1-2) from wildcard teams (3-6)
  const bye_teams = playoff_teams.filter((t) =>
    [1, 2].includes(t.regular_season_finish)
  )
  const wildcard_teams = playoff_teams.filter((t) =>
    [3, 4, 5, 6].includes(t.regular_season_finish)
  )

  // Pre-calculate distributions for all weeks
  const distributions = {}
  for (const team of playoff_teams) {
    distributions[team.tid] = {}

    // Week 15 (wildcard round) - only wildcard teams need this
    if (wildcard_teams.find((t) => t.tid === team.tid)) {
      const lineup_15 = rosters[team.tid].lineups[15]
      distributions[team.tid][15] = gaussian(
        lineup_15.baseline_total,
        Math.pow(STD_DEV, 2)
      )
    }

    // Weeks 16-17 (championship round) - all playoff teams need this
    const lineup_16 = rosters[team.tid].lineups[16]
    const lineup_17 = rosters[team.tid].lineups[17]
    distributions[team.tid][16] = gaussian(
      lineup_16.baseline_total,
      Math.pow(STD_DEV, 2)
    )
    distributions[team.tid][17] = gaussian(
      lineup_17.baseline_total,
      Math.pow(STD_DEV, 2)
    )
  }

  // Run simulations
  for (let i = 0; i < SIMULATIONS; i++) {
    // Simulate wildcard round (week 15)
    const wildcard_scores = []
    for (const team of wildcard_teams) {
      const score = distributions[team.tid][15].random(1)[0]
      wildcard_scores.push({
        tid: team.tid,
        score
      })
    }

    // Top 2 wildcard scorers advance
    wildcard_scores.sort((a, b) => b.score - a.score)
    const wildcard_winners = wildcard_scores.slice(0, 2)

    // Championship round teams = bye teams + wildcard winners
    const championship_teams = [
      ...bye_teams,
      ...wildcard_teams.filter((t) =>
        wildcard_winners.some((w) => w.tid === t.tid)
      )
    ]

    // Simulate championship round (weeks 16-17 combined)
    const championship_scores = []
    for (const team of championship_teams) {
      const score_16 = distributions[team.tid][16].random(1)[0]
      const score_17 = distributions[team.tid][17].random(1)[0]
      championship_scores.push({
        tid: team.tid,
        score: score_16 + score_17
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
