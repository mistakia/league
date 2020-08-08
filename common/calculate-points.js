import { stats } from './constants'

const getScoring = ({ league }) => {
  const result = {}
  for (const stat of stats) {
    result[stat] = league[stat]
  }
  return result
}

const calculatePoints = ({ stats, position, league }) => {
  const scoring = getScoring({ league })

  const result = { total: 0 }
  for (const stat in scoring) {
    const factor = stat === 'rec'
      ? (league[`${position.toLowerCase()}rec`] || scoring[stat])
      : scoring[stat]

    const score = (factor * stats[stat]) || 0
    result[stat] = score
    result.total = result.total + score
  }

  return result
}

export default calculatePoints
