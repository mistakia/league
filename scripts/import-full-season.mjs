/**
 * Full Season Import Pipeline
 *
 * Orchestrates downloading and processing all NFL season data including:
 * - Game imports from multiple sources (NFL, NGS, nflverse, Sportradar)
 * - Play imports from all sources in correct order
 * - Play processing and enrichment
 * - Player gamelog generation
 * - Advanced stats imports (PFF, Football Outsiders, ESPN)
 * - Validation against Pro Football Reference
 * - Data export to CSV files
 *
 * Usage:
 *   node scripts/import-full-season.mjs --year 2024 --ignore-cache
 *   node scripts/import-full-season.mjs --year 2024 --dry
 *   node scripts/import-full-season.mjs --year 2024 --seas-type REG
 *   node scripts/import-full-season.mjs --year 2024 --start-week 1 --end-week 5
 *   node scripts/import-full-season.mjs --year 2024 --skip-validation --skip-export
 */

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, wait } from '#libs-server'
import { current_season } from '#constants'
import {
  create_import_collector,
  print_unified_report,
  save_report_to_file
} from '#libs-server/import-reporting.mjs'

// Game import scripts
import import_nfl_games_nfl from './import-nfl-games-nfl.mjs'
import import_nfl_games_ngs from './import-nfl-games-ngs.mjs'
import import_nfl_games_nflverse from './import-nfl-games-nflverse-nfldata.mjs'
import import_games_sportradar from './import-games-sportradar.mjs'

// Play import scripts
import import_plays_nfl_v1 from './import-plays-nfl-v1.mjs'
import import_plays_nflfastr from './import-plays-nflfastr.mjs'
import import_plays_nflfastr_ftn from './import-plays-nflfastr-ftn.mjs'
import import_plays_sportradar from './import-plays-sportradar.mjs'
import process_plays from './process-plays.mjs'

// Gamelog and aggregation scripts
import generate_player_gamelogs from './generate-player-gamelogs.mjs'
import process_player_seasonlogs from './process-player-seasonlogs.mjs'

// Advanced stats scripts
import import_football_outsiders from './import-football-outsiders.mjs'
import import_espn_receiving_tracking_metrics from './import-espn-receiving-tracking-metrics.mjs'

// Validation script
import audit_player_gamelogs from './audit-player-gamelogs.mjs'

// Export scripts
import export_data_nfl_plays from './export-data-nfl-plays.mjs'
import export_data_nfl_games from './export-data-nfl-games.mjs'
import export_data_player_gamelogs from './export-data-player-gamelogs.mjs'

// Private scripts - import with graceful fallback
let import_plays_ngs = null
let import_plays_playerprofiler = null
let import_gamelogs_ngs = null
let import_pff_grades = null
let import_pff_seasonlogs = null
let import_pff_team_grades = null

try {
  const ngs_module = await import('../private/scripts/import-plays-ngs.mjs')
  import_plays_ngs = ngs_module.default
} catch {
  // Private script not available
}

try {
  const pp_module = await import(
    '../private/scripts/import-plays-playerprofiler.mjs'
  )
  import_plays_playerprofiler = pp_module.default
} catch {
  // Private script not available
}

try {
  const ngs_gl_module = await import(
    '../private/scripts/import-gamelogs-ngs.mjs'
  )
  import_gamelogs_ngs = ngs_gl_module.default
} catch {
  // Private script not available
}

try {
  const pff_grades_module = await import(
    '../private/scripts/import-pff-grades.mjs'
  )
  import_pff_grades = pff_grades_module.default
} catch {
  // Private script not available
}

try {
  const pff_seasonlogs_module = await import(
    '../private/scripts/import-pff-seasonlogs.mjs'
  )
  import_pff_seasonlogs = pff_seasonlogs_module.default
} catch {
  // Private script not available
}

try {
  const pff_team_module = await import(
    '../private/scripts/import-pff-team-grades.mjs'
  )
  import_pff_team_grades = pff_team_module.default
} catch {
  // Private script not available
}

const log = debug('import-full-season')
debug.enable(
  'import-full-season,import-reporting,import-nfl-games-nfl,import-nfl-games-ngs,import-nfl-games-nflverse,import-games-sportradar,import-plays-nfl-v1,import-nflfastr-plays,import-ftn-charting-plays,import-plays-sportradar,process-plays,generate-player-gamelogs,audit-player-gamelogs'
)

const DELAYS = {
  BETWEEN_WEEKS: 2000,
  BETWEEN_SCRIPTS: 1000,
  BETWEEN_STAGES: 3000
}

/**
 * Season week configuration
 */
const SEASON_WEEK_CONFIG = {
  PRE: { start: 1, end: 4 },
  REG: { start: 1, end: 18 },
  POST: { start: 19, end: 22 }
}

/**
 * Get week range for a season type
 */
const get_season_weeks = (seas_type, start_week = null, end_week = null) => {
  const config = SEASON_WEEK_CONFIG[seas_type]
  if (!config) {
    throw new Error(`Invalid seas_type: ${seas_type}`)
  }

  const start = start_week ?? config.start
  const end = end_week ?? config.end

  const weeks = []
  for (let week = start; week <= end; week++) {
    weeks.push(week)
  }
  return weeks
}

/**
 * Import games from all sources for a season
 */
const import_games_for_season = async ({
  year,
  seas_type,
  ignore_cache,
  dry,
  collector
}) => {
  collector.start_stage('game_imports', { year, seas_type })

  const weeks = get_season_weeks(seas_type)

  for (const week of weeks) {
    log(`Importing games for ${year} ${seas_type} Week ${week}`)

    // 1. NFL Games (base game structure)
    try {
      await import_nfl_games_nfl({
        year,
        week,
        seas_type,
        ignore_cache,
        collector
      })
    } catch (error) {
      collector.add_error(error, {
        script: 'import_nfl_games_nfl',
        year,
        week,
        seas_type
      })
    }
    await wait(DELAYS.BETWEEN_SCRIPTS)

    // 2. NGS Games (NGS IDs)
    try {
      await import_nfl_games_ngs({
        year,
        week,
        seas_type,
        ignore_cache,
        collector
      })
    } catch (error) {
      collector.add_error(error, {
        script: 'import_nfl_games_ngs',
        year,
        week,
        seas_type
      })
    }
    await wait(DELAYS.BETWEEN_SCRIPTS)

    // 3. nflverse Games (metadata, betting lines)
    try {
      await import_nfl_games_nflverse({
        year,
        week,
        seas_type,
        ignore_cache,
        collector
      })
    } catch (error) {
      collector.add_error(error, {
        script: 'import_nfl_games_nflverse',
        year,
        week,
        seas_type
      })
    }
    await wait(DELAYS.BETWEEN_SCRIPTS)

    // 4. Sportradar Games (sportradar mapping)
    try {
      await import_games_sportradar({
        year,
        week,
        seas_type,
        ignore_cache,
        collector
      })
    } catch (error) {
      collector.add_error(error, {
        script: 'import_games_sportradar',
        year,
        week,
        seas_type
      })
    }

    if (week < weeks[weeks.length - 1]) {
      await wait(DELAYS.BETWEEN_WEEKS)
    }
  }

  collector.end_stage()
}

/**
 * Import plays from all sources for a single week
 */
const import_plays_for_week = async ({
  year,
  week,
  seas_type,
  ignore_cache,
  dry,
  collector
}) => {
  collector.start_stage(`play_imports_week_${week}`, { year, week, seas_type })

  // 1. NFL v1 (base structure)
  try {
    await import_plays_nfl_v1({
      year,
      week,
      seas_type,
      ignore_cache,
      collector
    })
  } catch (error) {
    collector.add_error(error, {
      script: 'import_plays_nfl_v1',
      year,
      week,
      seas_type
    })
  }
  await wait(DELAYS.BETWEEN_SCRIPTS)

  // 2. NGS Plays (if available)
  if (import_plays_ngs) {
    try {
      await import_plays_ngs({ year, week, seas_type, ignore_cache, collector })
    } catch (error) {
      collector.add_error(error, {
        script: 'import_plays_ngs',
        year,
        week,
        seas_type
      })
    }
    await wait(DELAYS.BETWEEN_SCRIPTS)
  }

  // 3. nflfastR (EPA, WPA, probability metrics)
  try {
    await import_plays_nflfastr({
      year,
      week,
      seas_type,
      ignore_cache,
      collector
    })
  } catch (error) {
    collector.add_error(error, {
      script: 'import_plays_nflfastr',
      year,
      week,
      seas_type
    })
  }
  await wait(DELAYS.BETWEEN_SCRIPTS)

  // 4. nflfastR-FTN (charting data)
  try {
    await import_plays_nflfastr_ftn({
      year,
      week,
      seas_type,
      ignore_cache,
      collector
    })
  } catch (error) {
    collector.add_error(error, {
      script: 'import_plays_nflfastr_ftn',
      year,
      week,
      seas_type
    })
  }
  await wait(DELAYS.BETWEEN_SCRIPTS)

  // 5. Sportradar (detailed play-by-play)
  try {
    await import_plays_sportradar({
      year,
      week,
      seas_type,
      ignore_cache,
      collector
    })
  } catch (error) {
    collector.add_error(error, {
      script: 'import_plays_sportradar',
      year,
      week,
      seas_type
    })
  }
  await wait(DELAYS.BETWEEN_SCRIPTS)

  // 6. PlayerProfiler (if available)
  if (import_plays_playerprofiler) {
    try {
      await import_plays_playerprofiler({
        year,
        week,
        seas_type,
        ignore_cache,
        collector
      })
    } catch (error) {
      collector.add_error(error, {
        script: 'import_plays_playerprofiler',
        year,
        week,
        seas_type
      })
    }
  }

  collector.end_stage()
}

/**
 * Process plays for a single week (enrichment)
 */
const process_plays_for_week = async ({
  year,
  week,
  seas_type,
  dry,
  collector
}) => {
  collector.start_stage(`play_processing_week_${week}`, {
    year,
    week,
    seas_type
  })

  try {
    await process_plays({ year, week, seas_type, dry_run: dry, collector })
  } catch (error) {
    collector.add_error(error, {
      script: 'process_plays',
      year,
      week,
      seas_type
    })
  }

  collector.end_stage()
}

/**
 * Generate player gamelogs for a single week
 */
const generate_gamelogs_for_week = async ({
  year,
  week,
  seas_type,
  dry,
  collector
}) => {
  collector.start_stage(`gamelog_generation_week_${week}`, {
    year,
    week,
    seas_type
  })

  try {
    await generate_player_gamelogs({ year, week, seas_type, dry })
  } catch (error) {
    collector.add_error(error, {
      script: 'generate_player_gamelogs',
      year,
      week,
      seas_type
    })
  }

  // Import NGS gamelogs if available
  if (import_gamelogs_ngs) {
    await wait(DELAYS.BETWEEN_SCRIPTS)
    try {
      await import_gamelogs_ngs({ year, week, seas_type, collector })
    } catch (error) {
      collector.add_error(error, {
        script: 'import_gamelogs_ngs',
        year,
        week,
        seas_type
      })
    }
  }

  collector.end_stage()
}

/**
 * Run aggregation scripts (seasonlogs, careerlogs)
 */
const run_aggregation = async ({ year, seas_types, dry, collector }) => {
  collector.start_stage('aggregation', { year, seas_types })

  // Process player seasonlogs for each season type
  for (const seas_type of seas_types) {
    try {
      await process_player_seasonlogs({ year, seas_type })
    } catch (error) {
      collector.add_error(error, {
        script: 'process_player_seasonlogs',
        year,
        seas_type
      })
    }
    await wait(DELAYS.BETWEEN_SCRIPTS)
  }

  collector.end_stage()
}

/**
 * Run advanced stats imports (PFF, Football Outsiders, ESPN)
 */
const run_advanced_stats = async ({ year, ignore_cache, collector }) => {
  collector.start_stage('advanced_stats', { year })

  // Football Outsiders (public)
  try {
    await import_football_outsiders({ collector })
  } catch (error) {
    collector.add_error(error, { script: 'import_football_outsiders', year })
  }
  await wait(DELAYS.BETWEEN_SCRIPTS)

  // ESPN Receiving Tracking Metrics (public)
  try {
    await import_espn_receiving_tracking_metrics({ ignore_cache, collector })
  } catch (error) {
    collector.add_error(error, {
      script: 'import_espn_receiving_tracking_metrics',
      year
    })
  }
  await wait(DELAYS.BETWEEN_SCRIPTS)

  // PFF Grades (private)
  if (import_pff_grades) {
    try {
      await import_pff_grades({ year, collector })
    } catch (error) {
      collector.add_error(error, { script: 'import_pff_grades', year })
    }
    await wait(DELAYS.BETWEEN_SCRIPTS)
  }

  // PFF Seasonlogs (private)
  if (import_pff_seasonlogs) {
    try {
      await import_pff_seasonlogs({ year, collector })
    } catch (error) {
      collector.add_error(error, { script: 'import_pff_seasonlogs', year })
    }
    await wait(DELAYS.BETWEEN_SCRIPTS)
  }

  // PFF Team Grades (private)
  if (import_pff_team_grades) {
    try {
      await import_pff_team_grades({ year, include_weeks: true, collector })
    } catch (error) {
      collector.add_error(error, { script: 'import_pff_team_grades', year })
    }
  }

  collector.end_stage()
}

/**
 * Run validation against PFR
 */
const run_validation = async ({ year, ignore_cache, collector }) => {
  collector.start_stage('validation', { year })

  try {
    await audit_player_gamelogs({ year, ignore_cache, collector })
  } catch (error) {
    collector.add_error(error, { script: 'audit_player_gamelogs', year })
  }

  collector.end_stage()
}

/**
 * Run data exports
 */
const run_exports = async ({ year, collector }) => {
  collector.start_stage('exports', { year })

  try {
    await export_data_nfl_plays({ year })
  } catch (error) {
    collector.add_error(error, { script: 'export_data_nfl_plays', year })
  }
  await wait(DELAYS.BETWEEN_SCRIPTS)

  try {
    await export_data_nfl_games({ year })
  } catch (error) {
    collector.add_error(error, { script: 'export_data_nfl_games', year })
  }
  await wait(DELAYS.BETWEEN_SCRIPTS)

  try {
    await export_data_player_gamelogs({ year })
  } catch (error) {
    collector.add_error(error, { script: 'export_data_player_gamelogs', year })
  }

  collector.end_stage()
}

/**
 * Main import pipeline
 */
const import_full_season = async ({
  year = current_season.year,
  dry = false,
  ignore_cache = false,
  seas_type = null,
  skip_validation = false,
  skip_export = false,
  skip_advanced_stats = false,
  start_week = null,
  end_week = null
} = {}) => {
  const collector = create_import_collector(year)

  log(`Starting full season import for ${year}`)
  log(
    `Options: dry=${dry}, ignore_cache=${ignore_cache}, seas_type=${seas_type || 'ALL'}`
  )

  // Determine which season types to process
  const seas_types = seas_type ? [seas_type] : ['PRE', 'REG', 'POST']

  // Stage 1: Game Imports
  log('=== Stage 1: Game Imports ===')
  for (const st of seas_types) {
    await import_games_for_season({
      year,
      seas_type: st,
      ignore_cache,
      dry,
      collector
    })
    await wait(DELAYS.BETWEEN_STAGES)
  }

  // Stage 2-4: Play Imports, Processing, and Gamelogs (per week)
  log('=== Stages 2-4: Play Imports, Processing, Gamelogs ===')
  for (const st of seas_types) {
    const weeks = get_season_weeks(st, start_week, end_week)

    for (const week of weeks) {
      log(`Processing ${year} ${st} Week ${week}`)

      // Import plays for week
      await import_plays_for_week({
        year,
        week,
        seas_type: st,
        ignore_cache,
        dry,
        collector
      })
      await wait(DELAYS.BETWEEN_STAGES)

      // Process plays for week
      await process_plays_for_week({
        year,
        week,
        seas_type: st,
        dry,
        collector
      })
      await wait(DELAYS.BETWEEN_STAGES)

      // Generate gamelogs for week
      await generate_gamelogs_for_week({
        year,
        week,
        seas_type: st,
        dry,
        collector
      })
      await wait(DELAYS.BETWEEN_WEEKS)
    }
  }

  // Stage 5: Aggregation (once at end)
  log('=== Stage 5: Aggregation ===')
  await run_aggregation({ year, seas_types, dry, collector })
  await wait(DELAYS.BETWEEN_STAGES)

  // Stage 6: Advanced Stats
  if (!skip_advanced_stats) {
    log('=== Stage 6: Advanced Stats ===')
    await run_advanced_stats({ year, ignore_cache, collector })
    await wait(DELAYS.BETWEEN_STAGES)
  }

  // Stage 7: Validation
  if (!skip_validation) {
    log('=== Stage 7: Validation ===')
    await run_validation({ year, ignore_cache, collector })
    await wait(DELAYS.BETWEEN_STAGES)
  }

  // Stage 8: Exports
  if (!skip_export) {
    log('=== Stage 8: Exports ===')
    await run_exports({ year, collector })
  }

  // Generate and save report
  print_unified_report(collector)

  if (!dry) {
    const report_path = await save_report_to_file(collector)
    log(`Report saved to: ${report_path}`)
  }

  return collector.get_summary()
}

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('year', {
      type: 'number',
      describe: 'Season year to import',
      default: current_season.year
    })
    .option('dry', {
      type: 'boolean',
      describe: 'Dry run - do not write to database',
      default: false
    })
    .option('ignore-cache', {
      type: 'boolean',
      describe: 'Bypass cache and fetch fresh data',
      default: false
    })
    .option('seas-type', {
      type: 'string',
      describe: 'Season type: PRE, REG, or POST',
      choices: ['PRE', 'REG', 'POST']
    })
    .option('skip-validation', {
      type: 'boolean',
      describe: 'Skip PFR validation stage',
      default: false
    })
    .option('skip-export', {
      type: 'boolean',
      describe: 'Skip data export stage',
      default: false
    })
    .option('skip-advanced-stats', {
      type: 'boolean',
      describe: 'Skip advanced stats import stage',
      default: false
    })
    .option('start-week', {
      type: 'number',
      describe: 'Start week (overrides season type defaults)'
    })
    .option('end-week', {
      type: 'number',
      describe: 'End week (overrides season type defaults)'
    })
    .parse()
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await import_full_season({
      year: argv.year,
      dry: argv.dry,
      ignore_cache: argv['ignore-cache'],
      seas_type: argv['seas-type'],
      skip_validation: argv['skip-validation'],
      skip_export: argv['skip-export'],
      skip_advanced_stats: argv['skip-advanced-stats'],
      start_week: argv['start-week'],
      end_week: argv['end-week']
    })
  } catch (err) {
    error = err
    log('Fatal error:', error)
  }

  // Close database connection
  await db.destroy()

  if (error) {
    process.exit(1)
  }
  process.exit(0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_full_season
