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
    dsk: 0,
    dint: 0,
    dff: 0,
    drf: 0,
    dtno: 0,
    dfds: 0,
    dblk: 0,
    dsf: 0,
    dtpr: 0,
    dtd: 0,
    dya: 0,
    dpa: 0
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
    delta_stats.dtno = 1
  }

  const play_stats = play.playStats || []

  for (const play_stat of play_stats) {
    const stat_club = fixTeam(play_stat.clubCode)

    switch (play_stat.statId) {
      case 2:
        // punt block - clubCode belongs to possession team
        if (stat_club !== dst_team) {
          delta_stats.dblk += 1
        }
        break

      case 9:
        // fourth down failed
        delta_stats.dfds += 1
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
        delta_stats.dsk += 1
        break

      case 25:
        // interception
        delta_stats.dint += 1
        break

      case 26:
        // interception return touchdown
        delta_stats.dint += 1
        delta_stats.dtd += 1
        break

      case 28:
        // interception return touchdown (lateral), no interception credited
        delta_stats.dtd += 1
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
        delta_stats.drf += 1
        break

      case 60:
        // fumble return for touchdown (defense)
        if (stat_club === dst_team) {
          delta_stats.drf += 1
          delta_stats.dtd += 1
        }
        break

      case 62:
        // fumble recovery touchdown (lateral) (no recovery) (defense)
        delta_stats.dtd += 1
        break

      case 64:
        // touchdown (team)
        if (stat_club === dst_team) {
          delta_stats.dtd += 1
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
          delta_stats.dblk += 1
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
          delta_stats.dblk += 1
        }
        break

      case 89:
        // safety
        delta_stats.dsf += 1
        break

      case 91:
        // forced fumble player
        if (stat_club === dst_team) {
          delta_stats.dff += 1
        }
        break

      case 404:
        // defender intercepted or recovered two point return
        if (stat_club === dst_team) {
          delta_stats.dtpr += 1
        }
        break

      case 420:
        // two point return
        delta_stats.dtpr += 1
        break
    }
  }

  // Calculate threshold-based deltas for yards against
  const dya_before = dst_running_totals.dya
  const dya_after = dya_before + play_yards_against
  const dya_points_before = Math.max(dya_before - 300, 0) * -0.02
  const dya_points_after = Math.max(dya_after - 300, 0) * -0.02
  delta_stats.dya = dya_points_after - dya_points_before

  // Calculate threshold-based deltas for points against
  const dpa_before = dst_running_totals.dpa
  const dpa_after = dpa_before + play_points_against
  const dpa_points_before = Math.max(dpa_before - 20, 0) * -0.4
  const dpa_points_after = Math.max(dpa_after - 20, 0) * -0.4
  delta_stats.dpa = dpa_points_after - dpa_points_before

  // Calculate total from fixed-value stats
  delta_stats.total =
    delta_stats.dsk * 1 +
    delta_stats.dint * 2 +
    delta_stats.dff * 1 +
    delta_stats.drf * 1 +
    delta_stats.dtno * 1 +
    delta_stats.dfds * 1 +
    delta_stats.dblk * 3 +
    delta_stats.dsf * 2 +
    delta_stats.dtpr * 2 +
    delta_stats.dtd * 6 +
    delta_stats.dya +
    delta_stats.dpa

  // Return updated running totals for caller to track
  return {
    delta_stats,
    updated_running_totals: {
      dya: dya_after,
      dpa: dpa_after
    }
  }
}

export default calculate_dst_delta_from_play
