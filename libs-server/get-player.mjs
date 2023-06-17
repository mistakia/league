import debug from 'debug'
import yargs from 'yargs'

import isMain from './is-main.mjs'
import { fixTeam, formatPlayerName, Errors, team_aliases } from '#libs-shared'
import db from '#db'

const argv = yargs.argv
const log = debug('get-player')
debug.enable('get-player')

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
  teams = [],
  dob,
  sleeper_id,
  keeptradecut_id,
  pfr_id,
  esbid,
  gsisid,
  pname
}) => {
  if (team_aliases[name]) {
    const result = await db('player').where({ pid: team_aliases[name] })
    return result[0]
  }

  const query = db('player')

  if (sleeper_id) {
    query.where({ sleeper_id })
  }

  if (keeptradecut_id) {
    query.where({ keeptradecut_id })
  } else if (pfr_id) {
    query.where({ pfr_id })
  } else if (esbid) {
    query.where({ esbid })
  } else if (gsisid) {
    query.where({ gsisid })
  } else {
    if (name) {
      const formatted = formatPlayerName(name)

      query.where({ formatted })
    }

    if (pname) {
      query.where({ pname })
    }

    if (pos) {
      if (typeof pos === 'string') {
        const p = fixPosition(pos)
        query.where(function () {
          this.where({ pos: p }).orWhere({ pos1: p }).orWhere({ pos2: p })
        })
      } else if (Array.isArray(pos)) {
        query.whereIn('pos', pos)
      }
    }

    if (team) {
      const t = fixTeam(team)
      query.where({ cteam: t })
    }

    if (dob) {
      query.where(function () {
        this.where({ dob }).orWhere({ dob: '0000-00-00' })
      })
    }

    if (teams.length) {
      query.whereIn('cteam', teams)
    }
  }

  const player_rows = await query
  if (player_rows.length > 1) {
    log(query.toString())
    throw new Errors.MatchedMultiplePlayers()
  }

  return player_rows.length ? player_rows[0] : undefined
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
    const player_row = await getPlayer(options)
    log(player_row)
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
