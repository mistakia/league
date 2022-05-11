import debug from 'debug'
import yargs from 'yargs'

import isMain from './is-main.mjs'
import { fixTeam } from '#common'
import db from '#db'

const argv = yargs.argv
const log = debug('league:player:get')

const aliases = {
  'AJ Dillon': 'AD-1184',
  'AJ Brown': 'AB-3150',
  'AJ Derby': 'AD-1175',
  'AJ Feeley': 'AF-0300',
  'AJ Green': 'AG-1500',
  'AJ Jenkins': 'AJ-0460',
  'AJ McCarron': 'AM-1150',
  'Allen Robinson II': 'AR-1250',
  'Anthony McFarland Jr': 'AM-1525',
  'Anthony McFarland Jr.': 'AM-1525',
  'Antonio Brown': 'AB-3500',
  'Antonio Gibson': 'AG-0725',
  'BJ Daniels': 'BD-0150',
  'Benny Snell': 'BS-2950',
  'Benny Snell Jr.': 'BS-2950',
  'Chris Herndon IV': 'CH-2950',
  'CJ Anderson': 'CA-0750',
  'CJ Beathard': 'CB-1145',
  'Darrell Henderson Jr.': 'DH-2325',
  'DAndre Swift': 'DS-5175',
  'Dante Fowler': 'DF-1481',
  'DJ Chark Jr.': 'DC-1418',
  'D.J. Chark Jr.': 'DC-1418',
  'DK Metcalf': 'DM-2275',
  'Duke Johnson Jr.': 'DJ-1850',
  'Dwayne Haskins': 'DH-1912',
  'Dwayne Haskins Jr.': 'DH-1912',
  'Gardner Minshew II': 'GM-1350',
  'Greg Ward': 'GW-0250',
  'Henry Ruggs': 'HR-0200',
  'Henry Ruggs III': 'HR-0200',
  'Irv Smith': 'IS-0275',
  'Irv Smith Jr': 'IS-0275',
  'Irv Smith Jr.': 'IS-0275',
  'JaMarr Chase': 'JC-0135',
  'JC Tretter': 'JT-3350',
  'Jedrick Wills': 'JW-4918',
  'Jeff Wilson Jr.': 'JW-4975',
  'JJ Arcega-Whiteside': 'JA-1975',
  'JK Dobbins': 'JD-2225',
  'JD McKissic': 'JM-3475',
  'Keelan Cole Sr.': 'KC-1550',
  'KJ Hamler': 'KH-0250',
  "La'Mical Perine": 'LP-0437',
  'Laviska Shenault': 'LS-0650',
  'Laviska Shenault Jr': 'LS-0650',
  'Laviska Shenault Jr.': 'LS-0650',
  'Lynn Bowden Jr.': 'LB-0775',
  'Mark Ingram II': 'MI-0100',
  'Marvin Jones Jr.': 'MJ-2250',
  'Melvin Gordon III': 'MG-1150',
  'Michael Gesicki': 'MG-0325',
  'Michael Pittman Jr.': 'MP-1350',
  'Michael Pittman Jr': 'MP-1350',
  'Miles Gaskin': 'MG-0293',
  'Nkeal Harry': 'NH-0825',
  'NKeal Harry': 'NH-0825',
  'Odell Beckham': 'OB-0075',
  'Odell Beckham Jr': 'OB-0075',
  'Odell Beckham Jr.': 'OB-0075',
  'OJ Howard': 'OH-0250',
  'Patrick Mahomes II': 'PM-0025',
  'Phillip Dorsett II': 'PD-0800',
  'Richie James Jr.': 'RJ-0450',
  'Robert Griffin III': 'RG-1850',
  'Robert Tonyan': 'RT-1250',
  'Ronald Jones II': 'RJ-2250',
  'Scotty Miller': 'SM-2653',
  'Steven Sims': 'SS-1537',
  'Terrace Marshall': 'TM-0135',
  'Terrace Marshall Jr.': 'TM-0135',
  'Todd Gurley II': 'TG-1950',
  'TY Hilton': 'TH-1850',
  'TySon Williams': 'TW-0105',
  'TJ Hockenson': 'TH-1875',
  'Will Fuller V': 'WF-0300',
  'Will Lutz': 'WL-0300',
  'William Fuller V': 'WF-0300',
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
  'Jacksonville (JAC)': 'JAX',
  'Kansas City (KC)': 'KC',
  'Los Angeles (LAC)': 'LAC',
  'Los Angeles (LAR)': 'LA',
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
  'Jaguars D/ST': 'JAX',
  'Jaguars DST': 'JAX',
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
  'Rams D/ST': 'LA',
  'Rams DST': 'LA',
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
  'Vikings DST': 'MIN',
  'Washington D/ST': 'WAS',
  'Washington DST': 'WAS',

  'Football Team DST': 'WAS',
  'Green Bay Packers': 'GB',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LA',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'San Francisco 49ers': 'SF',
  'Tampa Bay Buccaneers': 'TB',
  'Washington Football Team': 'WAS'
}

const nameAliases = {
  'DJ Moore': 'D.J. Moore'
}

const fixPosition = (pos) => {
  switch (pos) {
    case 'C':
      return 'OL'

    case 'CB':
      return 'DB'

    case 'DE':
      return 'DL'

    case 'DT':
      return 'DL'

    case 'OG':
      return 'OL'

    case 'OT':
      return 'OL'

    case 'S':
      return 'DB'

    default:
      return pos
  }
}

const getPlayer = async ({ name, pos, team, sleeper_id, keeptradecut_id }) => {
  if (aliases[name]) {
    const result = await db('player').where({ player: aliases[name] })
    return result[0]
  }

  const query = db('player')

  if (sleeper_id) {
    query.where({ sleeper_id })
  }

  if (keeptradecut_id) {
    query.where({ keeptradecut_id })
  } else {
    if (name) {
      const aname = nameAliases[name] || name
      const sname = aname.replace(/jr.|jr|sr.|sr|II|III/gi, '').trim()
      const fname = sname.split(' ').shift()
      const lname = sname.split(' ').splice(1).join(' ')

      query.where({
        fname,
        lname
      })
    }

    if (pos) {
      const p = fixPosition(pos)
      query.where(function () {
        this.where({ pos: p }).orWhere({ pos1: p }).orWhere({ pos2: p })
      })
    }

    if (team) {
      const t = fixTeam(team)
      query.where({ cteam: t })
    }
  }

  log(query.toString())

  const players = await query
  if (players.length > 1) {
    throw new Error('matched multiple players')
  }

  return players.length ? players[0] : undefined
}

export default getPlayer

const main = async () => {
  let error
  try {
    const options = {
      name: argv.name,
      pos: argv.pos,
      team: argv.team
    }
    console.log(options)
    const playerId = await getPlayer(options)
    console.log(playerId)
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
