const calculatePoints = ({ stats, scoring }) => {
  const result = { total: 0 }
  for (const stat in stats) {
    const score = stat * scoring[stat]
    result[stat] = score
    result.total = result.total + score
  }

  return result
}

module.exports = calculatePoints
