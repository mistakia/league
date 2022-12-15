import * as constants from './constants.mjs'
import fixTeam from './fix-team.mjs'

const calculateDstStatsFromPlays = (plays, team) => {
  const dstStats = constants.create_fantasy_stats()
  dstStats.dtno = plays.filter(
    (p) =>
      p.drive_play_count === 3 && p.type_nfl === 'PUNT' && p.pos_team !== team
  ).length
  const play_stats = plays.map((p) => p.play_stats).flat()

  for (const play_stat of play_stats) {
    switch (play_stat.statId) {
      case 2:
        // punt block
        // clubCode belongs to possession team
        if (fixTeam(play_stat.clubCode) !== team) {
          dstStats.dblk += 1
        }
        break

      case 7:
        // third down failed
        break

      case 9:
        // fourth down failed
        dstStats.dfds += 1
        break

      case 10:
        // rushing yards
        dstStats.dya += play_stat.yards
        break

      case 11:
        // rushing touchdown
        dstStats.dya += play_stat.yards
        dstStats.dpa += 6
        break

      case 12:
        // lateral rush
        dstStats.dya += play_stat.yards
        break

      case 13:
        // lateral rushing touchdown
        dstStats.dya += play_stat.yards
        dstStats.dpa += 6
        break

      case 15:
        // completed pass
        dstStats.dya += play_stat.yards
        break

      case 16:
        // passing touchdown
        dstStats.dya += play_stat.yards
        dstStats.dpa += 6
        break

      case 19:
        // interception (passer)
        break

      case 20:
        // sack (team)
        dstStats.dya += play_stat.yards
        dstStats.dsk += 1
        break

      case 25:
        // interception
        dstStats.dint += 1
        break

      case 26:
        // interception return touchdown
        dstStats.dint += 1
        dstStats.dtd += 1
        break

      case 28:
        // interception return touchdown (lateral), no interception credited
        dstStats.dtd += 1
        break

      case 34:
        // punt return touchdown
        if (fixTeam(play_stat.clubCode) === team) {
          dstStats.prtd += 1
        }
        break

      case 36:
        // punt return touchdown (lateral)
        if (fixTeam(play_stat.clubCode) === team) {
          dstStats.prtd += 1
        }
        break

      case 46:
        // kickoff return touchdown
        dstStats.krtd += 1
        break

      case 48:
        // kickoff return touchdown (lateral)
        dstStats.krtd += 1
        break

      case 52:
        // forced fumble (offensive player)
        break

      case 55:
        // fumble recovery (offensive player recovery)
        break

      case 56:
        // fumble recovery touchdown (offensive player)
        if (fixTeam(play_stat.clubCode) !== team) {
          dstStats.dpa += 6
        }
        break

      case 57:
        // fumble lateral
        break

      case 58:
        // fumble recovery touchdown (lateral) (offensive player)
        dstStats.dpa += 6
        break

      case 59:
        // fumble recovery and return (defense)
        dstStats.drf += 1
        break

      case 60:
        // fumble return for touchdown (defense)
        if (fixTeam(play_stat.clubCode) === team) {
          dstStats.drf += 1
          dstStats.dtd += 1
        }
        break

      case 61:
        // fumble recovery (lateral) (no recovery) (defense)
        break

      case 62:
        // fumble recovery touchdown (lateral) (no recovery) (defense)
        dstStats.dtd += 1
        break

      case 64:
        // touchdown (team)
        if (fixTeam(play_stat.clubCode) === team) {
          dstStats.dtd += 1
        }
        break

      case 70:
        // made field goal
        if (fixTeam(play_stat.clubCode) !== team) {
          dstStats.dpa += 3
        }
        break

      case 71:
        // blocked field goal
        if (fixTeam(play_stat.clubCode) !== team) {
          dstStats.dblk += 1
        }
        break

      case 72:
        // made extra point
        if (fixTeam(play_stat.clubCode) !== team) {
          dstStats.dpa += 1
        }
        break

      case 74:
        // blocked extra point
        if (fixTeam(play_stat.clubCode) !== team) {
          dstStats.dblk += 1
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
        dstStats.dsf += 1
        break

      case 91:
        // forced fumble player
        if (fixTeam(play_stat.clubCode) === team) {
          dstStats.dff += 1
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
        if (fixTeam(play_stat.clubCode) === team) {
          dstStats.dtpr += 1
        }
        break

      case 420:
        // two point return
        dstStats.dtpr += 1
        break
    }
  }

  return dstStats
}

export default calculateDstStatsFromPlays
