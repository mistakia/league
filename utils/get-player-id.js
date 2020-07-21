const db = require('../db')
const debug = require('debug')
const log = debug('league:player:get')

const aliases = {
  'AJ Dillon': 'AD-1184',
  'Allen Robinson II': 'AR-1250',
  'Antonio Brown': 'AB-3500',
  'Darrell Henderson Jr.': 'DH-2325',
  'DJ Chark Jr.': 'DC-1418',
  'DK Metcalf': 'DM-2275',
  'DJ Moore': 'DM-2850',
  'Dwayne Haskins Jr.': 'DH-1912',
  'Gardner Minshew II': 'GM-1350',
  'Henry Ruggs': 'HR-0200',
  'Irv Smith': 'IS-0275',
  'KJ Hamler': 'KH-0250',
  'Marvin Jones Jr.': 'MJ-2250',
  'Michael Pittman Jr.': 'MP-1350',
  'Mark Ingram II': 'MI-0100',
  'Odell Beckham': 'OB-0075',
  'Robert Griffin III': 'RG-1850',
  'Ronald Jones II': 'RJ-2250',
  'Steven Sims': 'SS-1537',
  'Todd Gurley II': 'TG-1950',
  'Will Fuller V': 'WF-0300',

  'Arizona (ARI)': 'ARI',
  'Atlanta (ATL)': 'ATL',
  'Baltimore (BAL)': 'BAL',
  'Buffalo (BUF)': 'BUF',
  'Carolina (CAR)': 'CAR',
  'Chicago (CHI)': 'CHI',
  'Cincinnati (CIN)': 'CIN',
  'Cleveland (CLE)': 'CLE',
  'Dallas (DAL)': 'DAL',
  'Denver (DEN)': 'DEN',
  'Detroit (DET)': 'DET',
  'Green Bay (GB)': 'GB',
  'Houston (HOU)': 'HOU',
  'Indianapolis (IND)': 'IND',
  'Jacksonville (JAC)': 'JAC',
  'Kansas City (KC)': 'KC',
  'Los Angeles (LAC)': 'LAC',
  'Los Angeles (LAR)': 'LAR',
  'Las Vegas (LV)': 'LV',
  'Miami (MIA)': 'MIA',
  'Minnesota (MIN)': 'MIN',
  'New England (NE)': 'NE',
  'New Orleans (NO)': 'NO',
  'New York (NYG)': 'NYG',
  'New York (NYJ)': 'NYJ',
  'Philadelphia (PHI)': 'PHI',
  'Pittsburgh (PIT)': 'PIT',
  'Seattle (SEA)': 'SEA',
  'San Francisco (SF)': 'SF',
  'Tampa Bay (TB)': 'TB',
  'Tennessee (TEN)': 'TEN',
  'Washington (WAS)': 'WAS',

  '49ers D/ST': 'SF',
  'Bears D/ST': 'CHI',
  'Bengals D/ST': 'CIN',
  'Bills D/ST': 'BUF',
  'Broncos D/ST': 'DEN',
  'Browns D/ST': 'CLE',
  'Buccaneers D/ST': 'TB',
  'Cardinals D/ST': 'ARI',
  'Chargers D/ST': 'LAC',
  'Chiefs D/ST': 'KC',
  'Colts D/ST': 'IND',
  'Cowboys D/ST': 'DAL',
  'Dolphins D/ST': 'MIA',
  'Eagles D/ST': 'PHI',
  'Falcons D/ST': 'ATL',
  'Giants D/ST': 'NYG',
  'Jaguars D/ST': 'JAC',
  'Jets D/ST': 'NYJ',
  'Lions D/ST': 'DET',
  'Packers D/ST': 'GB',
  'Panthers D/ST': 'CAR',
  'Patriots D/ST': 'NE',
  'Raiders D/ST': 'LV',
  'Rams D/ST': 'LAR',
  'Ravens D/ST': 'BAL',
  'Redskins D/ST': 'WAS',
  'Saints D/ST': 'NO',
  'Seahawks D/ST': 'SEA',
  'Steelers D/ST': 'PIT',
  'Texans D/ST': 'HOU',
  'Titans D/ST': 'TEN',
  'Vikings D/ST': 'MIN'

}

const fixTeam = (team) => {
  team = team.toUpperCase()

  switch (team) {
    case 'ARZ':
      return 'ARI'

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

const getPlayerId = async ({ name, pos, team }) => {
  if (aliases[name]) {
    return aliases[name]
  }

  const fname = name.split(' ').shift()
  const lname = name.split(' ').splice(1).join(' ')

  const query = db('player').select('player').where({
    fname,
    lname
  })

  if (pos) {
    query.where({ pos1: pos })
  }

  if (team) {
    const t = fixTeam(team)
    query.where({ cteam: t })
  }

  log(query.toString())

  const players = await query
  if (players.length > 1) {
    throw new Error('matched multiple players')
  }

  return players.length ? players[0].player : undefined
}

module.exports = getPlayerId
