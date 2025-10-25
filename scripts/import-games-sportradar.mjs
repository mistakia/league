import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam } from '#libs-shared'
import { is_main, report_job } from '#libs-server'
import { get_games_schedule } from '#libs-server/sportradar/sportradar-api.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-games-sportradar')
debug.enable('import-games-sportradar,sportradar')

/**
 * Extract team mappings from Sportradar games response
 * @param {Array} games - Games from Sportradar API response
 * @returns {Map} Map of team data keyed by Sportradar team ID
 */
const extract_team_mappings = ({ games }) => {
  const team_mappings = new Map()

  for (const game of games) {
    // Extract home and away team data
    const teams = [game.home, game.away].filter(Boolean)

    for (const team of teams) {
      if (!team || !team.id) continue

      // Skip if we already have this team
      if (team_mappings.has(team.id)) continue

      team_mappings.set(team.id, {
        id: team.id,
        alias: team.alias || null,
        sr_id: team.sr_id || null,
        name: team.name || null,
        market: team.market || null,
        abbrev: team.alias ? fixTeam(team.alias) : null
      })
    }
  }

  log(`Extracted ${team_mappings.size} team mappings`)
  return team_mappings
}

/**
 * Store team mappings in the config table as a single row
 * @param {Map} team_mappings - Map of team data keyed by Sportradar team ID
 */
const store_team_mappings = async ({ team_mappings }) => {
  // Convert Map to object for storage
  const team_mappings_obj = Object.fromEntries(team_mappings)

  await db('config')
    .insert({
      key: 'sportradar_team_mappings',
      value: JSON.stringify(team_mappings_obj)
    })
    .onConflict('key')
    .merge()

  log(`Stored ${team_mappings.size} team mappings in config table`)
}

/**
 * Match a Sportradar game to an existing nfl_games record
 * @param {Object} sportradar_game - Game object from Sportradar API
 * @returns {Object|null} Matched game record or null
 */
const match_game_to_esbid = async ({ sportradar_game }) => {
  if (!sportradar_game.home || !sportradar_game.away) {
    log(`Game ${sportradar_game.id} missing home or away team`)
    return null
  }

  if (!sportradar_game.scheduled) {
    log(`Game ${sportradar_game.id} missing scheduled date`)
    return null
  }

  // Extract team abbreviations
  const home_team = fixTeam(sportradar_game.home.alias)
  const away_team = fixTeam(sportradar_game.away.alias)

  // Parse date from ISO string (e.g., "2024-09-08T17:00:00+00:00")
  const game_date = new Date(sportradar_game.scheduled)

  // Query for matching game
  // Match by date (within same day) + home team + away team
  const db_game = await db('nfl_games')
    .whereRaw('DATE(date) = DATE(?)', [game_date.toISOString()])
    .where({
      h: home_team,
      v: away_team
    })
    .first()

  if (!db_game) {
    log(
      `No match for ${away_team} @ ${home_team} on ${game_date.toISOString().split('T')[0]} (${sportradar_game.id})`
    )
  }

  return db_game
}

/**
 * Import games from Sportradar and map them to existing nfl_games records
 */
const import_games_sportradar = async ({
  year,
  week,
  all = false,
  dry = false
} = {}) => {
  console.time('import-games-sportradar-total')

  // Determine which years to process
  const years = []
  if (all) {
    // Import all available years (2018-2024 based on typical Sportradar coverage)
    for (let y = 2018; y <= 2024; y++) {
      years.push(y)
    }
  } else if (year) {
    years.push(year)
  } else {
    // Default to current year
    const current_year = new Date().getFullYear()
    years.push(current_year)
  }

  log(`Processing years: ${years.join(', ')}`)

  let total_games_processed = 0
  let total_games_matched = 0
  let total_games_updated = 0
  const all_team_mappings = new Map()

  // Process each year
  for (const process_year of years) {
    log(`Fetching games for ${process_year}...`)

    // Fetch schedule from Sportradar
    const schedule_data = await get_games_schedule({
      year: process_year,
      season_type: 'REG'
    })

    if (!schedule_data || !schedule_data.weeks) {
      log(`No schedule data returned for ${process_year}`)
      continue
    }

    // Flatten all games from all weeks
    const all_games = []
    for (const week_data of schedule_data.weeks) {
      if (week && week_data.sequence !== week) {
        continue // Skip weeks that don't match filter
      }

      if (week_data.games) {
        all_games.push(...week_data.games)
      }
    }

    log(`Found ${all_games.length} games for ${process_year}`)
    total_games_processed += all_games.length

    // Extract team mappings from this year's games
    const year_team_mappings = extract_team_mappings({ games: all_games })

    // Merge into overall team mappings
    for (const [team_id, team_data] of year_team_mappings) {
      all_team_mappings.set(team_id, team_data)
    }

    // Process each game
    for (const game of all_games) {
      const db_game = await match_game_to_esbid({ sportradar_game: game })

      if (db_game) {
        total_games_matched++

        // Update the game with Sportradar ID
        if (!dry) {
          await db('nfl_games')
            .where({ esbid: db_game.esbid })
            .update({
              sportradar_game_id: game.id,
              sportradar_season_id: schedule_data.id || null
            })

          total_games_updated++
          log(
            `Updated ${db_game.esbid} with Sportradar ID ${game.id} (${game.away?.alias} @ ${game.home?.alias})`
          )
        } else {
          log(
            `[DRY RUN] Would update ${db_game.esbid} with Sportradar ID ${game.id}`
          )
        }
      }
    }
  }

  // Store all team mappings
  if (!dry && all_team_mappings.size > 0) {
    await store_team_mappings({ team_mappings: all_team_mappings })
  } else if (dry) {
    log(
      `[DRY RUN] Would store ${all_team_mappings.size} team mappings in config table`
    )
  }

  // Summary
  log('\n=== Import Summary ===')
  log(`Total games processed: ${total_games_processed}`)
  log(`Games matched: ${total_games_matched}`)
  log(`Games updated: ${total_games_updated}`)
  log(`Games not matched: ${total_games_processed - total_games_matched}`)
  log(`Team mappings extracted: ${all_team_mappings.size}`)

  console.timeEnd('import-games-sportradar-total')
}

const main = async () => {
  let error
  try {
    const year = argv.year ? parseInt(argv.year) : null
    const week = argv.week ? parseInt(argv.week) : null
    const all = argv.all || false
    const dry = argv.dry || false

    if (!year && !all) {
      log('Warning: No --year specified, defaulting to current year')
    }

    await import_games_sportradar({ year, week, all, dry })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_GAMES_SPORTRADAR,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_games_sportradar
