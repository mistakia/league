import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import is_main from './is-main.mjs'
import { fixTeam, format_player_name, Errors, team_aliases } from '#libs-shared'
import { player_nfl_status } from '#constants'
import db from '#db'

const log = debug('get-player')
debug.enable('get-player')

// Expand positions to include all equivalent positions for matching
// Also normalizes positions (e.g., HB -> RB, C -> OL) before expanding
const expand_position = (pos) => {
  const normalized_pos = pos.toUpperCase()

  // First normalize the position
  let normalized
  switch (normalized_pos) {
    case 'HB':
      normalized = 'RB'
      break
    case 'C':
      normalized = 'OL'
      break
    case 'CB':
      normalized = 'DB'
      break
    case 'DE':
      normalized = 'DL'
      break
    case 'DT':
      normalized = 'DL'
      break
    case 'OG':
      normalized = 'OL'
      break
    case 'OT':
      normalized = 'OL'
      break
    case 'S':
      normalized = 'DB'
      break
    case 'SAF':
      normalized = 'DB'
      break
    case 'G':
      normalized = 'OL'
      break
    case 'T':
      normalized = 'OL'
      break
    case 'DI':
      normalized = 'DL'
      break
    case 'ED':
      normalized = 'DL'
      break
    default:
      normalized = normalized_pos
  }

  // Then expand the normalized position
  switch (normalized) {
    // Defensive backs - all safety and corner variants
    case 'DB':
    case 'CB':
    case 'S':
    case 'SAF':
    case 'FS':
    case 'SS':
      return ['DB', 'CB', 'S', 'SAF', 'FS', 'SS']

    // Defensive line - all DL variants including edge rushers and OLBs (often cross-classified)
    case 'DL':
    case 'DE':
    case 'DT':
    case 'NT':
    case 'EDGE':
      return ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB']

    // Offensive line - all OL variants including long snappers (often listed as C)
    case 'OL':
    case 'OG':
    case 'OT':
    case 'C':
    case 'G':
    case 'T':
    case 'LS':
      return ['OL', 'OG', 'OT', 'C', 'G', 'T', 'LS']

    // Fullback can match RB
    case 'FB':
      return ['FB', 'RB']

    // Running back (includes normalized HB)
    case 'RB':
      return ['RB', 'HB']

    // Linebackers - all LB variants including edge rushers (often classified as DE/DL)
    case 'LB':
    case 'OLB':
    case 'ILB':
    case 'MLB':
      return ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL']

    default:
      return [normalized]
  }
}

const find_player_row = async ({
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
  nfl_draft_year,
  gsis_it_id,
  draftkings_id,
  fanduel_id,
  cbs_id,
  yahoo_id,
  rts_id,
  espn_id,
  nfl_id,
  mfl_id,
  sis_id,
  sportradar_id,
  underdog_id,

  ignore_retired = false,
  ignore_free_agent = false
}) => {
  if (team_aliases[name]) {
    const result = await db('player').where({ pid: team_aliases[name] })
    return result[0]
  }

  const query = db('player').select('player.*')

  // NOTE: the destructured parameters keep their external-system short names
  // (sleeper_id, espn_id, ...) as this resolver's stable lookup interface — the
  // values callers pass come from external feeds. Only the DB column keys on the
  // right of each `.where` conform to the new {system}_player_id column names.
  if (sleeper_id) {
    query.where({ sleeper_player_id: sleeper_id })
  }

  if (keeptradecut_id) {
    query.where({ keeptradecut_player_id: keeptradecut_id })
  } else if (pfr_id) {
    query.where({ pfr_player_id: pfr_id })
  } else if (esbid) {
    query.where({ esb_player_id: esbid })
  } else if (gsisid) {
    query.where({ gsis_player_id: gsisid })
  } else if (gsis_it_id) {
    query.where({ gsis_it_player_id: gsis_it_id })
  } else if (sportradar_id) {
    query.where({ sportradar_player_id: sportradar_id })
  } else if (otc_id) {
    query.where({ otc_player_id: otc_id })
  } else if (pff_id) {
    query.where({ pff_player_id: pff_id })
  } else if (draftkings_id) {
    query.where({ draftkings_player_id: draftkings_id })
  } else if (fanduel_id) {
    query.where({ fanduel_player_id: fanduel_id })
  } else if (cbs_id) {
    query.where({ cbs_player_id: cbs_id })
  } else if (yahoo_id) {
    query.where({ yahoo_player_id: yahoo_id })
  } else if (rts_id) {
    query.where({ rts_player_id: rts_id })
  } else if (espn_id) {
    query.where({ espn_player_id: espn_id })
  } else if (nfl_id) {
    query.where({ nfl_player_id: nfl_id })
  } else if (mfl_id) {
    query.where({ mfl_player_id: mfl_id })
  } else if (sis_id) {
    query.where({ sis_player_id: sis_id })
  } else if (underdog_id) {
    query.where({ underdog_player_id: underdog_id })
  } else {
    if (name) {
      const formatted = format_player_name(name)

      query.leftJoin('player_aliases', 'player.pid', 'player_aliases.pid')

      query.where(function () {
        this.where({ formatted_name: formatted }).orWhere({
          formatted_alias: formatted
        })
      })
    }

    if (pname) {
      query.where({ short_name: pname })
    }

    if (pos) {
      if (typeof pos === 'string') {
        const expanded = expand_position(pos)
        query.where(function () {
          this.whereIn('primary_position', expanded)
            .orWhereIn('secondary_position', expanded)
            .orWhereIn('tertiary_position', expanded)
        })
      } else if (Array.isArray(pos)) {
        const expanded_positions = pos.flatMap(expand_position)
        query.where(function () {
          this.whereIn('primary_position', expanded_positions)
            .orWhereIn('secondary_position', expanded_positions)
            .orWhereIn('tertiary_position', expanded_positions)
        })
      }
    }

    if (team) {
      const t = fixTeam(team)
      query.where({ current_nfl_team: t })
    }

    if (dob) {
      query.where(function () {
        this.where({ date_of_birth: dob }).orWhere({
          date_of_birth: '0000-00-00'
        })
      })
    }

    if (teams.length) {
      const formatted_teams = teams.map(fixTeam)
      query.whereIn('current_nfl_team', formatted_teams)
    }

    if (ignore_retired) {
      query.where(function () {
        this.whereNot({
          roster_status: player_nfl_status.RETIRED
        }).orWhereNull('roster_status')
      })
    }

    if (ignore_free_agent) {
      query.where(function () {
        this.whereNot({ current_nfl_team: 'INA' }).orWhereNull(
          'current_nfl_team'
        )
      })
    }

    if (nfl_draft_year) {
      query.where({ nfl_draft_year })
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

export default find_player_row

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('name', {
      describe: 'Player name',
      type: 'string'
    })
    .option('pos', {
      describe: 'Player position',
      type: 'string'
    })
    .option('team', {
      describe: 'Team abbreviation',
      type: 'string'
    })
    .option('ignore_retired', {
      describe: 'Ignore retired players',
      type: 'boolean',
      default: false
    })
    .option('ignore_free_agent', {
      describe: 'Ignore free agents',
      type: 'boolean',
      default: false
    })
    .help().argv
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const options = {
      name: argv.name,
      pos: argv.pos,
      team: argv.team,
      ignore_retired: argv.ignore_retired,
      ignore_free_agent: argv.ignore_free_agent
    }
    log(options)
    const player_row = await find_player_row(options)
    log(player_row)
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
