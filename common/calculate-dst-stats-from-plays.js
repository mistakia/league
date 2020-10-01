import * as constants from './constants'
import fixTeam from './fix-team'

const calculateDstStatsFromPlays = (plays, team) => {
  const dstStats = constants.createStats()
  dstStats.dtno = plays.filter(p => p.drivePlayCount === 3 && p.playTypeNFL === 'PUNT').length
  const playStats = plays.map(p => p.playStats.map(ps => ({
    possessionTeam: p.possessionTeam,
    ...ps
  }))).flat()

  for (const playStat of playStats) {
    if (fixTeam(playStat.possessionTeam) === team) {
      switch (playStat.statId) {
        case 34:
          dstStats.prtd += 1
          break

        case 36:
          dstStats.prtd += 1
          break

        case 45:
          dstStats.krtd += 1
          break

        case 48:
          dstStats.krtd += 1
          break
      }
      continue
    }

    switch (playStat.statId) {
      case 2:
        // punt block
        dstStats.dblk += 1
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
        dstStats.dya += playStat.yards
        break

      case 11:
        // rushing touchdown
        dstStats.dya += playStat.yards
        dstStats.dpa += 6
        break

      case 12:
        // lateral rush
        dstStats.dya += playStat.yards
        break

      case 13:
        // lateral rushing touchdown
        dstStats.dya += playStat.yards
        dstStats.dpa += 6
        break

      case 15:
        // completed pass
        dstStats.dya += playStat.yards
        break

      case 16:
        // passing touchdown
        dstStats.dya += playStat.yards
        dstStats.dpa += 6
        break

      case 19:
        // interception (passer)
        break

      case 20:
        // sack (team)
        dstStats.dya += playStat.yards
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

      case 52:
        // forced fumble
        dstStats.dff += 1
        break

      case 55:
        // fumble recovery (offensive player recovery)
        break

      case 56:
        // fumble recovery touchdown (offensive player)
        dstStats.dpa += 6
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
        dstStats.drf += 1
        dstStats.dtd += 1
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
        break

      case 70:
        // made field goal
        dstStats.dpa += 3
        break

      case 71:
        // blocked field goal
        dstStats.dblk += 1
        break

      case 72:
        // made extra point
        dstStats.dpa += 1
        break

      case 74:
        // blocked extra point
        dstStats.dblk += 1
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

      case 420:
        // two point return
        dstStats.dtpr += 1
        break
    }
  }

  return dstStats
}

export default calculateDstStatsFromPlays
