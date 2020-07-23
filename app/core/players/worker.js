import {
  weightProjections,
  calculatePoints,
  calculateBaselines,
  calculateValues
} from '@common'

// TODO calculate based on weekly projections

export function calculatePlayerValues (payload) {
  const { userId, vorpw, volsw, league, players } = payload
  const customBaselines = payload.baselines

  for (const player of players) {
    const { projections } = player

    player.projection = weightProjections({
      projections,
      weights: payload.sources,
      userId
    })
    const { projection } = player

    // calculate points for each league
    player.points = calculatePoints({ stats: projection, position: player.pos1, ...league })
  }

  // calculate baseline by position
  const baselines = calculateBaselines({ players, ...league })
  for (const pos in baselines) {
    if (customBaselines[pos] && customBaselines[pos].manual) {
      baselines[pos].manual = players.find(p => p.player === customBaselines[pos].manual)
    } else {
      baselines[pos].manual = baselines[pos].starter
    }
  }

  const values = calculateValues({ players, baselines, vorpw, volsw, ...league })
  return { baselines, values }
}
