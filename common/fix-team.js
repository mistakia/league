export default function (team) {
  team = team.toUpperCase()

  switch (team) {
    case 'ARZ':
      return 'ARI'

    case 'BLT':
      return 'BAL'

    case 'CLV':
      return 'CLE'

    case 'HST':
      return 'HOU'

    case 'KCC':
      return 'KC'

    case 'LVR':
      return 'LV'

    case 'SFO':
      return 'SF'

    case 'TBB':
      return 'TB'

    case 'FA':
      return 'INA'

    case 'NOS':
      return 'NO'

    case 'OAK':
      return 'LV'

    case 'GBP':
      return 'GB'

    case 'NEP':
      return 'NE'

    case 'LAR':
      return 'LA'

    case 'WSH':
      return 'WAS'

    case 'JAX':
      return 'JAC'

    default:
      return team
  }
}
