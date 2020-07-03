import {
  weightProjections,
  calculatePoints,
  calculateBaselines,
  calculateValues
} from '@common'

export function calculatePlayerValues (payload) {
  const { userId, vorpw, volsw, league, players } = payload

  for (const player of players) {
    const { projections } = player

    player.projection = weightProjections({
      projections,
      weights: payload.sources,
      userId
    })
    const { projection } = player

    // calculate points for each league
    player.points = calculatePoints({ stats: projection, ...league })
  }

  // calculate worst starter baseline
  const baselines = calculateBaselines({ players, ...league })
  const result = calculateValues({ players, baselines, vorpw, volsw, ...league })
  return result
}
