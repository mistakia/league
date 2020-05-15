const db = require('../db')
const debug = require('debug')
const log = debug('league:player:get')

const aliases = {
  'Antonio Brown': 'AB-3500',
  'DK Metcalf': 'DM-2275',
  'Henry Ruggs': 'HR-0200',
  'KJ Hamler': 'KH-0250',
  'Michael Pittman Jr.': 'MP-1350',
  'Mark Ingram II': 'MI-0100',
  'Odell Beckham': 'OB-0075',
  'Robert Griffin III': 'RG-1850',
  'Steven Sims': 'SS-1537'
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
    lname,
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
