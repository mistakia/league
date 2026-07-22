import fixTeam from './fix-team.mjs'

/**
 * Calculate DST fantasy point delta for a single play
 *
 * @param {Object} params
 * @param {Object} params.play - The play object containing playStats and play metadata
 * @param {string} params.dst_team - The DST team abbreviation
 * @param {Object} params.dst_running_totals - Running totals for threshold stats { dya, dpa }
 * @returns {Object} Delta stats object with total and individual stat deltas
 */
const calculate_dst_delta_from_play = ({
  play,
  dst_team,
  dst_running_totals
}) => {
  const delta_stats = {
    total: 0,
    defensive_sacks: 0,
    defensive_interceptions: 0,
    defensive_forced_fumbles: 0,
    defensive_recovered_fumbles: 0,
    defensive_three_and_outs: 0,
    defensive_fourth_down_stops: 0,
    defensive_blocked_kicks: 0,
    defensive_safeties: 0,
    defensive_two_point_returns: 0,
    defensive_touchdowns: 0,
    defensive_yards_against: 0,
    defensive_points_against: 0
  }

  // Track raw stat changes for threshold calculation
  let play_yards_against = 0
  let play_points_against = 0

  // Check for three-and-out
  if (
    play.drive_play_count === 3 &&
    play.play_type_nfl === 'PUNT' &&
    fixTeam(play.pos_team) !== dst_team
  ) {
    delta_stats.defensive_three_and_outs = 1
  }

  const play_stats = play.playStats || []

  for (const play_stat of play_stats) {
    const stat_club = fixTeam(play_stat.clubCode)

    switch (play_stat.statId) {
      case 2:
        // punt block - clubCode belongs to possession team
        if (stat_club !== dst_team) {
          delta_stats.defensive_blocked_kicks += 1
        }
        break

      case 9:
        // fourth down failed
        delta_stats.defensive_fourth_down_stops += 1
        break

      case 10:
        // rushing yards
        play_yards_against += play_stat.yards || 0
        break

      case 11:
        // rushing touchdown
        play_yards_against += play_stat.yards || 0
        play_points_against += 6
        break

      case 12:
        // lateral rush
        play_yards_against += play_stat.yards || 0
        break

      case 13:
        // lateral rushing touchdown
        play_yards_against += play_stat.yards || 0
        play_points_against += 6
        break

      case 15:
        // completed pass
        play_yards_against += play_stat.yards || 0
        break

      case 16:
        // passing touchdown
        play_yards_against += play_stat.yards || 0
        play_points_against += 6
        break

      case 20:
        // sack (team)
        play_yards_against += play_stat.yards || 0
        delta_stats.defensive_sacks += 1
        break

      case 25:
        // interception
        delta_stats.defensive_interceptions += 1
        break

      case 26:
        // interception return touchdown
        delta_stats.defensive_interceptions += 1
        delta_stats.defensive_touchdowns += 1
        break

      case 28:
        // interception return touchdown (lateral), no interception credited
        delta_stats.defensive_touchdowns += 1
        break

      case 56:
        // fumble recovery touchdown (offensive player)
        if (stat_club !== dst_team) {
          play_points_against += 6
        }
        break

      case 58:
        // fumble recovery touchdown (lateral) (offensive player)
        play_points_against += 6
        break

      case 59:
        // fumble recovery and return (defense)
        delta_stats.defensive_recovered_fumbles += 1
        break

      case 60:
        // fumble return for touchdown (defense)
        if (stat_club === dst_team) {
          delta_stats.defensive_recovered_fumbles += 1
          delta_stats.defensive_touchdowns += 1
        }
        break

      case 62:
        // fumble recovery touchdown (lateral) (no recovery) (defense)
        delta_stats.defensive_touchdowns += 1
        break

      case 64:
        // touchdown (team)
        if (stat_club === dst_team) {
          delta_stats.defensive_touchdowns += 1
        }
        break

      case 70:
        // made field goal
        if (stat_club !== dst_team) {
          play_points_against += 3
        }
        break

      case 71:
        // blocked field goal
        if (stat_club !== dst_team) {
          delta_stats.defensive_blocked_kicks += 1
        }
        break

      case 72:
        // made extra point
        if (stat_club !== dst_team) {
          play_points_against += 1
        }
        break

      case 74:
        // blocked extra point
        if (stat_club !== dst_team) {
          delta_stats.defensive_blocked_kicks += 1
        }
        break

      case 89:
        // safety
        delta_stats.defensive_safeties += 1
        break

      case 91:
        // forced fumble player
        if (stat_club === dst_team) {
          delta_stats.defensive_forced_fumbles += 1
        }
        break

      case 404:
        // defender intercepted or recovered two point return
        if (stat_club === dst_team) {
          delta_stats.defensive_two_point_returns += 1
        }
        break

      case 420:
        // two point return
        delta_stats.defensive_two_point_returns += 1
        break
    }
  }

  // Calculate threshold-based deltas for yards against
  const dya_before = dst_running_totals.defensive_yards_against
  const dya_after = dya_before + play_yards_against
  const dya_points_before = Math.max(dya_before - 300, 0) * -0.02
  const dya_points_after = Math.max(dya_after - 300, 0) * -0.02
  delta_stats.defensive_yards_against = dya_points_after - dya_points_before

  // Calculate threshold-based deltas for points against
  const dpa_before = dst_running_totals.defensive_points_against
  const dpa_after = dpa_before + play_points_against
  const dpa_points_before = Math.max(dpa_before - 20, 0) * -0.4
  const dpa_points_after = Math.max(dpa_after - 20, 0) * -0.4
  delta_stats.defensive_points_against = dpa_points_after - dpa_points_before

  // Calculate total from fixed-value stats
  delta_stats.total =
    delta_stats.defensive_sacks * 1 +
    delta_stats.defensive_interceptions * 2 +
    delta_stats.defensive_forced_fumbles * 1 +
    delta_stats.defensive_recovered_fumbles * 1 +
    delta_stats.defensive_three_and_outs * 1 +
    delta_stats.defensive_fourth_down_stops * 1 +
    delta_stats.defensive_blocked_kicks * 3 +
    delta_stats.defensive_safeties * 2 +
    delta_stats.defensive_two_point_returns * 2 +
    delta_stats.defensive_touchdowns * 6 +
    delta_stats.defensive_yards_against +
    delta_stats.defensive_points_against

  // Return updated running totals for caller to track
  return {
    delta_stats,
    updated_running_totals: {
      defensive_yards_against: dya_after,
      defensive_points_against: dpa_after
    }
  }
}

export default calculate_dst_delta_from_play
