import { create_empty_fantasy_stats } from '#constants'
import fixTeam from './fix-team.mjs'

const calculateDstStatsFromPlays = (plays, team) => {
  const dstStats = create_empty_fantasy_stats()
  dstStats.defensive_three_and_outs = plays.filter(
    (p) =>
      p.drive_play_count === 3 &&
      p.play_type_nfl === 'PUNT' &&
      p.pos_team !== team
  ).length
  const playStats = plays.map((p) => p.playStats).flat()

  for (const playStat of playStats) {
    switch (playStat.statId) {
      case 2:
        // punt block
        // clubCode belongs to possession team
        if (fixTeam(playStat.clubCode) !== team) {
          dstStats.defensive_blocked_kicks += 1
        }
        break

      case 7:
        // third down failed
        break

      case 9:
        // fourth down failed
        dstStats.defensive_fourth_down_stops += 1
        break

      case 10:
        // rushing yards
        dstStats.defensive_yards_against += playStat.yards
        break

      case 11:
        // rushing touchdown
        dstStats.defensive_yards_against += playStat.yards
        dstStats.defensive_points_against += 6
        break

      case 12:
        // lateral rush
        dstStats.defensive_yards_against += playStat.yards
        break

      case 13:
        // lateral rushing touchdown
        dstStats.defensive_yards_against += playStat.yards
        dstStats.defensive_points_against += 6
        break

      case 15:
        // completed pass
        dstStats.defensive_yards_against += playStat.yards
        break

      case 16:
        // passing touchdown
        dstStats.defensive_yards_against += playStat.yards
        dstStats.defensive_points_against += 6
        break

      case 19:
        // interception (passer)
        break

      case 20:
        // sack (team)
        dstStats.defensive_yards_against += playStat.yards
        dstStats.defensive_sacks += 1
        break

      case 25:
        // interception
        dstStats.defensive_interceptions += 1
        break

      case 26:
        // interception return touchdown
        dstStats.defensive_interceptions += 1
        dstStats.defensive_touchdowns += 1
        break

      case 28:
        // interception return touchdown (lateral), no interception credited
        dstStats.defensive_touchdowns += 1
        break

      case 34:
        // punt return touchdown
        if (fixTeam(playStat.clubCode) === team) {
          dstStats.punt_return_touchdowns += 1
        }
        break

      case 36:
        // punt return touchdown (lateral)
        if (fixTeam(playStat.clubCode) === team) {
          dstStats.punt_return_touchdowns += 1
        }
        break

      case 46:
        // kickoff return touchdown
        if (fixTeam(playStat.clubCode) === team) {
          dstStats.kickoff_return_touchdowns += 1
        }
        break

      case 48:
        // kickoff return touchdown (lateral)
        if (fixTeam(playStat.clubCode) === team) {
          dstStats.kickoff_return_touchdowns += 1
        }
        break

      case 52:
        // forced fumble (offensive player)
        break

      case 55:
        // fumble recovery (offensive player recovery)
        break

      case 56:
        // fumble recovery touchdown (offensive player)
        if (fixTeam(playStat.clubCode) !== team) {
          dstStats.defensive_points_against += 6
        }
        break

      case 57:
        // fumble lateral
        break

      case 58:
        // fumble recovery touchdown (lateral) (offensive player)
        dstStats.defensive_points_against += 6
        break

      case 59:
        // fumble recovery and return (defense)
        dstStats.defensive_recovered_fumbles += 1
        break

      case 60:
        // fumble return for touchdown (defense)
        if (fixTeam(playStat.clubCode) === team) {
          dstStats.defensive_recovered_fumbles += 1
          dstStats.defensive_touchdowns += 1
        }
        break

      case 61:
        // fumble recovery (lateral) (no recovery) (defense)
        break

      case 62:
        // fumble recovery touchdown (lateral) (no recovery) (defense)
        dstStats.defensive_touchdowns += 1
        break

      case 64:
        // touchdown (team)
        if (fixTeam(playStat.clubCode) === team) {
          dstStats.defensive_touchdowns += 1
        }
        break

      case 70:
        // made field goal
        if (fixTeam(playStat.clubCode) !== team) {
          dstStats.defensive_points_against += 3
        }
        break

      case 71:
        // blocked field goal
        if (fixTeam(playStat.clubCode) !== team) {
          dstStats.defensive_blocked_kicks += 1
        }
        break

      case 72:
        // made extra point
        if (fixTeam(playStat.clubCode) !== team) {
          dstStats.defensive_points_against += 1
        }
        break

      case 74:
        // blocked extra point
        if (fixTeam(playStat.clubCode) !== team) {
          dstStats.defensive_blocked_kicks += 1
        }
        break

      case 83:
        // sack (individual player)
        break

      case 84:
        // assisted sack (individual player)
        break

      case 85:
        // pass defense
        break

      case 86:
        // punt block player (individual) (defense)
        break

      case 87:
        // blocked kick player (individual)
        break

      case 88:
        // blocked field goal player (individual)
        break

      case 89:
        // safety
        dstStats.defensive_safeties += 1
        break

      case 91:
        // forced fumble player
        if (fixTeam(playStat.clubCode) === team) {
          dstStats.defensive_forced_fumbles += 1
        }
        break

      case 96:
        // extra point safety
        break

      case 99:
        // two point rush safety
        break

      case 100:
        // two point pass safety
        break

      case 404:
        // defender intercepted or recovered two point return
        if (fixTeam(playStat.clubCode) === team) {
          dstStats.defensive_two_point_returns += 1
        }
        break

      case 420:
        // two point return
        dstStats.defensive_two_point_returns += 1
        break
    }
  }

  return dstStats
}

export default calculateDstStatsFromPlays
