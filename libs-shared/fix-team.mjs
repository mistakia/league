export default function (team) {
  team = team ? team.toUpperCase().trim() : null

  switch (team) {
    case 'FA':
    case 'INA':
    case undefined:
    case null:
    case 'FA*':
      return 'INA'

    case 'AFC':
      return 'AFC'

    case 'NFC':
      return 'NFC'

    case 'ARIZONA CARDINALS':
    case 'CARDINALS':
    case 'ARI':
    case 'ARZ':
    case 'ARI CARDINALS':
      return 'ARI'

    case 'ATLANTA FALCONS':
    case 'FALCONS':
    case 'ATL':
    case 'ATL FALCONS':
      return 'ATL'

    case 'BALTIMORE RAVENS':
    case 'RAVENS':
    case 'BAL':
    case 'BLT':
    case 'BAL RAVENS':
      return 'BAL'

    case 'BUFFALO BILLS':
    case 'BILLS':
    case 'BUF':
    case 'BUF BILLS':
      return 'BUF'

    case 'CAROLINA PANTHERS':
    case 'PANTHERS':
    case 'CAR':
    case 'CAR PANTHERS':
      return 'CAR'

    case 'CHICAGO BEARS':
    case 'BEARS':
    case 'CHI':
    case 'CHI BEARS':
      return 'CHI'

    case 'CINCINNATI BENGALS':
    case 'BENGALS':
    case 'CIN':
    case 'CIN BENGALS':
      return 'CIN'

    case 'CLEVELAND BROWNS':
    case 'BROWNS':
    case 'CLE':
    case 'CLV':
    case 'CLE BROWNS':
      return 'CLE'

    case 'DALLAS COWBOYS':
    case 'COWBOYS':
    case 'DAL':
    case 'DAL COWBOYS':
      return 'DAL'

    case 'DENVER BRONCOS':
    case 'BRONCOS':
    case 'DEN':
    case 'DEN BRONCOS':
      return 'DEN'

    case 'DETROIT LIONS':
    case 'LIONS':
    case 'DET':
    case 'DET LIONS':
      return 'DET'

    case 'GREEN BAY PACKERS':
    case 'PACKERS':
    case 'GB':
    case 'GBP':
    case 'GNB':
    case 'GB PACKERS':
      return 'GB'

    case 'HOUSTON TEXANS':
    case 'TEXANS':
    case 'HOU':
    case 'HST':
    case 'HOU TEXANS':
      return 'HOU'

    case 'INDIANAPOLIS COLTS':
    case 'COLTS':
    case 'IND':
    case 'IND COLTS':
      return 'IND'

    case 'JACKSONVILLE JAGUARS':
    case 'JAGUARS':
    case 'JAX':
    case 'JAC':
    case 'JAX JAGUARS':
      return 'JAX'

    case 'KANSAS CITY CHIEFS':
    case 'CHIEFS':
    case 'KC':
    case 'KCC':
    case 'KAN':
    case 'KAN CHIEFS':
    case 'KC CHIEFS':
      return 'KC'

    case 'LOS ANGELES CHARGERS':
    case 'CHARGERS':
    case 'LAC':
    case 'SDC':
    case 'SDG':
    case 'SD':
    case 'LAC CHARGERS':
    case 'LA CHARGERS':
      return 'LAC'

    case 'LOS ANGELES RAMS':
    case 'RAMS':
    case 'LAR':
    case 'LA':
    case 'STL':
    case 'RAM':
    case 'LAR RAMS':
    case 'LA RAMS':
      return 'LA'

    case 'MIAMI DOLPHINS':
    case 'DOLPHINS':
    case 'MIA':
    case 'MIA DOLPHINS':
      return 'MIA'

    case 'MINNESOTA VIKINGS':
    case 'VIKINGS':
    case 'MIN':
    case 'MIN VIKINGS':
      return 'MIN'

    case 'NEW ENGLAND PATRIOTS':
    case 'PATRIOTS':
    case 'NE':
    case 'NEP':
    case 'NWE':
    case 'NE PATRIOTS':
      return 'NE'

    case 'NEW ORLEANS SAINTS':
    case 'SAINTS':
    case 'NO':
    case 'NOS':
    case 'NOR':
    case 'NO SAINTS':
      return 'NO'

    case 'NEW YORK GIANTS':
    case 'GIANTS':
    case 'NYG':
    case 'NYG GIANTS':
    case 'NY GIANTS':
      return 'NYG'

    case 'NEW YORK JETS':
    case 'JETS':
    case 'NYJ':
    case 'NYJ JETS':
    case 'NY JETS':
      return 'NYJ'

    case 'LAS VEGAS RAIDERS':
    case 'OAKLAND RAIDERS':
    case 'RAIDERS':
    case 'OAK':
    case 'LV':
    case 'LVR':
    case 'LV RAIDERS':
      return 'LV'

    case 'PHILADELPHIA EAGLES':
    case 'EAGLES':
    case 'PHI':
    case 'PHI EAGLES':
      return 'PHI'

    case 'PITTSBURGH STEELERS':
    case 'STEELERS':
    case 'PIT':
    case 'PIT STEELERS':
      return 'PIT'

    case 'SAN FRANCISCO 49ERS':
    case '49ERS':
    case 'SF':
    case 'SFO':
    case 'SF 49ERS':
      return 'SF'

    case 'SEATTLE SEAHAWKS':
    case 'SEAHAWKS':
    case 'SEA':
    case 'SEA SEAHAWKS':
      return 'SEA'

    case 'TAMPA BAY BUCCANEERS':
    case 'BUCCANEERS':
    case 'TB':
    case 'TAM':
    case 'TBB':
    case 'TB BUCCANEERS':
      return 'TB'

    case 'TENNESSEE TITANS':
    case 'TITANS':
    case 'TEN':
    case 'OTI':
    case 'OILERS':
    case 'TEN TITANS':
      return 'TEN'

    case 'WASHINGTON REDSKINS':
    case 'WASHINGTON FOOTBALL TEAM':
    case 'WASHINGTON COMMANDERS':
    case 'WASHINGTON':
    case 'COMMANDERS':
    case 'REDSKINS':
    case 'WSH':
    case 'WAS':
    case 'WAS COMMANDERS':
      return 'WAS'

    default:
      throw new Error(`Invalid team: ${team}`)
  }
}
