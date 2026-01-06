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
  find_player_row,
  player_name_utils
} from '#libs-server'
import { format_player_name, fixTeam, strings_are_similar } from '#libs-shared'
import { search_players as espn_search_players } from '#libs-server/espn.mjs'
import { search_players as pfr_search_players } from '#libs-server/pro-football-reference.mjs'

// NFL Pro search is in private libs - dynamically import to handle missing module
const get_nfl_pro_search = async () => {
  try {
    const module = await import('../private/libs-server/nfl-pro.mjs')
    return module.search_players
  } catch (err) {
    log('NFL Pro module not available')
    return null
  }
}

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

const ALL_SOURCES = ['sleeper', 'espn', 'nfl', 'pfr']
const VALID_SOURCES = [...ALL_SOURCES, 'all']

const parse_sources = (sources_string) => {
  if (!sources_string || sources_string === 'all') {
    return ALL_SOURCES
  }
  const sources = sources_string.split(',').map((s) => s.trim().toLowerCase())
  for (const source of sources) {
    if (!VALID_SOURCES.includes(source)) {
      throw new Error(
        `Invalid source: ${source}. Valid sources: ${VALID_SOURCES.join(', ')}`
      )
    }
  }
  // If 'all' is in the array, expand to all sources
  if (sources.includes('all')) {
    return ALL_SOURCES
  }
  return sources
}

const query_sources = async ({
  name,
  pos,
  team,
  sources,
  ignore_cache = false
}) => {
  const results = {
    sleeper: [],
    espn: [],
    nfl: [],
    pfr: []
  }

  const queries = []

  if (sources.includes('sleeper')) {
    queries.push(
      (async () => {
        try {
          const sleeper_players = await fetch_sleeper_players({ ignore_cache })
          const formatted_name = format_player_name(name)
          const search_team = team ? fixTeam(team) : null

          const matches = []
          for (const sleeper_id in sleeper_players) {
            const player = sleeper_players[sleeper_id]
            if (!player.full_name) continue

            const sleeper_formatted = format_player_name(player.full_name)
            const name_match =
              sleeper_formatted.includes(formatted_name) ||
              formatted_name.includes(sleeper_formatted)

            if (!name_match) continue
            if (
              search_team &&
              player.team &&
              fixTeam(player.team) !== search_team
            )
              continue
            if (pos && player.position !== pos.toUpperCase()) continue

            matches.push({ sleeper_id, ...player })
          }
          results.sleeper = matches
        } catch (err) {
          log(`Sleeper search error: ${err.message}`)
        }
      })()
    )
  }

  if (sources.includes('espn')) {
    queries.push(
      (async () => {
        try {
          results.espn = await espn_search_players({
            query: name,
            ignore_cache
          })
        } catch (err) {
          log(`ESPN search error: ${err.message}`)
        }
      })()
    )
  }

  if (sources.includes('nfl')) {
    queries.push(
      (async () => {
        try {
          const nfl_search = await get_nfl_pro_search()
          if (nfl_search) {
            results.nfl = await nfl_search({ term: name, ignore_cache })
          }
        } catch (err) {
          log(`NFL Pro search error: ${err.message}`)
        }
      })()
    )
  }

  if (sources.includes('pfr')) {
    queries.push(
      (async () => {
        try {
          results.pfr = await pfr_search_players({
            search_term: name,
            ignore_cache
          })
        } catch (err) {
          log(`PFR search error: ${err.message}`)
        }
      })()
    )
  }

  await Promise.allSettled(queries)
  return results
}

const consolidate_results = async ({ results, pos, team }) => {
  const search_team = team ? fixTeam(team) : null
  const consolidated = []

  // Pre-load nickname sets for synchronous name matching
  const nickname_sets = await player_name_utils.load_nickname_sets()

  // Synchronous helper to check if two names match using fuzzy matching and nicknames
  const names_match_sync = (name1, name2) => {
    const norm1 = format_player_name(name1 || '')
    const norm2 = format_player_name(name2 || '')

    // Exact match
    if (norm1 === norm2) return true

    // Substring match
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true

    // Check if strings are similar using distance metrics
    if (strings_are_similar(norm1, norm2)) return true

    // Split into first/last name and check with nickname support
    const parts1 = name1?.trim().split(/\s+/) || []
    const parts2 = name2?.trim().split(/\s+/) || []

    if (parts1.length >= 2 && parts2.length >= 2) {
      const fname1 = format_player_name(parts1[0])
      const fname2 = format_player_name(parts2[0])
      const lname1 = format_player_name(parts1[parts1.length - 1])
      const lname2 = format_player_name(parts2[parts2.length - 1])

      // Last names must be similar
      if (!strings_are_similar(lname1, lname2)) return false

      // First names can match via nicknames
      if (fname1 === fname2) return true
      if (fname1.includes(fname2) || fname2.includes(fname1)) return true
      if (player_name_utils.is_nicknames_sync(fname1, fname2, nickname_sets))
        return true
      if (strings_are_similar(fname1, fname2)) return true
    }

    return false
  }

  // Helper to find or create a consolidated entry
  const find_or_create_entry = ({
    source_name,
    source_position,
    source_team
  }) => {
    const norm_pos = source_position?.toUpperCase() || ''
    const norm_team = source_team ? fixTeam(source_team) : ''

    // Find existing entry with matching name using fuzzy matching
    let entry = consolidated.find((e) => names_match_sync(e.name, source_name))

    if (!entry) {
      entry = {
        name: source_name,
        position: norm_pos,
        team: norm_team,
        sources: [],
        external_ids: {}
      }
      consolidated.push(entry)
    }

    // Update position and team if we have better data
    if (!entry.position && norm_pos) entry.position = norm_pos
    if (!entry.team && norm_team) entry.team = norm_team

    return entry
  }

  // Process Sleeper results
  for (const player of results.sleeper) {
    const entry = find_or_create_entry({
      source_name:
        player.full_name || `${player.first_name} ${player.last_name}`,
      source_position: player.position,
      source_team: player.team
    })

    entry.sources.push('sleeper')
    entry.external_ids.sleeper_id = player.sleeper_id
    if (player.espn_id) entry.external_ids.espn_id = player.espn_id
    if (player.sportradar_id)
      entry.external_ids.sportradar_id = player.sportradar_id
    if (player.gsis_id) entry.external_ids.gsisid = player.gsis_id
    if (player.rotowire_id) entry.external_ids.rotowire_id = player.rotowire_id
    if (player.yahoo_id) entry.external_ids.yahoo_id = player.yahoo_id

    // Store additional sleeper data
    entry.sleeper_data = {
      first_name: player.first_name,
      last_name: player.last_name,
      birth_date: player.birth_date,
      height: player.height,
      weight: player.weight,
      college: player.college,
      start_year: player.metadata?.start_year
    }
  }

  // Process ESPN results
  for (const player of results.espn) {
    const entry = find_or_create_entry({
      source_name: player.name,
      source_position: player.position,
      source_team: player.team
    })

    if (!entry.sources.includes('espn')) entry.sources.push('espn')
    entry.external_ids.espn_id = player.espn_id
  }

  // Process NFL Pro results
  for (const player of results.nfl) {
    const entry = find_or_create_entry({
      source_name: player.display_name,
      source_position: player.position,
      source_team: player.team
    })

    if (!entry.sources.includes('nfl')) entry.sources.push('nfl')
    if (player.gsisid) entry.external_ids.gsisid = player.gsisid
    if (player.esbid) entry.external_ids.esbid = player.esbid
    if (player.gsis_it_id) entry.external_ids.gsis_it_id = player.gsis_it_id

    // Store NFL Pro data
    entry.nfl_data = {
      first_name: player.first_name,
      last_name: player.last_name,
      birth_date: player.birth_date,
      height: player.height,
      weight: player.weight,
      college: player.college,
      draft_round: player.draft_round,
      draft_pick: player.draft_pick,
      rookie_year: player.rookie_year
    }
  }

  // Process PFR results
  for (const player of results.pfr) {
    const entry = find_or_create_entry({
      source_name: player.name,
      source_position: player.positions?.[0],
      source_team: null
    })

    if (!entry.sources.includes('pfr')) entry.sources.push('pfr')
    entry.external_ids.pfr_id = player.pfr_id

    // Store PFR data
    entry.pfr_data = {
      positions: player.positions,
      start_year: player.start_year,
      end_year: player.end_year,
      is_active: player.is_active,
      url: player.url
    }
  }

  // Filter by position and team if specified
  return consolidated.filter((entry) => {
    if (pos && entry.position && entry.position !== pos.toUpperCase())
      return false
    if (search_team && entry.team && entry.team !== search_team) return false
    return true
  })
}

const action_lookup = async (argv) => {
  const { name, team, pos, draftYear, ignoreCache, sources: sources_arg } = argv

  if (!name) {
    throw new Error('--name is required')
  }

  const sources = parse_sources(sources_arg)
  const formatted_name = format_player_name(name)
  const search_team = team ? fixTeam(team) : null

  log(`Looking up player: ${name}`)
  log(`  Formatted: ${formatted_name}`)
  if (search_team) log(`  Team: ${search_team}`)
  if (pos) log(`  Position: ${pos}`)
  if (draftYear) log(`  Draft Year: ${draftYear}`)
  log(`  Sources: ${sources.join(', ')}`)

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
      'sportradar_id',
      'gsisid',
      'esbid',
      'gsis_it_id',
      'pfr_id'
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
      const ids = []
      if (player.sleeper_id) ids.push(`sleeper:${player.sleeper_id}`)
      if (player.espn_id) ids.push(`espn:${player.espn_id}`)
      if (player.gsisid) ids.push(`gsis:${player.gsisid}`)
      if (player.pfr_id) ids.push(`pfr:${player.pfr_id}`)
      if (ids.length) log(`    IDs: ${ids.join(', ')}`)
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
      log('  Consider using update command instead of create.')
    }
  } else {
    log('No matches found in database.')
  }

  // Step 2: Query external sources in parallel
  log('\n=== External Source Search ===')
  const source_results = await query_sources({
    name,
    pos,
    team,
    sources,
    ignore_cache: ignoreCache
  })

  // Log individual source results
  for (const source of sources) {
    const count = source_results[source]?.length || 0
    log(`  ${source}: ${count} result(s)`)
  }

  // Step 3: Consolidate results
  log('\n=== Consolidated Results ===')
  const consolidated = await consolidate_results({
    results: source_results,
    pos,
    team
  })

  if (consolidated.length === 0) {
    log('No matches found in external sources.')
    log('\n=== Summary ===')
    log('Player not found in external sources.')
    log('If this is a new player, you may need to create manually.')
    return { db_matches, consolidated: [] }
  }

  log(`Found ${consolidated.length} consolidated match(es):`)
  for (const entry of consolidated) {
    log(`\n  Name: ${entry.name}`)
    log(`  Position: ${entry.position || 'unknown'}`)
    log(`  Team: ${entry.team || 'FA'}`)
    log(`  Sources: ${entry.sources.join(', ')}`)

    const id_strings = Object.entries(entry.external_ids)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}:${v}`)
    if (id_strings.length) {
      log(`  External IDs: ${id_strings.join(', ')}`)
    }

    // Show additional data from sources
    if (entry.sleeper_data) {
      log(`  Birth Date: ${entry.sleeper_data.birth_date || 'unknown'}`)
      log(`  Height: ${entry.sleeper_data.height || 'unknown'}`)
      log(`  Weight: ${entry.sleeper_data.weight || 'unknown'}`)
      log(`  College: ${entry.sleeper_data.college || 'unknown'}`)
      log(`  Draft Year: ${entry.sleeper_data.start_year || 'unknown'}`)
    } else if (entry.nfl_data) {
      log(`  Birth Date: ${entry.nfl_data.birth_date || 'unknown'}`)
      log(`  Height: ${entry.nfl_data.height || 'unknown'}`)
      log(`  Weight: ${entry.nfl_data.weight || 'unknown'}`)
      log(`  College: ${entry.nfl_data.college || 'unknown'}`)
      log(`  Draft Year: ${entry.nfl_data.rookie_year || 'unknown'}`)
    }

    if (entry.pfr_data) {
      log(`  PFR URL: ${entry.pfr_data.url}`)
      log(
        `  Years Active: ${entry.pfr_data.start_year || '?'}-${entry.pfr_data.end_year || 'present'}`
      )
    }
  }

  // Step 4: Check for duplicates in database
  log('\n=== Duplicate Check ===')
  for (const entry of consolidated) {
    for (const [id_type, id_value] of Object.entries(entry.external_ids)) {
      if (!id_value) continue
      try {
        const existing = await find_player_row({ [id_type]: id_value })
        if (existing) {
          log(
            `[WARNING] Player with ${id_type}=${id_value} already exists: ${existing.pid}`
          )
        }
      } catch (err) {
        // Not found, expected for new players
      }
    }
  }

  // Step 5: Generate create/update command for the best match
  if (consolidated.length > 0) {
    const best = consolidated[0]
    log('\n=== Suggested Command ===')

    // Determine if this is an update or create
    const matching_db_player = db_matches.find((p) => {
      const name_match =
        format_player_name(`${p.fname} ${p.lname}`) ===
        format_player_name(best.name)
      return name_match
    })

    if (matching_db_player) {
      // Generate update command
      const cmd_parts = [
        'NODE_ENV=production node scripts/resolve-player-match.mjs update',
        `--pid "${matching_db_player.pid}"`
      ]

      for (const [id_type, id_value] of Object.entries(best.external_ids)) {
        if (id_value && !matching_db_player[id_type]) {
          const arg_name = id_type.replace(/_/g, '-')
          cmd_parts.push(`--${arg_name} "${id_value}"`)
        }
      }

      log('Player exists in database. Suggested update command:')
      log(cmd_parts.join(' \\\n  '))
    } else {
      // Generate create command
      const data = best.sleeper_data || best.nfl_data || {}
      const cmd_parts = [
        'NODE_ENV=production node scripts/resolve-player-match.mjs create',
        `--fname "${data.first_name || best.name.split(' ')[0]}"`,
        `--lname "${data.last_name || best.name.split(' ').slice(1).join(' ')}"`,
        `--pos "${best.position || 'UNK'}"`,
        `--team "${best.team || 'INA'}"`
      ]

      if (data.birth_date) {
        cmd_parts.push(`--dob "${data.birth_date}"`)
      }

      const draft_year =
        data.start_year || data.rookie_year || best.pfr_data?.start_year
      if (draft_year) {
        cmd_parts.push(`--draft-year ${draft_year}`)
      } else {
        cmd_parts.push(`--draft-year ${new Date().getFullYear()}`)
      }

      if (data.height) {
        cmd_parts.push(`--height ${data.height}`)
      }

      if (data.weight) {
        cmd_parts.push(`--weight ${data.weight}`)
      }

      // Add all external IDs
      for (const [id_type, id_value] of Object.entries(best.external_ids)) {
        if (id_value) {
          const arg_name = id_type.replace(/_/g, '-')
          cmd_parts.push(`--${arg_name} "${id_value}"`)
        }
      }

      log('Player not found in database. Suggested create command:')
      log(cmd_parts.join(' \\\n  '))
    }
  }

  return { db_matches, consolidated }
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
        'Lookup player across multiple data sources',
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
            .option('sources', {
              alias: 's',
              type: 'string',
              description:
                'Data sources to query (sleeper,espn,nfl,pfr or all)',
              default: 'all'
            })
            .option('ignore-cache', {
              type: 'boolean',
              description: 'Ignore cached data from all sources',
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
