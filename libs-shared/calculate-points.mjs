import { base_fantasy_stats, projected_base_stats } from '#constants'

const getScoring = ({ league, use_projected_stats = false }) => {
  const result = {}
  const stats_to_use = use_projected_stats
    ? projected_base_stats
    : base_fantasy_stats
  for (const stat of stats_to_use) {
    result[stat] = league[stat] || 0
  }
  return result
}

const calculatePoints = ({
  stats,
  position = '',
  league,
  use_projected_stats = false
}) => {
  const scoring = getScoring({ league, use_projected_stats })

  const result = { total: 0 }
  for (const stat in scoring) {
    let factor
    let statValue

    // Handle position-specific reception scoring
    if (stat === 'rec') {
      factor = league[`${position.toLowerCase()}rec`] || scoring[stat]
      statValue = stats[stat] || 0
    }
    // Handle QB kneel exclusion for rushing yards
    // Only use ry_excluding_kneels if it has been explicitly calculated (not just initialized to 0)
    // We check if it differs from ry OR if ry is also 0 (meaning no rushing yards at all)
    else if (
      stat === 'ry' &&
      league.exclude_qb_kneels &&
      stats.ry_excluding_kneels !== undefined &&
      stats.ry_excluding_kneels !== null &&
      (stats.ry_excluding_kneels !== 0 || stats.ry === 0)
    ) {
      factor = scoring[stat]
      statValue = stats.ry_excluding_kneels
    }
    // Handle all other stats normally
    else {
      factor = scoring[stat]
      statValue = stats[stat] || 0
    }

    const score = factor * statValue
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

  // Handle anytime_td (simulation-specific stat from ANYTIME_TOUCHDOWN market odds)
  // This is a combined rushing+receiving TD expectation, scored at TD value
  // Only used when specific tdr/tdrec props are not available
  if (stats.anytime_td !== undefined && stats.anytime_td !== null) {
    const td_factor = league.tdr || 6 // Use rushing TD value, default 6 points
    result.anytime_td = stats.anytime_td * td_factor
    result.total += result.anytime_td
  }

  return result
}

export default calculatePoints
