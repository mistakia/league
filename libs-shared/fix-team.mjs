export default function (team) {
  team = team ? team.toUpperCase() : null

  switch (team) {
    case 'FA':
    case undefined:
    case null:
      return 'INA'

    case 'ARIZONA CARDINALS':
    case 'CARDINALS':
    case 'ARI':
    case 'ARZ':
      return 'ARI'

    case 'ATLANTA FALCONS':
    case 'FALCONS':
    case 'ATL':
      return 'ATL'

    case 'BALTIMORE RAVENS':
    case 'RAVENS':
    case 'BAL':
    case 'BLT':
      return 'BAL'

    case 'BUFFALO BILLS':
    case 'BILLS':
    case 'BUF':
      return 'BUF'

    case 'CAROLINA PANTHERS':
    case 'PANTHERS':
    case 'CAR':
      return 'CAR'

    case 'CHICAGO BEARS':
    case 'BEARS':
    case 'CHI':
      return 'CHI'

    case 'CINCINNATI BENGALS':
    case 'BENGALS':
    case 'CIN':
      return 'CIN'

    case 'CLEVELAND BROWNS':
    case 'BROWNS':
    case 'CLE':
    case 'CLV':
      return 'CLE'

    case 'DALLAS COWBOYS':
    case 'COWBOYS':
    case 'DAL':
      return 'DAL'

    case 'DENVER BRONCOS':
    case 'BRONCOS':
    case 'DEN':
      return 'DEN'

    case 'DETROIT LIONS':
    case 'LIONS':
    case 'DET':
      return 'DET'

    case 'GREEN BAY PACKERS':
    case 'PACKERS':
    case 'GB':
    case 'GBP':
    case 'GNB':
      return 'GB'

    case 'HOUSTON TEXANS':
    case 'TEXANS':
    case 'HOU':
    case 'HST':
      return 'HOU'

    case 'INDIANAPOLIS COLTS':
    case 'COLTS':
    case 'IND':
      return 'IND'

    case 'JACKSONVILLE JAGUARS':
    case 'JAGUARS':
    case 'JAX':
    case 'JAC':
      return 'JAX'

    case 'KANSAS CITY CHIEFS':
    case 'CHIEFS':
    case 'KC':
    case 'KCC':
    case 'KAN':
      return 'KC'

    case 'LOS ANGELES CHARGERS':
    case 'CHARGERS':
    case 'LAC':
    case 'SDC':
    case 'SDG':
    case 'SD':
      return 'LAC'

    case 'LOS ANGELES RAMS':
    case 'RAMS':
    case 'LAR':
    case 'LA':
    case 'STL':
      return 'LA'

    case 'MIAMI DOLPHINS':
    case 'DOLPHINS':
    case 'MIA':
      return 'MIA'

    case 'MINNESOTA VIKINGS':
    case 'VIKINGS':
    case 'MIN':
      return 'MIN'

    case 'NEW ENGLAND PATRIOTS':
    case 'PATRIOTS':
    case 'NE':
    case 'NEP':
    case 'NWE':
      return 'NE'

    case 'NEW ORLEANS SAINTS':
    case 'SAINTS':
    case 'NO':
    case 'NOS':
    case 'NOR':
      return 'NO'

    case 'NEW YORK GIANTS':
    case 'GIANTS':
    case 'NYG':
      return 'NYG'

    case 'NEW YORK JETS':
    case 'JETS':
    case 'NYJ':
      return 'NYJ'

    case 'LAS VEGAS RAIDERS':
    case 'OAKLAND RAIDERS':
    case 'RAIDERS':
    case 'OAK':
    case 'LV':
    case 'LVR':
      return 'LV'

    case 'PHILADELPHIA EAGLES':
    case 'EAGLES':
    case 'PHI':
      return 'PHI'

    case 'PITTSBURGH STEELERS':
    case 'STEELERS':
    case 'PIT':
      return 'PIT'

    case 'SAN FRANCISCO 49ERS':
    case '49ERS':
    case 'SF':
    case 'SFO':
      return 'SF'

    case 'SEATTLE SEAHAWKS':
    case 'SEAHAWKS':
    case 'SEA':
      return 'SEA'

    case 'TAMPA BAY BUCCANEERS':
    case 'BUCCANEERS':
    case 'TB':
    case 'TAM':
    case 'TBB':
      return 'TB'

    case 'TENNESSEE TITANS':
    case 'TITANS':
    case 'TEN':
    case 'OTI':
      return 'TEN'

    case 'WASHINGTON REDSKINS':
    case 'WASHINGTON FOOTBALL TEAM':
    case 'WASHINGTON COMMANDERS':
    case 'COMMANDERS':
    case 'REDSKINS':
    case 'WSH':
    case 'WAS':
      return 'WAS'

    default:
      throw new Error(`Invalid team: ${team}`)
  }
}
