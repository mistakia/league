import { stats } from './constants'

const getScoring = ({ ...args }) => {
  let result = {}
  for (const stat of stats) {
    result[stat] = args[stat]
  }
  return result
}

const calculatePoints = ({ stats, ...args }) => {
  const scoring = getScoring({ ...args })

  const result = { total: 0 }
  for (const stat in scoring) {
    const score = (scoring[stat] * stats[stat]) || 0
    result[stat] = score
    result.total = result.total + score
  }

  return result
}

export default calculatePoints
