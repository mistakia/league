import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { pfr, wait } from '#libs-server'

const log = debug('import-team-rosters-pfr')
debug.enable('import-team-rosters-pfr,pro-football-reference,proxy-manager')

// Constants
const WAIT_TIME_AFTER_REQUEST = 5000 // 5 seconds
const WAIT_TIME_AFTER_ERROR = 5000 // 5 seconds

const get_all_rosters = async ({ year, ignore_cache = false }) => {
  const rosters = []

  for (const team of pfr.active_nfl_teams) {
    try {
      log(`getting roster for ${team} ${year}`)
      const result = await pfr.get_team_roster({ team, year, ignore_cache })
      const roster = result.players
      rosters.push(...roster.map((player) => ({ ...player, team, year })))

      // Only wait if this was not a cache hit
      if (!result.cache_hit) {
        log(
          `waiting ${WAIT_TIME_AFTER_REQUEST / 1000} seconds after fetching ${team} ${year}`
        )
        await wait(WAIT_TIME_AFTER_REQUEST) // Be nice to PFR servers
      } else {
        log(`skipping wait for cached ${team} ${year}`)
      }
    } catch (err) {
      log(`error getting roster for ${team} ${year}: ${err.message}`)
      // Always wait after errors to be nice
      await wait(WAIT_TIME_AFTER_ERROR)
    }
  }

  return rosters
}

const save_rosters = async ({ rosters, year }) => {
  if (!rosters.length) {
    log('No rosters to save')
    return { update_count: 0, missing_count: 0 }
  }

  // Get all pfr_ids from the rosters
  const pfr_ids = rosters.map((player) => player.pfr_id).filter(Boolean)

  if (!pfr_ids.length) {
    log('No valid PFR IDs found in roster data')
    return { update_count: 0, missing_count: 0 }
  }

  // Get existing players with these pfr_ids
  const existing_players = await db('player')
    .whereIn('pfr_id', pfr_ids)
    .select('pid', 'pfr_id')
  const players_by_pfr_id = {}
  for (const player of existing_players) {
    players_by_pfr_id[player.pfr_id] = player
  }

  let update_count = 0
  let missing_count = 0

  // Use a transaction for database operations
  await db.transaction(async (trx) => {
    for (const player of rosters) {
      // If we found a matching player, update their season value in player_seasonlogs
      const matching_player = players_by_pfr_id[player.pfr_id]
      if (matching_player && player.av) {
        // Insert or update player_seasonlogs with the PFR season value
        await trx('player_seasonlogs')
          .where({
            pid: matching_player.pid,
            year,
            seas_type: 'REG'
          })
          .update({
            pfr_season_value: player.av
          })

        update_count++
      } else if (player.pfr_id && !matching_player) {
        log(
          `No matching player found for PFR ID ${player.pfr_id} (${player.name})`
        )
        missing_count++
      }
    }
  })

  log(`Updated season values for ${update_count} players`)
  log(`Missing players: ${missing_count}`)

  return { update_count, missing_count }
}

const validate_args = (argv) => {
  if (argv.year) {
    return { valid: true }
  }

  if (argv.start_year && argv.end_year) {
    if (argv.start_year > argv.end_year) {
      return {
        valid: false,
        message: 'start_year must be less than or equal to end_year'
      }
    }
    return { valid: true }
  }

  return {
    valid: false,
    message: 'Either --year or both --start_year and --end_year are required'
  }
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('year', {
        alias: 'y',
        type: 'number',
        description: 'Year to import rosters for'
      })
      .option('start_year', {
        alias: 's',
        type: 'number',
        description: 'Start year for importing multiple years'
      })
      .option('end_year', {
        alias: 'e',
        type: 'number',
        description: 'End year for importing multiple years'
      })
      .option('ignore_cache', {
        alias: 'i',
        type: 'boolean',
        description: 'Ignore cache',
        default: false
      })
      .help()
      .alias('help', 'h').argv

    const validation = validate_args(argv)
    if (!validation.valid) {
      throw new Error(validation.message)
    }

    if (argv.year) {
      log(`Importing rosters for year: ${argv.year}`)
      const rosters = await get_all_rosters({
        year: argv.year,
        ignore_cache: argv.ignore_cache
      })
      await save_rosters({ rosters, year: argv.year })
    } else if (argv.start_year && argv.end_year) {
      log(`Importing rosters for years: ${argv.start_year} to ${argv.end_year}`)
      for (let year = argv.start_year; year <= argv.end_year; year++) {
        log(`Processing year ${year}...`)
        const rosters = await get_all_rosters({
          year,
          ignore_cache: argv.ignore_cache
        })
        await save_rosters({ rosters, year })
      }
    }
  } catch (err) {
    error = err
    log(`Error: ${error.message}`)
    if (error.stack) {
      log(error.stack)
    }
  }

  process.exit(error ? 1 : 0)
}

main()
