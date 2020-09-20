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

  result.xpm = stats.xpm * 1
  result.total = result.total + result.xpm
  if (stats._fgm) {
    result.fgm = stats._fgm.reduce((sum, fg) => sum + Math.max(fg / 10, 3), 0)
    result.total = result.total + result.fgm
  } else {
    result.fgm = stats.fgm * 3
    result.fg19 = stats.fg19 * 3
    result.fg29 = stats.fg29 * 3
    result.fg39 = stats.fg39 * 3
    result.fg49 = stats.fg49 * 4
    result.fg50 = stats.fg50 * 5
    result.total = result.total + result.fgm + result.fg19 + result.fg29 + result.fg39 + result.fg49 + result.fg50
  }

  const dst = {
    dsk: stats.dsk * 1,
    dint: stats.dint * 2,
    dff: stats.dff * 1, // forced fumble
    drf: stats.drf * 1, // recovered fumble
    dtno: stats.dtno * 1, // three and out
    dfds: stats.dfds * 1, // fourth down stop
    dpa: Math.max(stats.dpa - 20, 0) * -0.4, // points against
    dya: Math.max(stats.dya - 300, 0) * -0.02, // yards against
    dblk: stats.dblk * 3, // blocked kicks
    dsfty: stats.dsfty * 2, // safety
    dtpr: stats.dtpr * 2, // two point return
    dtd: stats.dtd * 6
  }

  const dstTotal = Object.values(dst).reduce((sum, v) => sum + v, 0)

  for (const [key, value] of Object.entries(dst)) {
    result[key] = value
  }

  result.total += dstTotal

  return result
}

export default calculatePoints
