import { base_fantasy_stats, projected_base_stats } from '#constants'

// Position-specific reception scoring: a scoring format may award a different
// per-reception value to running backs, wide receivers, and tight ends. The
// league_scoring_formats config carries one column per position; positions
// without an override (QB/K/DST) fall back to the base `receptions` value.
const position_reception_columns = {
  RB: 'running_back_reception',
  WR: 'wide_receiver_reception',
  TE: 'tight_end_reception'
}

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
    if (stat === 'receptions') {
      const position_reception_column =
        position_reception_columns[position.toUpperCase()]
      factor =
        (position_reception_column && league[position_reception_column]) ||
        scoring[stat]
      statValue = stats[stat] || 0
    }
    // Handle QB kneel exclusion for rushing yards
    // Only use rushing_yards_excluding_kneels if it has been explicitly
    // calculated (not just initialized to 0). We check if it differs from
    // rushing_yards OR if rushing_yards is also 0 (meaning no rushing yards at all)
    else if (
      stat === 'rushing_yards' &&
      league.exclude_quarterback_kneels &&
      stats.rushing_yards_excluding_kneels !== undefined &&
      stats.rushing_yards_excluding_kneels !== null &&
      (stats.rushing_yards_excluding_kneels !== 0 || stats.rushing_yards === 0)
    ) {
      factor = scoring[stat]
      statValue = stats.rushing_yards_excluding_kneels
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

  result.extra_points_made = (stats.extra_points_made || 0) * 1
  result.total = result.total + result.extra_points_made
  if (stats.field_goal_yards) {
    result.field_goals_made = stats.field_goal_yards / 10
    result.total = result.total + result.field_goals_made
  } else {
    result.field_goals_made = (stats.field_goals_made || 0) * 3
    result.field_goals_made_0_19_yards =
      (stats.field_goals_made_0_19_yards || 0) * 3
    result.field_goals_made_20_29_yards =
      (stats.field_goals_made_20_29_yards || 0) * 3
    result.field_goals_made_30_39_yards =
      (stats.field_goals_made_30_39_yards || 0) * 3
    result.field_goals_made_40_49_yards =
      (stats.field_goals_made_40_49_yards || 0) * 4
    result.field_goals_made_50_plus_yards =
      (stats.field_goals_made_50_plus_yards || 0) * 5
    result.total =
      result.total +
      result.field_goals_made_0_19_yards +
      result.field_goals_made_20_29_yards +
      result.field_goals_made_30_39_yards +
      result.field_goals_made_40_49_yards +
      result.field_goals_made_50_plus_yards
  }

  const dst = {
    defensive_sacks: (stats.defensive_sacks || 0) * 1,
    defensive_interceptions: (stats.defensive_interceptions || 0) * 2,
    defensive_forced_fumbles: (stats.defensive_forced_fumbles || 0) * 1,
    defensive_recovered_fumbles: (stats.defensive_recovered_fumbles || 0) * 1,
    defensive_three_and_outs: (stats.defensive_three_and_outs || 0) * 1,
    defensive_fourth_down_stops: (stats.defensive_fourth_down_stops || 0) * 1,
    defensive_points_against:
      Math.max(stats.defensive_points_against - 20 || 0, 0) * -0.4,
    defensive_yards_against:
      Math.max(stats.defensive_yards_against - 300 || 0, 0) * -0.02,
    defensive_blocked_kicks: (stats.defensive_blocked_kicks || 0) * 3,
    defensive_safeties: (stats.defensive_safeties || 0) * 2,
    defensive_two_point_returns: (stats.defensive_two_point_returns || 0) * 2,
    defensive_touchdowns: (stats.defensive_touchdowns || 0) * 6
  }

  const dstTotal = Object.values(dst).reduce((sum, v) => sum + v, 0)

  for (const [key, value] of Object.entries(dst)) {
    result[key] = value
  }

  result.total += dstTotal

  // Handle anytime_td (simulation-specific stat from ANYTIME_TOUCHDOWN market odds)
  // This is a combined rushing+receiving TD expectation, scored at TD value
  // Only used when specific rushing_touchdowns/receiving_touchdowns props are not available
  if (stats.anytime_td !== undefined && stats.anytime_td !== null) {
    const td_factor = league.rushing_touchdowns || 6 // Use rushing TD value, default 6 points
    result.anytime_td = stats.anytime_td * td_factor
    result.total += result.anytime_td
  }

  return result
}

export default calculatePoints
