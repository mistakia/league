const { groupBy, constants } = require('../common')
const db = require('../db')

module.exports = async (lid) => {
  const baselineRows = await db('league_baselines').where({ lid })
  const result = {}
  for (let i = 0; i <= constants.season.finalWeek; i++) {
    result[i] = {}
    for (const pos of constants.positions) {
      result[i][pos] = {}
    }
  }

  const byWeek = groupBy(baselineRows, 'week')
  for (const [week, baselines] of Object.entries(byWeek)) {
    const byPosition = groupBy(baselines, 'pos')
    for (const [pos, baslines] of Object.entries(byPosition)) {
      for (const baseline of baslines) {
        result[week][pos][baseline.type] = baseline.player
      }
    }
  }

  return result
}
