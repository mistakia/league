import { stats } from './constants'

const getScoring = ({ ...args }) => {
  const result = {}
  for (const stat of stats) {
    result[stat] = args[stat]
  }
  return result
}

const calculatePoints = ({ stats, position, ...args }) => {
  const scoring = getScoring({ ...args })

  const result = { total: 0 }
  for (const stat in scoring) {
    const factor = stat === 'rec'
      ? (args[`${position.toLowerCase()}rec`] || scoring[stat])
      : scoring[stat]

    const score = (factor * stats[stat]) || 0
    result[stat] = score
    result.total = result.total + score
  }

  return result
}

export default calculatePoints
