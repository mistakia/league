import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import isMain from './is-main.mjs'
import {
  fixTeam,
  formatPlayerName,
  Errors,
  team_aliases,
  constants
} from '#libs-shared'
import db from '#db'

const log = debug('get-player')
debug.enable('get-player')

const format_position = (pos) => {
  switch (pos.toUpperCase()) {
    case 'HB':
      return 'RB'

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
      return pos.toUpperCase()
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
  otc_id,
  pff_id,
  esbid,
  gsisid,
  pname,
  start,
  gsisItId,
  draftkings_id,

  ignore_retired = false,
  ignore_free_agent = false
}) => {
  if (team_aliases[name]) {
    const result = await db('player').where({ pid: team_aliases[name] })
    return result[0]
  }

  const query = db('player').select('player.*')

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
  } else if (gsisItId) {
    query.where({ gsisItId })
  } else if (otc_id) {
    query.where({ otc_id })
  } else if (pff_id) {
    query.where({ pff_id })
  } else if (draftkings_id) {
    query.where({ draftkings_id })
  } else {
    if (name) {
      const formatted = formatPlayerName(name)

      query.leftJoin('player_aliases', 'player.pid', 'player_aliases.pid')

      query.where(function () {
        this.where({ formatted }).orWhere({ formatted_alias: formatted })
      })
    }

    if (pname) {
      query.where({ pname })
    }

    if (pos) {
      if (typeof pos === 'string') {
        const p = format_position(pos)
        query.where(function () {
          this.where({ pos: p }).orWhere({ pos1: p }).orWhere({ pos2: p })
        })
      } else if (Array.isArray(pos)) {
        query.whereIn('pos', pos.map(format_position))
      }
    }

    if (team) {
      const t = fixTeam(team)
      query.where({ current_nfl_team: t })
    }

    if (dob) {
      query.where(function () {
        this.where({ dob }).orWhere({ dob: '0000-00-00' })
      })
    }

    if (teams.length) {
      const formatted_teams = teams.map(fixTeam)
      query.whereIn('current_nfl_team', formatted_teams)
    }

    if (ignore_retired) {
      query.where(function () {
        this.whereNot({
          nfl_status: constants.player_nfl_status.RETIRED
        }).orWhereNull('nfl_status')
      })
    }

    if (ignore_free_agent) {
      query.where(function () {
        this.whereNot({ current_nfl_team: 'INA' }).orWhereNull(
          'current_nfl_team'
        )
      })
    }

    if (start) {
      query.where({ start })
    }
  }

  const player_rows = await query
  if (player_rows.length > 1) {
    log(query.toString())
    throw new Errors.MatchedMultiplePlayers()
  }

  if (!player_rows.length) {
    log(`no player rows found for query: ${query.toString()}`)
    return undefined
  }

  return player_rows[0]
}

export default getPlayer

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv)).argv
    const options = {
      name: argv.name,
      pos: argv.pos,
      team: argv.team,
      ignore_retired: argv.ignore_retired,
      ignore_free_agent: argv.ignore_free_agent
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
