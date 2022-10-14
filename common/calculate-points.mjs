import { fantasy_stats } from './constants.mjs'

const getScoring = ({ league }) => {
  const result = {}
  for (const stat of fantasy_stats) {
    result[stat] = league[stat] || 0
  }
  return result
}

const calculatePoints = ({ stats, position = '', league }) => {
  const scoring = getScoring({ league })

  const result = { total: 0 }
  for (const stat in scoring) {
    const factor =
      stat === 'rec'
        ? league[`${position.toLowerCase()}rec`] || scoring[stat]
        : scoring[stat]

    const score = factor * (stats[stat] || 0)
    result[stat] = score
    result.total = result.total + score
  }

  result.xpm = (stats.xpm || 0) * 1
  result.total = result.total + result.xpm
  if (stats.fgy) {
    result.fgm = stats.fgy / 10
    result.total = result.total + result.fgm
  } else {
    result.fgm = (stats.fgm || 0) * 3
    result.fg19 = (stats.fg19 || 0) * 3
    result.fg29 = (stats.fg29 || 0) * 3
    result.fg39 = (stats.fg39 || 0) * 3
    result.fg49 = (stats.fg49 || 0) * 4
    result.fg50 = (stats.fg50 || 0) * 5
    result.total =
      result.total +
      result.fg19 +
      result.fg29 +
      result.fg39 +
      result.fg49 +
      result.fg50
  }

  const dst = {
    dsk: (stats.dsk || 0) * 1,
    dint: (stats.dint || 0) * 2,
    dff: (stats.dff || 0) * 1, // forced fumble
    drf: (stats.drf || 0) * 1, // recovered fumble
    dtno: (stats.dtno || 0) * 1, // three and out
    dfds: (stats.dfds || 0) * 1, // fourth down stop
    dpa: Math.max(stats.dpa - 20 || 0, 0) * -0.4, // points against
    dya: Math.max(stats.dya - 300 || 0, 0) * -0.02, // yards against
    dblk: (stats.dblk || 0) * 3, // blocked kicks
    dsf: (stats.dsf || 0) * 2, // safety
    dtpr: (stats.dtpr || 0) * 2, // two point return
    dtd: (stats.dtd || 0) * 6
  }

  const dstTotal = Object.values(dst).reduce((sum, v) => sum + v, 0)

  for (const [key, value] of Object.entries(dst)) {
    result[key] = value
  }

  result.total += dstTotal

  return result
}

export default calculatePoints
