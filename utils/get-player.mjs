import debug from 'debug'
import yargs from 'yargs'

import isMain from './is-main.mjs'
import { fixTeam, formatPlayerName } from '#common'
import db from '#db'

const argv = yargs.argv
const log = debug('get-player')
debug.enable('get-player')

const aliases = {
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

const getPlayer = async ({
  name,
  pos,
  team,
  dob,
  sleeper_id,
  keeptradecut_id
}) => {
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
      const formatted = formatPlayerName(name)

      query.where({ formatted })
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

    if (dob) {
      query.where({ dob })
    }
  }



  const players = await query
  if (players.length > 1) {
    log(query.toString())
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
    log(options)
    const player = await getPlayer(options)
    log(player)
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
