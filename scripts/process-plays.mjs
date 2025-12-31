import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main, report_job, compute_play_changes } from '#libs-server'
import player_cache, {
  preload_active_players
} from '#libs-server/player-cache.mjs'
import { enrich_plays } from '#libs-server/play-enrichment/index.mjs'
import db from '#db'
import { current_season, nfl_season_types } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { chunk_array } from '#libs-shared/chunk.mjs'
import {
  get_play_stats,
  get_completed_games
} from '#libs-server/play-stats-utils.mjs'
import populate_nfl_year_week_timestamp from './populate-nfl-year-week-timestamp.mjs'

const log = debug('process-plays')
debug.enable('process-plays')

const ENRICHED_FIELD_NAMES = [
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

/**
 * Build update object from enriched play data
 */
const build_play_update_object = (enriched_play) => {
  const update = {}

  for (const field of ENRICHED_FIELD_NAMES) {
    if (enriched_play[field]) {
      update[field] = enriched_play[field]
    }
  }

  if (enriched_play.successful_play !== undefined) {
    update.successful_play = enriched_play.successful_play
  }

  return update
}

const process_plays = async ({
  week = current_season.last_week_with_stats,
  year = current_season.year,
  seas_type = current_season.nfl_seas_type,
  esbid = null,
  ignore_conflicts = false,
  dry_run = false,
  skip_changelog = false,
  batch_size = 500
} = {}) => {
  // Get completed games first
  let completed_game_esbids = await get_completed_games({
    year,
    week,
    seas_type
  })

  // Filter to specific game if esbid provided
  if (esbid) {
    completed_game_esbids = completed_game_esbids.filter((id) => id === esbid)
  }

  log(
    `Found ${completed_game_esbids.length} completed games for ${year} week ${week}${esbid ? ` (filtered to esbid: ${esbid})` : ''}`
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

  // Build lookup map from already-fetched plays (eliminates N+1 queries)
  const plays_map = new Map()
  for (const play of plays) {
    plays_map.set(`${play.esbid}-${play.playId}`, play)
  }

  log('Computing play changes')

  // Collect all changes using compute_play_changes
  const all_changelog_entries = []
  const all_play_updates = []

  for (const enriched_play of enriched_plays) {
    const current_play = plays_map.get(
      `${enriched_play.esbid}-${enriched_play.playId}`
    )

    if (!current_play) {
      continue
    }

    const update = build_play_update_object(enriched_play)
    if (Object.keys(update).length === 0) {
      continue
    }

    const { changelog_entries, field_updates, changes_count } =
      compute_play_changes({
        play_row: current_play,
        update,
        ignore_conflicts
      })

    if (changes_count > 0) {
      all_play_updates.push({
        esbid: enriched_play.esbid,
        playId: enriched_play.playId,
        field_updates
      })

      if (!skip_changelog) {
        all_changelog_entries.push(...changelog_entries)
      }
    }
  }

  log(
    `Found ${all_play_updates.length} plays with changes, ${all_changelog_entries.length} changelog entries`
  )

  // In dry mode, show sample and exit
  if (dry_run) {
    const sample_updates = all_play_updates.slice(0, 5)
    log(`\n=== DRY RUN - Sample of ${sample_updates.length} play updates ===`)
    for (const { esbid, playId, field_updates } of sample_updates) {
      log(`\nPlay ${esbid}-${playId}:`)
      log(JSON.stringify(field_updates, null, 2))
    }
    log(`\n=== END DRY RUN SAMPLE ===\n`)
    log(
      `Total plays that would be updated: ${all_play_updates.length} out of ${enriched_plays.length}`
    )
    return
  }

  // Batch persist within transaction
  if (all_play_updates.length > 0) {
    log(`Persisting changes in batches of ${batch_size}`)

    await db.transaction(async (trx) => {
      // Batch insert changelog entries
      if (all_changelog_entries.length > 0) {
        const changelog_chunks = chunk_array({
          items: all_changelog_entries,
          chunk_size: batch_size
        })

        for (const chunk of changelog_chunks) {
          await trx('play_changelog')
            .insert(chunk)
            .onConflict(['esbid', 'playId', 'prop', 'timestamp'])
            .ignore()
        }

        log(`Inserted ${all_changelog_entries.length} changelog entries`)
      }

      // Batch update plays
      const update_chunks = chunk_array({
        items: all_play_updates,
        chunk_size: batch_size
      })

      for (const chunk of update_chunks) {
        await Promise.all(
          chunk.map(({ esbid, playId, field_updates }) =>
            trx('nfl_plays').where({ esbid, playId }).update(field_updates)
          )
        )
      }

      log(`Updated ${all_play_updates.length} plays`)
    })
  }

  log(
    `Completed: ${all_play_updates.length} plays updated from ${completed_game_esbids.length} games`
  )
}

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('esbid', {
      type: 'string',
      describe: 'Process plays for a specific game ID only'
    })
    .option('skip-changelog', {
      type: 'boolean',
      default: false,
      describe: 'Skip writing to play_changelog table'
    })
    .option('batch-size', {
      type: 'number',
      default: 500,
      describe: 'Batch size for database operations'
    })
    .parse()
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const year = argv.year
    const week = argv.week
    const seas_type = argv.seas_type || current_season.nfl_seas_type
    const dry_run = argv.dry
    const ignore_conflicts = argv.ignore_conflicts || argv.force
    const skip_changelog = argv.skipChangelog
    const batch_size = argv.batchSize

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
        for (const seas_type of nfl_season_types) {
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
              ignore_conflicts,
              skip_changelog,
              batch_size
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
          ignore_conflicts,
          skip_changelog,
          batch_size
        })
      }
    } else {
      await process_plays({
        year: argv.year,
        week: argv.week,
        seas_type: argv.seas_type,
        esbid: argv.esbid,
        dry_run,
        ignore_conflicts,
        skip_changelog,
        batch_size
      })
    }

    // Refresh nfl_year_week_timestamp materialized view after processing plays
    if (!dry_run) {
      log('Refreshing nfl_year_week_timestamp materialized view...')
      try {
        const refresh_year = year || current_season.year
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
