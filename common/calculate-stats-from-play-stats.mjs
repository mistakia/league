import * as constants from './constants.mjs'

const calculateStatsFromPlayStats = (playStats) => {
  const stats = constants.createStats()

  stats._fga = []
  stats._fgm = []

  for (const playStat of playStats) {
    switch (playStat.statId) {
      case 2:
        // punt block
        break

      case 3:
        // first down rush
        break

      case 4:
        // first down pass
        break

      case 5:
        // first down penalty
        break

      case 6:
        // third down converted
        break

      case 7:
        // third down failed
        break

      case 8:
        // fourth down converted
        break

      case 9:
        // fourth down failed
        break

      case 10:
        // rushing attempt w/ yards
        stats.ra += 1
        stats.ry += playStat.yards
        break

      case 11:
        // rushing touchdown
        stats.ra += 1
        stats.ry += playStat.yards
        stats.tdr += 1
        break

      case 12:
        // lateral rush
        // stats.ra += 1
        stats.ry += playStat.yards
        break

      case 13:
        // lateral rushing touchdown
        // stats.ra += 1
        stats.ry += playStat.yards
        stats.tdr += 1
        break

      case 14:
        // incomplete pass
        stats.pa += 1
        break

      case 15:
        // completed pass
        stats.pa += 1
        stats.pc += 1
        stats.py += playStat.yards
        break

      case 16:
        // passing touchdown
        stats.pa += 1
        stats.pc += 1
        stats.py += playStat.yards
        stats.tdp += 1
        break

      case 19:
        // interception
        stats.ints += 1
        stats.pa += 1
        break

      case 20:
        // sack (team)
        break

      case 21:
        // receiving yards
        stats.rec += 1
        stats.recy += playStat.yards
        break

      case 22:
        // receiving touchdown
        stats.rec += 1
        stats.tdrec += 1
        stats.recy += playStat.yards
        break

      case 23:
        // lateral receiving yards
        stats.recy += playStat.yards
        break

      case 24:
        // lateral receving touchdown
        stats.recy += playStat.yards
        stats.tdrec += 1
        break

      case 25:
        // interception return
        break

      case 26:
        // interception return touchdown
        break

      case 27:
        // interception return (lateral)
        break

      case 28:
        // interception return touchdown (lateral)
        break

      case 29:
        // punt yards
        break

      case 30:
        // punt inside 20
        break

      case 31:
        // punt into endzone
        break

      case 32:
        // punt
        break

      case 33:
        // punt return yards
        break

      case 34:
        // punt return touchdown
        stats.prtd += 1
        break

      case 35:
        // punt return (lateral)
        break

      case 36:
        // punt return touchdown (lateral)
        stats.prtd += 1
        break

      case 37:
        // punt out of bounds
        break

      case 38:
        // punt downed
        break

      case 39:
        // punt fair caught
        break

      case 40:
        // punt attempt
        break

      case 41:
        // kickoff (yards)
        break

      case 42:
        // kickoff inside 20
        break

      case 43:
        // kickoff in endzone
        break

      case 44:
        // kickoff attempt (no yards)
        break

      case 45:
        // kickoff return
        break

      case 46:
        // kickoff return touchdown
        stats.krtd += 1
        break

      case 47:
        // kickoff return (lateral)
        break

      case 48:
        // kickoff return touchdown (lateral)
        stats.krtd += 1
        break

      case 49:
        // kickoff out of bounds
        break

      case 50:
        // kickoff fair caught
        break

      case 51:
        // kickoff attempt
        break

      case 52:
        // forced fumble
        break

      case 53:
        // fumble not forced
        break

      case 54:
        // fumble out of bounsd
        break

      case 55:
        // fumble recovery and return
        break

      case 56:
        // fumble return for touchdown
        break

      case 57:
        // fumble return lateral
        break

      case 58:
        // fumble return touchdown (lateral)
        break

      case 59:
        // fumble recovery and return
        break

      case 60:
        // fumble return for touchdown
        break

      case 61:
        // fumble recovery (lateral)
        break

      case 62:
        // fumble recovery touchdown (lateral)
        break

      case 63:
        // unknown
        break

      case 64:
        // touchdown (team)
        break

      case 68:
        // timeout
        break

      case 69:
        // missed field goal
        stats.fga += 1
        stats._fga.push(playStat.yards)
        break

      case 70:
        // made field goal
        stats.fgm += 1
        stats.fga += 1
        stats.fgy += Math.max(playStat.yards, 30)
        stats._fgm.push(playStat.yards)
        if (playStat.yards < 20) {
          stats.fg19 += 1
        } else if (playStat.yards < 30) {
          stats.fg29 += 1
        } else if (playStat.yards < 40) {
          stats.fg39 += 1
        } else if (playStat.yards < 50) {
          stats.fg49 += 1
        } else {
          stats.fg50 += 1
        }
        break

      case 71:
        // blocked field goal
        break

      case 72:
        // made extra point
        stats.xpa += 1
        stats.xpm += 1
        break

      case 73:
        // missed extra point
        stats.xpa += 1
        break

      case 74:
        // blocked extra point
        break

      case 75:
        // two point rush good
        stats.twoptc += 1
        stats.ra += 1
        break

      case 76:
        // two point rush failed
        stats.ra += 1
        break

      case 77:
        // two point pass good
        stats.twoptc += 1
        break

      case 78:
        // two point pass failed
        break

      case 79:
        // solo tackle
        break

      case 80:
        // assist tackle
        break

      case 82:
        // assist tackle
        break

      case 83:
        // sack (individual palyer)
        break

      case 84:
        // assisted sack (individual player)
        break

      case 85:
        // pass defense
        break

      case 86:
        // punt block player
        break

      case 87:
        // blocked kick player
        break

      case 88:
        // blocked field goal player
        break

      case 89:
        // safety
        break

      case 91:
        // forced fumble player
        break

      case 93:
        // penalty player and yards
        break

      case 95:
        // tackle for a loss
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

      case 102:
        // kickoff downed
        break

      case 103:
        // lateral sack player
        break

      case 104:
        // two point pass reception good
        stats.twoptc += 1
        break

      case 105:
        // two point pass reception failed
        break

      case 106:
        // fumble lost
        stats.fuml += 1
        break

      case 107:
        // own kickoff recovery
        break

      case 108:
        // own kickoff recovery touchdown
        break

      // qb hit player
      case 110:
        break

      case 111:
        // completed air yard passing
        break

      case 112:
        // incomplete air yard passing
        break

      case 113:
        // yards after catch
        break

      case 115:
        // target player
        stats.trg += 1
        break

      case 120:
        // tackle for loss player
        break

      case 301:
        // extra point aborted
        break

      case 402:
        // unknown
        break

      case 403:
        // defensive two point attempt
        break

      case 404:
        // defensive two point conv
        break

      case 405:
        // defensive extra point attempt
        break

      case 406:
        // defensive extra point conv
        break

      case 410:
        // kickoff attempt player
        break

      case 420:
        // two point return
        break

      default:
        break
    }
  }

  return stats
}

export default calculateStatsFromPlayStats
