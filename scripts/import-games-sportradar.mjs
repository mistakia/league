import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam } from '#libs-shared'
import { is_main, report_job } from '#libs-server'
import { get_games_schedule } from '#libs-server/sportradar/sportradar-api.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

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
 * Preload games from database for a given year
 * @param {number} year - The year to load games for
 * @param {number|null} week - Optional week filter
 * @returns {Map} Map of games keyed by "home-away" (without date for fuzzy matching)
 */
const preload_games = async ({ year, week = null }) => {
  const query = db('nfl_games')
    .select(
      'esbid',
      'year',
      'week',
      'date',
      'h',
      'v',
      'sportradar_game_id',
      'sportradar_season_id'
    )
    .where({ year })

  if (week) {
    query.where({ week })
  }

  const games = await query

  // Create a lookup map keyed by home-away teams
  // We'll match by teams and then verify the date is close
  const games_map = new Map()
  for (const game of games) {
    const lookup_key = `${game.h}-${game.v}`

    // If there are duplicate matchups in the same year, store as array
    if (games_map.has(lookup_key)) {
      const existing = games_map.get(lookup_key)
      if (Array.isArray(existing)) {
        existing.push(game)
      } else {
        games_map.set(lookup_key, [existing, game])
      }
    } else {
      games_map.set(lookup_key, game)
    }
  }

  log(
    `Preloaded ${games.length} games for year ${year}${week ? ` week ${week}` : ''}`
  )
  return games_map
}

/**
 * Match a Sportradar game to an existing nfl_games record
 * @param {Object} sportradar_game - Game object from Sportradar API
 * @param {Map} games_map - Preloaded games map
 * @returns {Object|null} Matched game record or null
 */
const match_game_to_esbid = ({ sportradar_game, games_map }) => {
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

  // Parse scheduled date - convert UTC to US Eastern time
  // Sportradar returns UTC timestamps, database stores Eastern dates
  const game_datetime_eastern = dayjs(sportradar_game.scheduled).tz(
    'America/New_York'
  )
  const date_local = game_datetime_eastern.format('YYYY-MM-DD')

  // Look up game by team matchup
  const lookup_key = `${home_team}-${away_team}`
  const db_result = games_map.get(lookup_key)

  if (!db_result) {
    log(
      `No match for ${away_team} @ ${home_team} on ${date_local} (${sportradar_game.id})`
    )
    return null
  }

  // Handle both single game and array of games (for duplicate matchups)
  const db_games = Array.isArray(db_result) ? db_result : [db_result]

  // If there's only one game for this matchup, return it (most common case)
  if (db_games.length === 1) {
    const db_game = db_games[0]

    // If date is null in DB, still match it (common for future games)
    if (!db_game.date) {
      return db_game
    }

    // Verify date is within +/- 2 days to handle timezone edge cases
    const db_date = dayjs.tz(db_game.date, 'YYYY/MM/DD', 'America/New_York')
    const date_diff_days = Math.abs(db_date.diff(game_datetime_eastern, 'day'))

    if (date_diff_days <= 2) {
      return db_game
    }

    log(
      `Date mismatch for ${away_team} @ ${home_team}: DB has ${db_game.date}, Sportradar has ${date_local} (${sportradar_game.id})`
    )
    return null
  }

  // Multiple games with same matchup - find the one with closest date
  for (const db_game of db_games) {
    // If date is null, skip it in favor of games with dates (unless it's the only option)
    if (!db_game.date) continue

    const db_date = dayjs.tz(db_game.date, 'YYYY/MM/DD', 'America/New_York')
    const date_diff_days = Math.abs(db_date.diff(game_datetime_eastern, 'day'))

    if (date_diff_days <= 2) {
      return db_game
    }
  }

  // If no date-matched game found, check if any have null dates
  for (const db_game of db_games) {
    if (!db_game.date) {
      return db_game
    }
  }

  log(
    `No date match for ${away_team} @ ${home_team} near ${date_local} (${sportradar_game.id})`
  )
  return null
}

/**
 * Import games from Sportradar and map them to existing nfl_games records
 */
const import_games_sportradar = async ({
  year,
  week,
  all = false,
  dry = false,
  ignore_cache = false,
  collector = null
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
  let total_games_skipped = 0
  const all_team_mappings = new Map()
  const unmatched_games = []

  // Process each year
  for (const process_year of years) {
    log(`Fetching games for ${process_year}...`)

    // Preload games from database for this year
    const games_map = await preload_games({ year: process_year, week })

    // Fetch schedule from Sportradar
    let schedule_data
    try {
      schedule_data = await get_games_schedule({
        year: process_year,
        season_type: 'REG',
        ignore_cache
      })
    } catch (error) {
      if (collector) {
        collector.add_error(error, {
          year: process_year,
          context: 'get_games_schedule'
        })
      }
      throw error
    }

    if (!schedule_data || !schedule_data.weeks) {
      log(`No schedule data returned for ${process_year}`)
      if (collector) {
        collector.add_warning(`No schedule data returned for ${process_year}`, {
          year: process_year
        })
      }
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
      const db_game = match_game_to_esbid({ sportradar_game: game, games_map })

      if (db_game) {
        total_games_matched++

        // Check if update is necessary
        const new_sportradar_game_id = game.id
        const new_sportradar_season_id = schedule_data.id || null

        const needs_update =
          db_game.sportradar_game_id !== new_sportradar_game_id ||
          db_game.sportradar_season_id !== new_sportradar_season_id

        if (!needs_update) {
          total_games_skipped++
          log(
            `Skipped ${db_game.esbid} - already has correct Sportradar IDs (${game.away?.alias} @ ${game.home?.alias})`
          )
          continue
        }

        // Update the game with Sportradar ID
        if (!dry) {
          await db('nfl_games').where({ esbid: db_game.esbid }).update({
            sportradar_game_id: new_sportradar_game_id,
            sportradar_season_id: new_sportradar_season_id
          })

          log(
            `Updated ${db_game.esbid} with Sportradar ID ${game.id} (${game.away?.alias} @ ${game.home?.alias})`
          )
        } else {
          log(
            `[DRY RUN] Would update ${db_game.esbid} with Sportradar ID ${game.id}`
          )
        }

        total_games_updated++
      } else {
        unmatched_games.push({
          sportradar_game_id: game.id,
          home: game.home?.alias,
          away: game.away?.alias,
          scheduled: game.scheduled
        })

        if (collector) {
          collector.add_warning(`Sportradar game not matched: ${game.id}`, {
            sportradar_game_id: game.id,
            home: game.home?.alias,
            away: game.away?.alias,
            scheduled: game.scheduled
          })
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
  log(`Games skipped (already correct): ${total_games_skipped}`)
  log(`Games not matched: ${total_games_processed - total_games_matched}`)
  log(`Team mappings extracted: ${all_team_mappings.size}`)

  const result = {
    games_processed: total_games_processed,
    games_matched: total_games_matched,
    games_updated: total_games_updated,
    games_skipped: total_games_skipped,
    games_not_matched: unmatched_games.length
  }

  if (collector) {
    collector.set_stats({
      games_processed: result.games_processed,
      games_updated: result.games_updated
    })
  }

  console.timeEnd('import-games-sportradar-total')

  return result
}

const main = async () => {
  const argv = initialize_cli()
  let error
  try {
    const year = argv.year ? parseInt(argv.year) : null
    const week = argv.week ? parseInt(argv.week) : null
    const all = argv.all || false
    const dry = argv.dry || false
    const ignore_cache = argv.ignore_cache || false

    if (!year && !all) {
      log('Warning: No --year specified, defaulting to current year')
    }

    await import_games_sportradar({ year, week, all, dry, ignore_cache })
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
