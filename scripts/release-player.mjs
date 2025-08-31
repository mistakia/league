import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, getLeague } from '#libs-server'
import process_release from '#libs-server/process-release.mjs'

const argv = yargs(hideBin(process.argv))
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
  .help()
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
  .help().argv

const log = debug('release-player')
debug.enable('release-player')

const fuzzy_search_players = (search_term, players, threshold = 0.6) => {
  const search_lower = search_term.toLowerCase()
  const matches = []

  for (const player of players) {
    const full_name = `${player.fname} ${player.lname}`.toLowerCase()

    // Exact match gets highest score
    if (full_name === search_lower) {
      matches.push({ player, score: 1.0 })
      continue
    }

    // Check if search term is contained in full name
    if (full_name.includes(search_lower)) {
      const score = search_lower.length / full_name.length
      if (score >= threshold) {
        matches.push({ player, score })
      }
      continue
    }

    // Check if full name starts with search term
    if (full_name.startsWith(search_lower)) {
      const score = search_lower.length / full_name.length
      if (score >= threshold) {
        matches.push({ player, score })
      }
    }
  }

  // Sort by score (highest first)
  return matches.sort((a, b) => b.score - a.score)
}

const resolve_player = async ({ player_id, player_name, lid, tid }) => {
  if (player_id) {
    const players = await db('player').where({ pid: player_id }).limit(1)
    if (!players.length) {
      throw new Error(`Player not found with ID: ${player_id}`)
    }
    return players[0]
  }

  if (player_name) {
    // Get all players on the team's roster first for more efficient search
    const roster_players = await db('rosters_players')
      .join('rosters', 'rosters_players.rid', 'rosters.uid')
      .join('player', 'rosters_players.pid', 'player.pid')
      .select('player.pid', 'player.fname', 'player.lname', 'player.pos')
      .where({
        'rosters.tid': tid,
        'rosters.lid': lid,
        'rosters.year': constants.season.year,
        'rosters.week': constants.season.week
      })

    if (!roster_players.length) {
      throw new Error('No players found on team roster')
    }

    const matches = fuzzy_search_players(player_name, roster_players)

    if (!matches.length) {
      const available_names = roster_players
        .map((p) => `${p.fname} ${p.lname} (${p.pos})`)
        .join(', ')
      throw new Error(
        `No matching players found for "${player_name}". Available players: ${available_names}`
      )
    }

    if (matches.length > 1 && matches[0].score === matches[1].score) {
      const ambiguous_names = matches
        .filter((m) => m.score === matches[0].score)
        .map((m) => `${m.player.fname} ${m.player.lname} (${m.player.pos})`)
        .join(', ')
      throw new Error(
        `Ambiguous player name "${player_name}". Multiple matches: ${ambiguous_names}. Please be more specific.`
      )
    }

    log(
      `Matched "${player_name}" to ${matches[0].player.fname} ${matches[0].player.lname} (score: ${matches[0].score.toFixed(2)})`
    )
    return matches[0].player
  }

  throw new Error('Must provide either player_id or player_name')
}

const main = async () => {
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

    // Validate league exists
    const league = await getLeague({ lid })
    if (!league) {
      throw new Error(`League not found with ID: ${lid}`)
    }

    // Validate team exists
    const teams = await db('teams')
      .where({ uid: tid, lid, year: constants.season.year })
      .limit(1)
    if (!teams.length) {
      throw new Error(`Team not found with ID: ${tid} in league ${lid}`)
    }
    const team = teams[0]

    // Resolve release player
    const release_player = await resolve_player({
      player_id: release_player_id,
      player_name: release_player_name,
      lid,
      tid
    })

    log(
      `Release player resolved: ${release_player.fname} ${release_player.lname} (${release_player.pos}, ID: ${release_player.pid})`
    )

    // Resolve activation player if specified
    let activate_player = null
    if (activate_player_id || activate_player_name) {
      activate_player = await resolve_player({
        player_id: activate_player_id,
        player_name: activate_player_name,
        lid,
        tid
      })
      log(
        `Activate player resolved: ${activate_player.fname} ${activate_player.lname} (${activate_player.pos}, ID: ${activate_player.pid})`
      )
    }

    if (dry_run) {
      console.log('\n=== DRY RUN - No changes will be made ===')
      console.log(`League: ${league.name} (ID: ${lid})`)
      console.log(`Team: ${team.name} (${team.abbrv})`)
      console.log(
        `Release: ${release_player.fname} ${release_player.lname} (${release_player.pos})`
      )
      if (activate_player) {
        console.log(
          `Activate: ${activate_player.fname} ${activate_player.lname} (${activate_player.pos})`
        )
      }
      console.log('\nUse without --dry-run to execute the release.')
      process.exit(0)
      return
    }

    // Execute the release using existing infrastructure
    const release_params = {
      lid,
      tid,
      release_pid: release_player.pid,
      userid: 1, // Administrative user - could be made configurable
      activate_pid: activate_player?.pid || null,
      create_notification: true
    }

    const result = await process_release(release_params)

    // Display results
    console.log('\n=== Release Successful ===')
    console.log(`League: ${league.name} (ID: ${lid})`)
    console.log(`Team: ${team.name} (${team.abbrv})`)
    console.log(
      `Released: ${release_player.fname} ${release_player.lname} (${release_player.pos})`
    )

    if (activate_player) {
      console.log(
        `Activated: ${activate_player.fname} ${activate_player.lname} (${activate_player.pos})`
      )
    }

    console.log(`Discord notification sent: ${!!league.discord_webhook_url}`)
    console.log(`Transaction ID: ${result[0].transaction.uid}`)

    log('Player release completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('\n=== Release Failed ===')
    console.error(`Error: ${error.message}`)

    if (error.message.includes('player not on roster')) {
      console.error(
        "Hint: Verify the player is currently on the specified team's roster"
      )
    } else if (error.message.includes('player is protected')) {
      console.error('Hint: Protected players (PSP/PSDP) cannot be released')
    } else if (error.message.includes('player has a poaching claim')) {
      console.error(
        'Hint: Clear poaching claims before releasing practice squad players'
      )
    }

    process.exit(1)
  }
}

if (is_main(import.meta.url)) {
  main()
}
