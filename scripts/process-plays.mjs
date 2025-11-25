import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main, update_play, report_job } from '#libs-server'
import player_cache, {
  preload_active_players
} from '#libs-server/player-cache.mjs'
import { enrich_plays } from '#libs-server/play-enrichment/index.mjs'
import db from '#db'
import { constants } from '#libs-shared'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  get_play_stats,
  get_completed_games
} from '#libs-server/play-stats-utils.mjs'
import populate_nfl_year_week_timestamp from './populate-nfl-year-week-timestamp.mjs'

const log = debug('process-plays')
debug.enable('process-plays,update-play')

const process_plays = async ({
  week = constants.season.last_week_with_stats,
  year = constants.season.year,
  seas_type = constants.season.nfl_seas_type,
  ignore_conflicts = false,
  dry_run = false
} = {}) => {
  let play_update_count = 0
  let play_field_update_count = 0

  // Get completed games first
  const completed_game_esbids = await get_completed_games({
    year,
    week,
    seas_type
  })
  log(
    `Found ${completed_game_esbids.length} completed games for ${year} week ${week}`
  )

  if (completed_game_esbids.length === 0) {
    log('No completed games found, skipping processing')
    return
  }

  // Preload player cache once for this processing session
  await preload_active_players()

  // Fetch play_stats for enrichment
  const play_stats = await get_play_stats({ year, week, seas_type })

  // Filter play stats to only include completed games
  const filtered_play_stats = play_stats.filter((stat) =>
    completed_game_esbids.includes(stat.esbid)
  )

  log('Fetching plays and games for enrichment')

  const plays = await db('nfl_plays')
    .select('nfl_plays.*')
    .where('nfl_plays.year', year)
    .where('nfl_plays.week', week)
    .where('nfl_plays.seas_type', seas_type)
    .whereIn('nfl_plays.esbid', completed_game_esbids)

  const games = await db('nfl_games').whereIn('esbid', completed_game_esbids)

  // Create games_map for enrichment
  const games_map = {}
  for (const game of games) {
    games_map[game.esbid] = game
  }

  log(`Enriching ${plays.length} plays using enrichment modules`)

  // Enrich plays using the new enrichment system
  const enriched_plays = await enrich_plays({
    plays,
    play_stats: filtered_play_stats,
    games_map,
    player_cache
  })

  log('Updating plays with enriched data')

  // In dry mode, sample some enriched plays for verification
  if (dry_run) {
    // Helper to extract enriched fields from a play
    const extract_enriched_fields = (play) => {
      const fields = {}
      const enriched_field_names = [
        'off',
        'def',
        'play_type',
        'bc_pid',
        'psr_pid',
        'trg_pid',
        'intp_pid',
        'player_fuml_pid',
        'td_pid',
        'tdp_pid',
        'sk_pid',
        'solo_tackle_1_pid',
        'solo_tackle_2_pid',
        'solo_tackle_3_pid',
        'assisted_tackle_1_pid',
        'assisted_tackle_2_pid',
        'tackle_assist_1_pid',
        'tackle_assist_2_pid',
        'tackle_assist_3_pid',
        'tackle_assist_4_pid'
      ]

      for (const field of enriched_field_names) {
        if (play[field]) fields[field] = play[field]
      }

      if (play.successful_play !== undefined) {
        fields.successful_play = play.successful_play
      }

      return fields
    }

    // Helper to check if play has enriched fields
    const has_enriched_fields = (play) => {
      return Object.keys(extract_enriched_fields(play)).length > 0
    }

    // Find some interesting plays to sample (passes, rushes, tackles, etc)
    const pass_plays = enriched_plays
      .filter((p) => p.psr_pid && p.trg_pid)
      .slice(0, 2)
    const rush_plays = enriched_plays
      .filter((p) => p.bc_pid && p.play_type === 'RUSH')
      .slice(0, 2)
    const tackle_plays = enriched_plays
      .filter((p) => p.solo_tackle_1_pid || p.assisted_tackle_1_pid)
      .slice(0, 2)
    const other_plays = enriched_plays
      .filter((p) => !p.psr_pid && !p.bc_pid && !p.solo_tackle_1_pid)
      .slice(0, 2)
    const sample_plays = [
      ...pass_plays,
      ...rush_plays,
      ...tackle_plays,
      ...other_plays
    ]

    log(`\n=== DRY RUN - Sample of ${sample_plays.length} enriched plays ===`)
    for (const play of sample_plays) {
      const enriched_fields = extract_enriched_fields(play)

      if (Object.keys(enriched_fields).length > 0) {
        log(`\nPlay ${play.esbid}-${play.playId}:`)
        log(JSON.stringify(enriched_fields, null, 2))
      }
    }
    log(`\n=== END DRY RUN SAMPLE ===\n`)

    // Summary statistics
    const plays_with_updates = enriched_plays.filter(has_enriched_fields)
    log(
      `Total plays that would be updated: ${plays_with_updates.length} out of ${enriched_plays.length}`
    )
  }

  // Update plays in database using update_play for change tracking
  for (const enriched_play of enriched_plays) {
    if (dry_run) continue

    play_update_count += 1

    // Fetch current play state for change tracking
    const current_play = await db('nfl_plays')
      .where({
        esbid: enriched_play.esbid,
        playId: enriched_play.playId
      })
      .first()

    if (!current_play) {
      log(
        `Warning: Play not found: ${enriched_play.esbid}-${enriched_play.playId}`
      )
      continue
    }

    // Build update object with enriched fields
    const update = {}

    // Add enriched fields if they were populated
    if (enriched_play.off) update.off = enriched_play.off
    if (enriched_play.def) update.def = enriched_play.def
    if (enriched_play.play_type) update.play_type = enriched_play.play_type
    if (enriched_play.successful_play !== undefined) {
      update.successful_play = enriched_play.successful_play
    }

    // Add player identification fields
    if (enriched_play.bc_pid) update.bc_pid = enriched_play.bc_pid
    if (enriched_play.psr_pid) update.psr_pid = enriched_play.psr_pid
    if (enriched_play.trg_pid) update.trg_pid = enriched_play.trg_pid
    if (enriched_play.intp_pid) update.intp_pid = enriched_play.intp_pid
    if (enriched_play.player_fuml_pid)
      update.player_fuml_pid = enriched_play.player_fuml_pid

    // Add tackle fields
    if (enriched_play.solo_tackle_1_pid)
      update.solo_tackle_1_pid = enriched_play.solo_tackle_1_pid
    if (enriched_play.solo_tackle_2_pid)
      update.solo_tackle_2_pid = enriched_play.solo_tackle_2_pid
    if (enriched_play.solo_tackle_3_pid)
      update.solo_tackle_3_pid = enriched_play.solo_tackle_3_pid
    if (enriched_play.assisted_tackle_1_pid)
      update.assisted_tackle_1_pid = enriched_play.assisted_tackle_1_pid
    if (enriched_play.assisted_tackle_2_pid)
      update.assisted_tackle_2_pid = enriched_play.assisted_tackle_2_pid
    if (enriched_play.tackle_assist_1_pid)
      update.tackle_assist_1_pid = enriched_play.tackle_assist_1_pid
    if (enriched_play.tackle_assist_2_pid)
      update.tackle_assist_2_pid = enriched_play.tackle_assist_2_pid
    if (enriched_play.tackle_assist_3_pid)
      update.tackle_assist_3_pid = enriched_play.tackle_assist_3_pid
    if (enriched_play.tackle_assist_4_pid)
      update.tackle_assist_4_pid = enriched_play.tackle_assist_4_pid

    // Skip if no updates needed
    if (Object.keys(update).length === 0) continue

    const changes = await update_play({
      play_row: current_play,
      update,
      ignore_conflicts
    })
    play_field_update_count += changes
  }

  log(
    `Updated ${play_field_update_count} play fields on ${play_update_count} plays from ${completed_game_esbids.length} completed games`
  )
}

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const year = argv.year
    const week = argv.week
    const seas_type = argv.seas_type || constants.season.nfl_seas_type
    const dry_run = argv.dry
    const ignore_conflicts = argv.ignore_conflicts || argv.force

    if (argv.all) {
      log('processing all plays')
      const results = await db('nfl_plays')
        .select('year')
        .groupBy('year')
        .orderBy('year', 'desc')

      let years = results.map((r) => r.year)
      if (argv.start) {
        years = years.filter((year) => year >= argv.start)
      }

      log(`processing plays for ${years.length} years`)

      for (const year of years) {
        for (const seas_type of constants.seas_types) {
          const weeks = await db('nfl_plays')
            .select('week')
            .where({ year, seas_type })
            .groupBy('week')
            .orderBy('week', 'asc')
          log(
            `processing plays for ${weeks.length} weeks in ${year} (${seas_type})`
          )
          for (const { week } of weeks) {
            log(`processing plays for week ${week} in ${year} (${seas_type})`)
            await process_plays({
              year,
              week,
              seas_type,
              dry_run,
              ignore_conflicts
            })
          }
        }
      }
    } else if (year && !week) {
      const weeks = await db('nfl_plays')
        .select('week')
        .where({ year, seas_type })
        .groupBy('week')
      log(`processing plays for ${year} ${seas_type}: ${weeks.length} weeks`)
      for (const { week } of weeks) {
        log(`processing plays for week ${week} in ${year}`)
        await process_plays({
          year,
          week,
          seas_type,
          dry_run,
          ignore_conflicts
        })
      }
    } else {
      await process_plays({
        year: argv.year,
        week: argv.week,
        seas_type: argv.seas_type,
        dry_run,
        ignore_conflicts
      })
    }

    // Refresh nfl_year_week_timestamp materialized view after processing plays
    if (!dry_run) {
      log('Refreshing nfl_year_week_timestamp materialized view...')
      try {
        const refresh_year = year || constants.season.year
        await populate_nfl_year_week_timestamp({ year: refresh_year })
        log('Successfully refreshed nfl_year_week_timestamp')
      } catch (refresh_error) {
        log(
          'Warning: Failed to refresh nfl_year_week_timestamp:',
          refresh_error.message
        )
        // Don't fail the entire job if materialized view refresh fails
      }
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROCESS_PLAYS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default process_plays
