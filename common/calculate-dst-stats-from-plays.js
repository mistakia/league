import * as constants from './constants'

const calculateDstStatsFromPlays = (plays) => {
  const dstStats = constants.createDstStats()
  dstStats.tno = plays.filter(p => p.drivePlayCount === 3 && p.playTypeNFL === 'PUNT').length
  const playStats = plays.map(p => p.playStats).flat()

  for (const playStat of playStats) {
    switch (playStat.statId) {
      case 2:
        // punt block
        dstStats.blk += 1
        break

      case 7:
        // third down failed
        break

      case 9:
        // fourth down failed
        dstStats.fds += 1
        break

      case 10:
        // rushing yards
        dstStats.ya += playStat.yards
        break

      case 11:
        // rushing touchdown
        dstStats.ya += playStat.yards
        dstStats.pa += 6
        break

      case 12:
        // lateral rush
        dstStats.ya += playStat.yards
        break

      case 13:
        // lateral rushing touchdown
        dstStats.ya += playStat.yards
        dstStats.pa += 6
        break

      case 15:
        // completed pass
        dstStats.ya += playStat.yards
        break

      case 16:
        // passing touchdown
        dstStats.ya += playStat.yards
        dstStats.pa += 6
        break

      case 19:
        // interception
        dstStats.int += 1
        break

      case 20:
        // sack (team)
        dstStats.ya += playStat.yards
        dstStats.sk += 1
        break

      case 26:
        // interception return touchdown
        dstStats.int += 1
        dstStats.td += 1
        break

      case 28:
        // interception return touchdown (lateral)
        dstStats.int += 1
        dstStats.td += 1
        break

      case 52:
        // forced fumble
        dstStats.ff += 1
        break

      case 55:
        // fumble recovery
        dstStats.rf += 1
        break

      case 56:
        // fumble return touchdown
        // TODO - check if fumble recovery stat is needed
        dstStats.td += 1
        break

      case 57:
        // fumble lateral
        break

      case 58:
        // fumble return touchdown (lateral)
        dstStats.td += 1
        break

      case 59:
        // fumble recovery and return
        break

      case 60:
        // fumble return for touchdown
        dstStats.td += 1
        break

      case 61:
        // fumble recovery (lateral)
        break

      case 62:
        // fumble recovery touchdown (lateral)
        dstStats.td += 1
        break

      case 64:
        // touchdown (team)
        break

      case 70:
        // made field goal
        dstStats.pa += 3
        break

      case 71:
        // blocked field goal
        dstStats.blk += 1
        break

      case 72:
        // made extra point
        dstStats.pa += 1
        break

      case 74:
        // blocked extra point
        dstStats.blk += 1
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
        // punt block player (individual)
        break

      case 87:
        // blocked kick player (individual)
        break

      case 88:
        // blocked field goal player (individual)
        break

      case 89:
        // safety
        dstStats.sfty += 1
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
        dstStats.tpr += 1
        break
    }
  }

  return dstStats
}

export default calculateDstStatsFromPlays
