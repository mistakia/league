import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import MockDate from 'mockdate'

import db from '#db'
import { current_season } from '#constants'
import format_player_name from '#libs-shared/format-player-name.mjs'
import { is_main, getLeague } from '#libs-server'
import process_release from '#libs-server/process-release.mjs'

const log = debug('release-player')
debug.enable('release-player')

// Configuration
const ADMIN_USER_ID = 1 // Could be made configurable via environment variable

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('league-id', {
      alias: 'l',
      type: 'number',
      demandOption: true,
      describe: 'League ID'
    })
    .option('team-id', {
      alias: 't',
      type: 'number',
      demandOption: true,
      describe: 'Team ID'
    })
    .option('player-id', {
      alias: 'p',
      type: 'string',
      describe: 'Player ID (exact match)'
    })
    .option('player-name', {
      alias: 'n',
      type: 'string',
      describe: 'Player name (supports fuzzy matching)'
    })
    .option('activate-player-id', {
      alias: 'a',
      type: 'string',
      describe: 'Player ID to activate from practice squad'
    })
    .option('activate-player-name', {
      alias: 'A',
      type: 'string',
      describe: 'Player name to activate from practice squad'
    })
    .option('dry-run', {
      alias: 'd',
      type: 'boolean',
      default: false,
      describe: 'Show what would be done without making changes'
    })
    .check((argv) => {
      if (!argv.playerId && !argv.playerName) {
        throw new Error('Must specify either --player-id or --player-name')
      }
      if (argv.playerId && argv.playerName) {
        throw new Error('Cannot specify both --player-id and --player-name')
      }
      if (argv.activatePlayerId && argv.activatePlayerName) {
        throw new Error(
          'Cannot specify both --activate-player-id and --activate-player-name'
        )
      }
      return true
    })
    .example(
      '$0 --league-id 1 --team-id 5 --player-id "12345"',
      'Release player by ID'
    )
    .example(
      '$0 --league-id 1 --team-id 5 --player-name "Josh Allen"',
      'Release player by name'
    )
    .example(
      '$0 -l 1 -t 5 -p "12345" -a "67890"',
      'Release player and activate another from practice squad'
    )
    .alias('help', 'h')
    .parse()
}

/**
 * Format player information for display
 * @param {Object} player - Player object with fname, lname, pos, and optional pid
 * @returns {string} Formatted player display string
 */
const format_player_display = (player) =>
  `${player.fname} ${player.lname} (${player.pos}${player.pid ? `, ID: ${player.pid}` : ''})`

/**
 * Search for players by name with exact match priority
 * @param {string} search_term - Name to search for
 * @param {Array} players - Array of player objects to search through
 * @returns {Array} Array of matching players, exact matches first
 */
const search_players_by_name = (search_term, players) => {
  const formatted_search = format_player_name(search_term)
  if (!formatted_search) return []

  const exact_matches = []
  const fuzzy_matches = new Set() // Use Set to avoid duplicates

  for (const player of players) {
    const formatted_full = format_player_name(`${player.fname} ${player.lname}`)
    if (!formatted_full) continue

    // Exact full name match - highest priority
    if (formatted_full === formatted_search) {
      exact_matches.push(player)
      continue
    }

    // Fuzzy matching - only if no exact match found
    if (formatted_full.includes(formatted_search)) {
      fuzzy_matches.add(player)
      continue
    }

    // Word-by-word matching
    const search_words = formatted_search.split(' ')
    const name_words = formatted_full.split(' ')

    const has_word_match = search_words.some(
      (search_word) =>
        search_word.length >= 2 &&
        name_words.some((name_word) => name_word === search_word)
    )

    if (has_word_match) {
      fuzzy_matches.add(player)
    }
  }

  // Return exact matches first, then fuzzy matches
  return exact_matches.length > 0 ? exact_matches : Array.from(fuzzy_matches)
}

const get_roster_players = async ({ lid, tid }) => {
  return db('rosters_players')
    .join('player', 'rosters_players.pid', 'player.pid')
    .select('player.pid', 'player.fname', 'player.lname', 'player.pos')
    .where({
      'rosters_players.tid': tid,
      'rosters_players.lid': lid,
      'rosters_players.year': current_season.year,
      'rosters_players.week': current_season.week
    })
}

const resolve_player_by_id = async (player_id) => {
  const players = await db('player').where({ pid: player_id }).limit(1)
  if (!players.length) {
    throw new Error(`Player not found with ID: ${player_id}`)
  }
  return players[0]
}

const resolve_player_by_name = async (player_name, { lid, tid }) => {
  const roster_players = await get_roster_players({ lid, tid })

  if (!roster_players.length) {
    throw new Error('No players found on team roster')
  }

  const matches = search_players_by_name(player_name, roster_players)

  if (!matches.length) {
    const available_names = roster_players.map(format_player_display).join(', ')
    throw new Error(
      `No matching players found for "${player_name}". Available players: ${available_names}`
    )
  }

  if (matches.length > 1) {
    const ambiguous_names = matches.map(format_player_display).join(', ')
    throw new Error(
      `Ambiguous player name "${player_name}". Multiple matches: ${ambiguous_names}. Please be more specific.`
    )
  }

  log(`Matched "${player_name}" to ${format_player_display(matches[0])}`)
  return matches[0]
}

const resolve_player = async ({
  player_id = null,
  player_name = null,
  lid,
  tid
}) => {
  if (player_id) {
    return resolve_player_by_id(player_id)
  }

  if (player_name) {
    return resolve_player_by_name(player_name, { lid, tid })
  }

  throw new Error('Must provide either player_id or player_name')
}

const validate_league = async (lid) => {
  const league = await getLeague({ lid })
  if (!league) {
    throw new Error(`League not found with ID: ${lid}`)
  }
  return league
}

const validate_team = async ({ tid, lid }) => {
  const teams = await db('teams')
    .where({ uid: tid, lid, year: current_season.year })
    .limit(1)
  if (!teams.length) {
    throw new Error(`Team not found with ID: ${tid} in league ${lid}`)
  }
  return teams[0]
}

const validate_player_on_roster = async ({ pid, tid, lid }) => {
  const roster_check = await db('rosters_players')
    .where({
      'rosters_players.pid': pid,
      'rosters_players.tid': tid,
      'rosters_players.lid': lid,
      'rosters_players.year': current_season.year,
      'rosters_players.week': current_season.week
    })
    .limit(1)

  if (!roster_check.length) {
    throw new Error('player not on roster')
  }
}

const display_dry_run_results = ({
  league,
  team,
  release_player,
  activate_player,
  lid
}) => {
  console.log('\n=== DRY RUN - No changes will be made ===')
  console.log(`League: ${league.name} (ID: ${lid})`)
  console.log(`Team: ${team.name} (${team.abbrv})`)
  console.log(`Release: ${format_player_display(release_player)}`)

  if (activate_player) {
    console.log(`Activate: ${format_player_display(activate_player)}`)
  }

  console.log('\nUse without --dry-run to execute the release.')
}

const display_success_results = ({
  league,
  team,
  release_player,
  activate_player,
  result,
  lid
}) => {
  console.log('\n=== Release Successful ===')
  console.log(`League: ${league.name} (ID: ${lid})`)
  console.log(`Team: ${team.name} (${team.abbrv})`)
  console.log(`Released: ${format_player_display(release_player)}`)

  if (activate_player) {
    console.log(`Activated: ${format_player_display(activate_player)}`)
  }

  console.log(`Discord notification sent: ${!!league.discord_webhook_url}`)
  console.log(`Transaction ID: ${result[0].transaction.uid}`)
}

const handle_error = (error) => {
  console.error('\n=== Release Failed ===')
  console.error(`Error: ${error.message}`)

  // Provide helpful hints based on error type
  const error_hints = {
    'player not on roster':
      "Hint: Verify the player is currently on the specified team's roster",
    'player is protected':
      'Hint: Protected players (PSP/PSDP) cannot be released',
    'player has a poaching claim':
      'Hint: Clear poaching claims before releasing practice squad players'
  }

  for (const [error_pattern, hint] of Object.entries(error_hints)) {
    if (error.message.toLowerCase().includes(error_pattern)) {
      console.error(hint)
      break
    }
  }
}

const main = async () => {
  const argv = initialize_cli()

  // Set mock date if provided (for testing)
  if (process.env.MOCK_DATE) {
    MockDate.set(process.env.MOCK_DATE)
  }

  const {
    leagueId: lid,
    teamId: tid,
    playerId: release_player_id,
    playerName: release_player_name,
    activatePlayerId: activate_player_id,
    activatePlayerName: activate_player_name,
    dryRun: dry_run
  } = argv

  try {
    log(`Starting player release process for league ${lid}, team ${tid}`)

    // Validate inputs
    const league = await validate_league(lid)
    const team = await validate_team({ tid, lid })

    // Resolve players
    const release_player = await resolve_player({
      player_id: release_player_id,
      player_name: release_player_name,
      lid,
      tid
    })

    log(`Release player resolved: ${format_player_display(release_player)}`)

    // For player ID resolution, we need to validate they're on the roster
    // (name resolution already does this as part of the search)
    if (release_player_id) {
      await validate_player_on_roster({ pid: release_player.pid, tid, lid })
    }

    let activate_player = null
    if (activate_player_id || activate_player_name) {
      activate_player = await resolve_player({
        player_id: activate_player_id,
        player_name: activate_player_name,
        lid,
        tid
      })
      log(`Activate player resolved: ${format_player_display(activate_player)}`)

      // For player ID resolution, we need to validate they're on the roster
      // (name resolution already does this as part of the search)
      if (activate_player_id) {
        await validate_player_on_roster({ pid: activate_player.pid, tid, lid })
      }
    }

    // Handle dry run
    if (dry_run) {
      display_dry_run_results({
        league,
        team,
        release_player,
        activate_player,
        lid
      })
      process.exit(0)
    }

    // Execute the release
    const release_params = {
      lid,
      tid,
      release_pid: release_player.pid,
      userid: ADMIN_USER_ID,
      activate_pid: activate_player?.pid || null,
      create_notification: true
    }

    const result = await process_release(release_params)

    // Display success results
    display_success_results({
      league,
      team,
      release_player,
      activate_player,
      result,
      lid
    })

    log('Player release completed successfully')
    process.exit(0)
  } catch (error) {
    handle_error(error)
    process.exit(1)
  }
}

if (is_main(import.meta.url)) {
  main()
}
