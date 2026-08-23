import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import is_main from './is-main.mjs'
import { fixTeam, format_player_name, Errors, team_aliases } from '#libs-shared'
import { normalize_position } from '#libs-shared/constants/position-constants.mjs'
import { player_nfl_status } from '#constants'
import db from '#db'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('get-player')
enable_debug_namespaces('get-player')

// Match tolerance for a position lookup. Every value here is a legal stored
// value: these lists are matched against primary/secondary/tertiary_position,
// all three of which carry a CHECK constraint on position_vocabulary, so an
// alias in an expansion is dead weight in the whereIn. Vendor and side-qualified
// spellings are folded by normalize_position before the table is consulted --
// this file owns tolerance only, not a second normalizer.
const OFFENSIVE_LINE = ['OL', 'T', 'G', 'C', 'LS']
const DEFENSIVE_LINE = ['DL', 'DE', 'DT', 'NT', 'EDGE']
const LINEBACKER = ['LB', 'OLB', 'ILB', 'MLB']
const DEFENSIVE_BACK = ['DB', 'CB', 'S']

const tolerance = ({ keys, expansion }) =>
  Object.fromEntries(keys.map((key) => [key, expansion]))

// K and P are deliberately absent, and must stay absent: the player table
// carries BOTH conventions (207 rows 'P', 557 'K'), and 38 name groups hold the
// same specialist under each, so a K/P tolerance set would turn 38
// currently-clean lookups into MatchedMultiplePlayers across every
// find_player_row caller. LS is grouped with the offensive line rather than with
// the other specialists because long snappers are routinely listed as C.
const POSITION_MATCH_TOLERANCE = {
  ...tolerance({ keys: OFFENSIVE_LINE, expansion: OFFENSIVE_LINE }),

  // Edge rushers are cross-classified between the front seven, so each of these
  // two reaches into the other. The reach is asymmetric on purpose: the line
  // reaches only the outside linebackers, while a linebacker lookup reaches the
  // whole edge of the line.
  ...tolerance({
    keys: DEFENSIVE_LINE,
    expansion: [...DEFENSIVE_LINE, 'LB', 'OLB']
  }),
  ...tolerance({
    keys: LINEBACKER,
    expansion: [...LINEBACKER, 'EDGE', 'DE', 'DL']
  }),

  ...tolerance({ keys: DEFENSIVE_BACK, expansion: DEFENSIVE_BACK }),

  // A fullback is routinely listed as a running back. One-way on purpose --
  // widening every RB lookup to fullbacks is a much larger blast radius.
  FB: ['FB', 'RB']
}

// Expand a position into the stored values a lookup for it should match.
export const expand_position = (pos) => {
  let normalized
  try {
    normalized = normalize_position(pos)
  } catch {
    // An unmapped code self-expands and matches nothing, which is what today's
    // callers already handle. Throwing here is a real improvement and a much
    // wider blast radius -- several of the ~100 find_player_row call sites mint
    // a player on undefined -- so it belongs in its own change. It is also what
    // keeps PFF's ALIGNMENT spellings (LWR, SRWR, DRT) falling through: those
    // report where a player lined up rather than his roster position and are
    // folded at the archive boundary, not here.
    normalized = String(pos).trim().toUpperCase()
  }

  // normalize_position spells absent as null. Dropping the element is
  // equivalent in effect to the '' this used to return -- both match nothing --
  // and keeps a junk value out of the whereIn.
  if (!normalized) {
    return []
  }

  return POSITION_MATCH_TOLERANCE[normalized] || [normalized]
}

// The lookup below resolves exactly ONE dimension per call: an else-if ladder over
// the external id columns, exclusive with the name/date-of-birth branch in its else.
// So a call bundling two dimensions gets one honored and the rest silently dropped,
// which yields a confident WRONG match rather than an abstention. Measured against a
// scratch database: {pfr_player_id, esb_player_id} naming two different people
// returns the pfr row (first in ladder order) and ignores the esb id; {esb_player_id,
// name} where the name belongs to someone else returns the esb row and ignores the
// name. Refuse the shape instead of silently picking for the caller -- resolve one
// dimension per call and fall back explicitly, which is what every call site that
// mints on a miss already does (see scripts/import-players-combine-profiles.mjs).
//
// Note this is why bundling was never merely unhelpful: undefined is
// indistinguishable from "no such player" at every call site, and a caller that
// mints on undefined mints a duplicate person.
const EXTERNAL_ID_LOOKUP_PARAMS = [
  'sleeper_player_id',
  'keeptradecut_player_id',
  'pfr_player_id',
  'esb_player_id',
  'gsis_player_id',
  'gsis_it_player_id',
  'sportradar_player_id',
  'otc_player_id',
  'pff_player_id',
  'draftkings_player_id',
  'fanduel_player_id',
  'cbs_player_id',
  'yahoo_player_id',
  'rts_player_id',
  'espn_player_id',
  'nfl_player_id',
  'mfl_player_id',
  'sis_player_id',
  'underdog_player_id',
  'fleaflicker_player_id',
  'ffpc_player_id',
  'nffc_player_id',
  'fantrax_player_id',
  'fantasypoints_player_id'
]

// Every parameter the id ladder drops on the floor when it takes a branch.
const NAME_BRANCH_LOOKUP_PARAMS = [
  'name',
  'short_name',
  'pos',
  'team',
  'teams',
  'date_of_birth',
  'nfl_draft_year',
  'ignore_retired',
  'ignore_free_agent'
]

const assert_single_lookup_dimension = (params) => {
  const is_provided = (key) => {
    const value = params[key]
    if (Array.isArray(value)) return value.length > 0
    return Boolean(value)
  }

  const external_ids = EXTERNAL_ID_LOOKUP_PARAMS.filter(is_provided)
  if (!external_ids.length) return

  if (external_ids.length > 1) {
    throw new Errors.AmbiguousPlayerLookup(
      `find_player_row received multiple external ids (${external_ids.join(
        ', '
      )}); the id lookup honors only the first and silently ignores the rest. Look each id up in its own call and fall back explicitly.`
    )
  }

  const dropped = NAME_BRANCH_LOOKUP_PARAMS.filter(is_provided)
  if (dropped.length) {
    throw new Errors.AmbiguousPlayerLookup(
      `find_player_row received ${external_ids[0]} together with ${dropped.join(
        ', '
      )}; an external id lookup silently ignores every name-branch parameter. Look up by id first, then by name in a separate call.`
    )
  }
}

const find_player_row = async (params) => {
  assert_single_lookup_dimension(params)

  const {
    name,
    pos,
    team,
    teams = [],
    date_of_birth,
    sleeper_player_id,
    keeptradecut_player_id,
    pfr_player_id,
    otc_player_id,
    pff_player_id,
    esb_player_id,
    gsis_player_id,
    short_name,
    nfl_draft_year,
    gsis_it_player_id,
    draftkings_player_id,
    fanduel_player_id,
    cbs_player_id,
    yahoo_player_id,
    rts_player_id,
    espn_player_id,
    nfl_player_id,
    mfl_player_id,
    sis_player_id,
    sportradar_player_id,
    underdog_player_id,
    fleaflicker_player_id,
    ffpc_player_id,
    nffc_player_id,
    fantrax_player_id,
    fantasypoints_player_id,

    ignore_retired = false,
    ignore_free_agent = false
  } = params

  if (team_aliases[name]) {
    const result = await db('player').where({ pid: team_aliases[name] })
    return result[0]
  }

  const query = db('player').select('player.*')

  // Lookup parameters are the canonical player DB column names; the values
  // callers pass come from external feeds. One vocabulary end to end — no
  // param-to-column translation seam.
  // sleeper_player_id used to sit outside the ladder in its own if, so it ANDed
  // with whatever branch ran instead of being exclusive like every other id. The
  // guard above makes it unreachable in combination with anything else, so it is
  // now an ordinary ladder branch and the two spellings agree.
  if (sleeper_player_id) {
    query.where({ sleeper_player_id })
  } else if (keeptradecut_player_id) {
    query.where({ keeptradecut_player_id })
  } else if (pfr_player_id) {
    query.where({ pfr_player_id })
  } else if (esb_player_id) {
    query.where({ esb_player_id })
  } else if (gsis_player_id) {
    query.where({ gsis_player_id })
  } else if (gsis_it_player_id) {
    query.where({ gsis_it_player_id })
  } else if (sportradar_player_id) {
    query.where({ sportradar_player_id })
  } else if (otc_player_id) {
    query.where({ otc_player_id })
  } else if (pff_player_id) {
    query.where({ pff_player_id })
  } else if (draftkings_player_id) {
    query.where({ draftkings_player_id })
  } else if (fanduel_player_id) {
    query.where({ fanduel_player_id })
  } else if (cbs_player_id) {
    query.where({ cbs_player_id })
  } else if (yahoo_player_id) {
    query.where({ yahoo_player_id })
  } else if (rts_player_id) {
    query.where({ rts_player_id })
  } else if (espn_player_id) {
    query.where({ espn_player_id })
  } else if (nfl_player_id) {
    query.where({ nfl_player_id })
  } else if (mfl_player_id) {
    query.where({ mfl_player_id })
  } else if (sis_player_id) {
    query.where({ sis_player_id })
  } else if (underdog_player_id) {
    query.where({ underdog_player_id })
  } else if (fleaflicker_player_id) {
    query.where({ fleaflicker_player_id })
  } else if (ffpc_player_id) {
    query.where({ ffpc_player_id })
  } else if (nffc_player_id) {
    query.where({ nffc_player_id })
  } else if (fantrax_player_id) {
    query.where({ fantrax_player_id })
  } else if (fantasypoints_player_id) {
    query.where({ fantasypoints_player_id })
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

    if (short_name) {
      query.where({ short_name })
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

    if (date_of_birth) {
      query.where(function () {
        this.where({ date_of_birth }).orWhere({
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
