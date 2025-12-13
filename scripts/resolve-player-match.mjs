import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import fetch from 'node-fetch'

import db from '#db'
import {
  is_main,
  createPlayer,
  updatePlayer,
  mergePlayer,
  find_player_row
} from '#libs-server'
import { format_player_name, fixTeam } from '#libs-shared'

const log = debug('resolve-player-match')
debug.enable('resolve-player-match,create-player,update-player,merge-player')

// File-based cache for Sleeper player data
const CACHE_DIR = path.join(os.tmpdir(), 'league-player-cache')
const SLEEPER_CACHE_FILE = path.join(CACHE_DIR, 'sleeper-players.json')
const SLEEPER_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

const ensure_cache_dir = async () => {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
  } catch (err) {
    // Directory may already exist
  }
}

const get_cached_sleeper_players = async () => {
  try {
    const stats = await fs.stat(SLEEPER_CACHE_FILE)
    const age_ms = Date.now() - stats.mtimeMs
    if (age_ms < SLEEPER_CACHE_TTL_MS) {
      const data = await fs.readFile(SLEEPER_CACHE_FILE, 'utf8')
      log(
        `Using cached Sleeper data (${Math.round(age_ms / 1000 / 60)} min old)`
      )
      return JSON.parse(data)
    }
    log('Sleeper cache expired')
  } catch (err) {
    // Cache doesn't exist or is invalid
  }
  return null
}

const set_cached_sleeper_players = async (data) => {
  await ensure_cache_dir()
  await fs.writeFile(SLEEPER_CACHE_FILE, JSON.stringify(data))
  log('Sleeper data cached')
}

const fetch_sleeper_players = async ({ ignore_cache = false } = {}) => {
  if (!ignore_cache) {
    const cached = await get_cached_sleeper_players()
    if (cached) return cached
  }

  log('Fetching Sleeper player data...')
  const url = 'https://api.sleeper.app/v1/players/nfl'
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch Sleeper data: ${response.status}`)
  }
  const data = await response.json()
  await set_cached_sleeper_players(data)
  return data
}

const external_id_columns = [
  'pff_id',
  'draftkings_id',
  'fanduel_id',
  'espn_id',
  'sleeper_id',
  'yahoo_id',
  'sportradar_id',
  'nfl_id',
  'gsisid',
  'gsis_it_id',
  'esbid',
  'rotowire_id',
  'rotoworld_id',
  'cbs_id',
  'mfl_id',
  'pfr_id',
  'otc_id',
  'keeptradecut_id',
  'fantasy_data_id',
  'rts_id',
  'fleaflicker_id'
]

const get_external_id_from_argv = (argv) => {
  for (const column of external_id_columns) {
    const arg_name = column.replace(/_/g, '-')
    if (argv[arg_name] !== undefined) {
      return { column, value: argv[arg_name] }
    }
  }
  return null
}

const get_all_external_ids_from_argv = (argv) => {
  const ids = {}
  for (const column of external_id_columns) {
    const arg_name = column.replace(/_/g, '-')
    if (argv[arg_name] !== undefined) {
      ids[column] = argv[arg_name]
    }
  }
  return ids
}

const action_create_player = async (argv) => {
  const { fname, lname, pos, team, dob, draftYear } = argv

  if (!fname || !lname) {
    throw new Error('--fname and --lname are required')
  }

  if (!pos) {
    throw new Error('--pos is required')
  }

  const player_data = {
    fname,
    lname,
    pos,
    pos1: pos,
    posd: pos,
    current_nfl_team: team || 'INA',
    dob: dob || '0000-00-00',
    nfl_draft_year: draftYear || new Date().getFullYear(),
    height: argv.height || 72,
    weight: argv.weight || 200
  }

  // Add all external IDs provided
  const external_ids = get_all_external_ids_from_argv(argv)
  Object.assign(player_data, external_ids)

  log(`Creating player: ${fname} ${lname}`)
  log(player_data)

  const result = await createPlayer(player_data)

  if (result) {
    log(`Successfully created player: ${result.pid}`)
    return result
  } else {
    throw new Error('Failed to create player')
  }
}

const action_update_external_id = async (argv) => {
  const { pid } = argv

  if (!pid) {
    throw new Error('--pid is required')
  }

  const external_id = get_external_id_from_argv(argv)
  if (!external_id) {
    throw new Error(
      'At least one external ID argument is required (e.g., --pff-id, --draftkings-id)'
    )
  }

  log(
    `Updating player ${pid} with ${external_id.column} = ${external_id.value}`
  )

  const update = { [external_id.column]: external_id.value }
  const changes = await updatePlayer({
    pid,
    update,
    allow_protected_props: true
  })

  if (changes > 0) {
    log(`Successfully updated ${changes} field(s)`)
  } else {
    log('No changes made (value may already be set)')
  }

  return changes
}

const action_update_player = async (argv) => {
  const { pid, team, pos } = argv

  if (!pid) {
    throw new Error('--pid is required')
  }

  const update = {}

  // Handle team update
  if (team) {
    const fixed_team = fixTeam(team)
    update.current_nfl_team = fixed_team
    log(`Setting current_nfl_team = ${fixed_team}`)
  }

  // Handle position update
  if (pos) {
    const upper_pos = pos.toUpperCase()
    update.pos = upper_pos
    update.pos1 = upper_pos
    update.posd = upper_pos
    log(`Setting pos = ${upper_pos}`)
  }

  // Handle external IDs
  for (const column of external_id_columns) {
    const arg_name = column.replace(/_/g, '-')
    if (argv[arg_name] !== undefined) {
      update[column] = argv[arg_name]
      log(`Setting ${column} = ${argv[arg_name]}`)
    }
  }

  if (Object.keys(update).length === 0) {
    throw new Error(
      'At least one update field is required (e.g., --team, --pos, --gsis-it-id)'
    )
  }

  log(`Updating player ${pid}`)

  const changes = await updatePlayer({
    pid,
    update,
    allow_protected_props: true
  })

  if (changes > 0) {
    log(`Successfully updated ${changes} field(s)`)
  } else {
    log('No changes made (values may already be set)')
  }

  return changes
}

const action_add_alias = async (argv) => {
  const { pid, alias } = argv

  if (!pid) {
    throw new Error('--pid is required')
  }

  if (!alias) {
    throw new Error('--alias is required')
  }

  const formatted_alias = format_player_name(alias)

  log(`Adding alias "${formatted_alias}" for player ${pid}`)

  const existing = await db('player_aliases')
    .where({ pid, formatted_alias })
    .first()

  if (existing) {
    log('Alias already exists')
    return 0
  }

  await db('player_aliases').insert({
    pid,
    formatted_alias
  })

  log('Successfully added alias')
  return 1
}

const action_merge_players = async (argv) => {
  const { keepPid, removePid } = argv

  if (!keepPid) {
    throw new Error('--keep-pid is required')
  }

  if (!removePid) {
    throw new Error('--remove-pid is required')
  }

  const keep_player_rows = await db('player').where({ pid: keepPid })
  const remove_player_rows = await db('player').where({ pid: removePid })

  if (!keep_player_rows.length) {
    throw new Error(`Player not found: ${keepPid}`)
  }

  if (!remove_player_rows.length) {
    throw new Error(`Player not found: ${removePid}`)
  }

  log(`Merging player ${removePid} into ${keepPid}`)

  await mergePlayer({
    update_player_row: keep_player_rows[0],
    remove_player_row: remove_player_rows[0]
  })

  log('Successfully merged players')
  return 1
}

const action_search = async (argv) => {
  const { name, team, pos } = argv

  const query = db('player')
    .select(
      'pid',
      'fname',
      'lname',
      'formatted',
      'pos',
      'current_nfl_team',
      'nfl_draft_year',
      'dob'
    )
    .orderBy('nfl_draft_year', 'desc')
    .limit(20)

  if (name) {
    const formatted_name = format_player_name(name)
    query.where(function () {
      this.where('formatted', 'like', `%${formatted_name}%`).orWhereIn(
        'pid',
        function () {
          this.select('pid')
            .from('player_aliases')
            .where('formatted_alias', 'like', `%${formatted_name}%`)
        }
      )
    })
  }

  if (team) {
    query.where('current_nfl_team', team.toUpperCase())
  }

  if (pos) {
    query.where(function () {
      this.where('pos', pos.toUpperCase())
        .orWhere('pos1', pos.toUpperCase())
        .orWhere('pos2', pos.toUpperCase())
    })
  }

  const players = await query

  if (!players.length) {
    log('No players found')
    return []
  }

  log(`Found ${players.length} player(s):`)
  for (const player of players) {
    log(
      `  ${player.pid} - ${player.fname} ${player.lname} (${player.pos}, ${player.current_nfl_team}, ${player.nfl_draft_year})`
    )
  }

  return players
}

const action_lookup = async (argv) => {
  const { name, team, pos, draftYear, ignoreCache } = argv

  if (!name) {
    throw new Error('--name is required')
  }

  const formatted_name = format_player_name(name)
  const search_team = team ? fixTeam(team) : null

  log(`Looking up player: ${name}`)
  log(`  Formatted: ${formatted_name}`)
  if (search_team) log(`  Team: ${search_team}`)
  if (pos) log(`  Position: ${pos}`)
  if (draftYear) log(`  Draft Year: ${draftYear}`)

  // Step 1: Search database for existing players
  log('\n=== Database Search ===')
  const db_matches = await db('player')
    .select(
      'pid',
      'fname',
      'lname',
      'formatted',
      'pos',
      'current_nfl_team',
      'nfl_draft_year',
      'dob',
      'sleeper_id',
      'espn_id',
      'sportradar_id'
    )
    .where(function () {
      this.where('formatted', 'like', `%${formatted_name}%`).orWhereIn(
        'pid',
        function () {
          this.select('pid')
            .from('player_aliases')
            .where('formatted_alias', 'like', `%${formatted_name}%`)
        }
      )
    })
    .orderBy('nfl_draft_year', 'desc')
    .limit(10)

  if (db_matches.length > 0) {
    log(`Found ${db_matches.length} potential match(es) in database:`)
    for (const player of db_matches) {
      log(
        `  ${player.pid} - ${player.fname} ${player.lname} (${player.pos}, ${player.current_nfl_team}, ${player.nfl_draft_year})`
      )
      if (player.sleeper_id) log(`    sleeper_id: ${player.sleeper_id}`)
    }

    // Check if any match the team/position criteria
    const exact_match = db_matches.find((p) => {
      const team_match = !search_team || p.current_nfl_team === search_team
      const pos_match = !pos || p.pos === pos.toUpperCase()
      const year_match = !draftYear || p.nfl_draft_year === draftYear
      return team_match && pos_match && year_match
    })

    if (exact_match) {
      log('\n[WARNING] POTENTIAL DUPLICATE FOUND:')
      log(`  ${exact_match.pid}`)
      log('  Consider using update-id instead of create.')
    }
  } else {
    log('No matches found in database.')
  }

  // Step 2: Fetch and search Sleeper data
  log('\n=== Sleeper API Search ===')
  const sleeper_players = await fetch_sleeper_players({
    ignore_cache: ignoreCache
  })

  // Search Sleeper data for matches
  const sleeper_matches = []
  for (const sleeper_id in sleeper_players) {
    const player = sleeper_players[sleeper_id]
    if (!player.full_name) continue

    const sleeper_formatted = format_player_name(player.full_name)
    const name_match =
      sleeper_formatted.includes(formatted_name) ||
      formatted_name.includes(sleeper_formatted)

    if (!name_match) continue

    // Additional filtering
    if (search_team && player.team && fixTeam(player.team) !== search_team)
      continue
    if (pos && player.position !== pos.toUpperCase()) continue
    if (draftYear && player.metadata?.start_year !== draftYear) continue

    sleeper_matches.push({ sleeper_id, ...player })
  }

  if (sleeper_matches.length === 0) {
    log('No matches found in Sleeper.')
    log('\n=== Summary ===')
    log('Player not found in Sleeper API.')
    log('If this is a new player, you may need to create manually.')
    return { db_matches, sleeper_matches: [] }
  }

  log(`Found ${sleeper_matches.length} match(es) in Sleeper:`)
  for (const player of sleeper_matches) {
    log(`\n  Sleeper ID: ${player.sleeper_id}`)
    log(`  Name: ${player.first_name} ${player.last_name}`)
    log(`  Position: ${player.position}`)
    log(`  Team: ${player.team || 'FA'}`)
    log(`  DOB: ${player.birth_date || 'unknown'}`)
    log(`  Draft Year: ${player.metadata?.start_year || 'unknown'}`)
    log(`  Height: ${player.height || 'unknown'}`)
    log(`  Weight: ${player.weight || 'unknown'}`)
    log(`  College: ${player.college || 'unknown'}`)
    if (player.espn_id) log(`  ESPN ID: ${player.espn_id}`)
    if (player.sportradar_id) log(`  Sportradar ID: ${player.sportradar_id}`)
    if (player.gsis_id) log(`  GSIS ID: ${player.gsis_id}`)
    if (player.rotowire_id) log(`  Rotowire ID: ${player.rotowire_id}`)
  }

  // Step 3: Check if Sleeper player already exists in database by sleeper_id
  log('\n=== Duplicate Check ===')
  for (const sleeper_player of sleeper_matches) {
    try {
      const existing = await find_player_row({
        sleeper_id: sleeper_player.sleeper_id
      })
      if (existing) {
        log(
          `[WARNING] Player with sleeper_id ${sleeper_player.sleeper_id} already exists: ${existing.pid}`
        )
        continue
      }
    } catch (err) {
      // Not found, which is expected for new players
    }

    // Also check by ESPN ID if available
    if (sleeper_player.espn_id) {
      try {
        const existing = await find_player_row({
          espn_id: sleeper_player.espn_id
        })
        if (existing) {
          log(
            `[WARNING] Player with espn_id ${sleeper_player.espn_id} already exists: ${existing.pid}`
          )
          continue
        }
      } catch (err) {
        // Not found
      }
    }
  }

  // Step 4: Generate create command for the best Sleeper match
  if (sleeper_matches.length > 0) {
    const best = sleeper_matches[0]
    log('\n=== Suggested Create Command ===')

    const cmd_parts = [
      'NODE_ENV=production node scripts/resolve-player-match.mjs create',
      `--fname "${best.first_name}"`,
      `--lname "${best.last_name}"`,
      `--pos "${best.position}"`,
      `--team "${best.team || 'INA'}"`
    ]

    if (best.birth_date) {
      cmd_parts.push(`--dob "${best.birth_date}"`)
    }

    if (best.metadata?.start_year) {
      cmd_parts.push(`--draft-year ${best.metadata.start_year}`)
    } else {
      cmd_parts.push(`--draft-year ${new Date().getFullYear()}`)
    }

    if (best.height) {
      cmd_parts.push(`--height ${best.height}`)
    }

    if (best.weight) {
      cmd_parts.push(`--weight ${best.weight}`)
    }

    cmd_parts.push(`--sleeper-id "${best.sleeper_id}"`)

    if (best.espn_id) {
      cmd_parts.push(`--espn-id ${best.espn_id}`)
    }

    log(cmd_parts.join(' \\\n  '))
  }

  return { db_matches, sleeper_matches }
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .usage('Usage: $0 <action> [options]')
      .command('create', 'Create a new player', (yargs) => {
        return yargs
          .option('fname', { type: 'string', description: 'First name' })
          .option('lname', { type: 'string', description: 'Last name' })
          .option('pos', { type: 'string', description: 'Position' })
          .option('team', {
            type: 'string',
            description: 'NFL team abbreviation'
          })
          .option('dob', {
            type: 'string',
            description: 'Date of birth (YYYY-MM-DD)'
          })
          .option('draft-year', {
            type: 'number',
            description: 'NFL draft year'
          })
          .option('height', { type: 'number', description: 'Height in inches' })
          .option('weight', { type: 'number', description: 'Weight in pounds' })
      })
      .command('update-id', 'Update external ID for a player', (yargs) => {
        return yargs.option('pid', { type: 'string', description: 'Player ID' })
      })
      .command(
        'update',
        'Update player fields (team, position, external IDs)',
        (yargs) => {
          return yargs
            .option('pid', {
              type: 'string',
              description: 'Player ID',
              demandOption: true
            })
            .option('team', {
              type: 'string',
              description: 'NFL team abbreviation'
            })
            .option('pos', {
              type: 'string',
              description: 'Position'
            })
        }
      )
      .command('add-alias', 'Add name alias for a player', (yargs) => {
        return yargs
          .option('pid', { type: 'string', description: 'Player ID' })
          .option('alias', { type: 'string', description: 'Alias name to add' })
      })
      .command('merge', 'Merge duplicate players', (yargs) => {
        return yargs
          .option('keep-pid', {
            type: 'string',
            description: 'Player ID to keep'
          })
          .option('remove-pid', {
            type: 'string',
            description: 'Player ID to remove'
          })
      })
      .command('search', 'Search for players', (yargs) => {
        return yargs
          .option('name', {
            type: 'string',
            description: 'Player name to search'
          })
          .option('team', {
            type: 'string',
            description: 'NFL team abbreviation'
          })
          .option('pos', { type: 'string', description: 'Position' })
      })
      .command(
        'lookup',
        'Lookup player in Sleeper API and check for duplicates',
        (yargs) => {
          return yargs
            .option('name', {
              type: 'string',
              description: 'Player name to lookup',
              demandOption: true
            })
            .option('team', {
              type: 'string',
              description: 'NFL team abbreviation'
            })
            .option('pos', { type: 'string', description: 'Position' })
            .option('draft-year', {
              type: 'number',
              description: 'Draft year to filter by'
            })
            .option('ignore-cache', {
              type: 'boolean',
              description: 'Ignore cached Sleeper data',
              default: false
            })
        }
      )
      .option('pff-id', { type: 'number', description: 'PFF player ID' })
      .option('draftkings-id', {
        type: 'number',
        description: 'DraftKings player ID'
      })
      .option('fanduel-id', {
        type: 'string',
        description: 'FanDuel player ID'
      })
      .option('espn-id', { type: 'number', description: 'ESPN player ID' })
      .option('sleeper-id', {
        type: 'string',
        description: 'Sleeper player ID'
      })
      .option('yahoo-id', { type: 'number', description: 'Yahoo player ID' })
      .option('sportradar-id', {
        type: 'string',
        description: 'Sportradar player ID'
      })
      .option('nfl-id', { type: 'number', description: 'NFL player ID' })
      .option('gsisid', { type: 'string', description: 'GSIS player ID' })
      .option('gsis-it-id', {
        type: 'string',
        description: 'GSIS IT player ID'
      })
      .option('esbid', { type: 'string', description: 'ESB player ID' })
      .option('rotowire-id', {
        type: 'number',
        description: 'Rotowire player ID'
      })
      .option('rotoworld-id', {
        type: 'number',
        description: 'Rotoworld player ID'
      })
      .option('cbs-id', { type: 'number', description: 'CBS player ID' })
      .option('mfl-id', { type: 'number', description: 'MFL player ID' })
      .option('pfr-id', {
        type: 'string',
        description: 'Pro Football Reference player ID'
      })
      .option('otc-id', {
        type: 'number',
        description: 'Over The Cap player ID'
      })
      .option('keeptradecut-id', {
        type: 'number',
        description: 'KeepTradeCut player ID'
      })
      .demandCommand(1, 'You must specify an action')
      .help().argv

    const action = argv._[0]

    switch (action) {
      case 'create':
        await action_create_player(argv)
        break
      case 'update-id':
        await action_update_external_id(argv)
        break
      case 'update':
        await action_update_player(argv)
        break
      case 'add-alias':
        await action_add_alias(argv)
        break
      case 'merge':
        await action_merge_players(argv)
        break
      case 'search':
        await action_search(argv)
        break
      case 'lookup':
        await action_lookup(argv)
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (err) {
    error = err
    log(error)
    console.error(error.message)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export {
  action_create_player,
  action_update_external_id,
  action_update_player,
  action_add_alias,
  action_merge_players,
  action_search,
  action_lookup,
  fetch_sleeper_players
}
