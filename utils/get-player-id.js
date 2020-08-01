const db = require('../db')
const debug = require('debug')
const log = debug('league:player:get')
const fixTeam = require('./fix-team')

const aliases = {
  'AJ Dillon': 'AD-1184',
  'Allen Robinson II': 'AR-1250',
  'Antonio Brown': 'AB-3500',
  'Antonio Gibson': 'AG-0725',
  'Darrell Henderson Jr.': 'DH-2325',
  'DJ Chark Jr.': 'DC-1418',
  'D.J. Chark Jr.': 'DC-1418',
  'DJ Moore': 'DM-2850',
  'DK Metcalf': 'DM-2275',
  'Duke Johnson Jr.': 'DJ-1850',
  'Dwayne Haskins Jr.': 'DH-1912',
  'Gardner Minshew II': 'GM-1350',
  'Henry Ruggs': 'HR-0200',
  'Irv Smith': 'IS-0275',
  'KJ Hamler': 'KH-0250',
  'Marvin Jones Jr.': 'MJ-2250',
  'Melvin Gordon III': 'MG-1150',
  'Michael Pittman Jr.': 'MP-1350',
  'Mark Ingram II': 'MI-0100',
  'Odell Beckham': 'OB-0075',
  'Robert Griffin III': 'RG-1850',
  'Ronald Jones II': 'RJ-2250',
  'Steven Sims': 'SS-1537',
  'Todd Gurley II': 'TG-1950',
  'Will Fuller V': 'WF-0300',
  'Willie Snead IV': 'WS-0925',

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
  '49ers DST': 'SF',
  'Bears D/ST': 'CHI',
  'Bears DST': 'CHI',
  'Bengals D/ST': 'CIN',
  'Bengals DST': 'CIN',
  'Bills D/ST': 'BUF',
  'Bills DST': 'BUF',
  'Broncos D/ST': 'DEN',
  'Broncos DST': 'DEN',
  'Browns D/ST': 'CLE',
  'Browns DST': 'CLE',
  'Buccaneers D/ST': 'TB',
  'Buccaneers DST': 'TB',
  'Cardinals D/ST': 'ARI',
  'Cardinals DST': 'ARI',
  'Chargers D/ST': 'LAC',
  'Chargers DST': 'LAC',
  'Chiefs D/ST': 'KC',
  'Chiefs DST': 'KC',
  'Colts D/ST': 'IND',
  'Colts DST': 'IND',
  'Cowboys D/ST': 'DAL',
  'Cowboys DST': 'DAL',
  'Dolphins D/ST': 'MIA',
  'Dolphins DST': 'MIA',
  'Eagles D/ST': 'PHI',
  'Eagles DST': 'PHI',
  'Falcons D/ST': 'ATL',
  'Falcons DST': 'ATL',
  'Giants D/ST': 'NYG',
  'Giants DST': 'NYG',
  'Jaguars D/ST': 'JAC',
  'Jaguars DST': 'JAC',
  'Jets D/ST': 'NYJ',
  'Jets DST': 'NYJ',
  'Lions D/ST': 'DET',
  'Lions DST': 'DET',
  'Packers D/ST': 'GB',
  'Packers DST': 'GB',
  'Panthers D/ST': 'CAR',
  'Panthers DST': 'CAR',
  'Patriots D/ST': 'NE',
  'Patriots DST': 'NE',
  'Raiders D/ST': 'LV',
  'Raiders DST': 'LV',
  'Rams D/ST': 'LAR',
  'Rams DST': 'LAR',
  'Ravens D/ST': 'BAL',
  'Ravens DST': 'BAL',
  'Redskins D/ST': 'WAS',
  'Redskins DST': 'WAS',
  'Saints D/ST': 'NO',
  'Saints DST': 'NO',
  'Seahawks D/ST': 'SEA',
  'Seahawks DST': 'SEA',
  'Steelers D/ST': 'PIT',
  'Steelers DST': 'PIT',
  'Texans D/ST': 'HOU',
  'Texans DST': 'HOU',
  'Titans D/ST': 'TEN',
  'Titans DST': 'TEN',
  'Vikings D/ST': 'MIN',
  'Vikings DST': 'MIN'

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
