/**
 * Full Season Import Pipeline
 *
 * Orchestrates downloading and processing all NFL season data including:
 * - Game imports from multiple sources (NFL, NGS, nflverse, Sportradar)
 * - Play imports from all sources in correct order
 * - Play processing and enrichment
 * - Player gamelog generation
 * - Advanced stats imports (PFF, ESPN)
 * - Validation against Pro Football Reference
 * - Data export to CSV files
 *
 * Stages: games, plays, processing, gamelogs, aggregation, advanced, validation, exports
 *
 * Stage Sources:
 *   games: nfl, ngs, nflverse, sportradar
 *   plays: nfl, ngs, nflfastr, ftn, sportradar
 *     - Per-week (nfl, ngs, sportradar): Run for each week in sequence
 *     - Full-season (nflfastr, ftn): Run once after all weeks complete
 *       (These use single CSV files for the entire season)
 *   gamelogs: ngs
 *   advanced: espn, pff
 *
 * Usage:
 *   # Basic usage
 *   node scripts/import-full-season.mjs --year 2024 --ignore-cache
 *   node scripts/import-full-season.mjs --year 2024 --dry
 *   node scripts/import-full-season.mjs --year 2024 --seas-type REG
 *   node scripts/import-full-season.mjs --year 2024 --start-week 1 --end-week 5
 *
 *   # Stage control
 *   node scripts/import-full-season.mjs --year 2024 --start-stage plays
 *   node scripts/import-full-season.mjs --year 2024 --end-stage gamelogs
 *   node scripts/import-full-season.mjs --year 2024 --skip-stages processing,validation
 *
 *   # Source-level skipping
 *   node scripts/import-full-season.mjs --year 2024 --skip plays.nflfastr,plays.ftn,games.sportradar
 *
 *   # Combined options
 *   node scripts/import-full-season.mjs --year 2024 --start-stage plays --skip plays.nflfastr
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
import import_espn_receiving_tracking_metrics from './import-espn-receiving-tracking-metrics.mjs'

// Validation script
import audit_player_gamelogs from './audit-player-gamelogs.mjs'

// Export scripts
import export_data_nfl_plays from './export-data-nfl-plays.mjs'
import export_data_nfl_games from './export-data-nfl-games.mjs'
import export_data_player_gamelogs from './export-data-player-gamelogs.mjs'

// Private scripts - import with graceful fallback
let import_plays_ngs = null
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
 * Stage execution order for the import pipeline
 */
const STAGE_ORDER = [
  'games',
  'plays',
  'processing',
  'gamelogs',
  'aggregation',
  'advanced',
  'validation',
  'exports'
]

/**
 * Data sources available for each stage
 * Only stages with multiple skippable sources are listed
 *
 * Note: plays stage has two sub-categories:
 * - Per-week sources (nfl, ngs, sportradar): Run for each week in the loop
 * - Full-season sources (nflfastr, ftn): Run once after all weeks complete
 *   These use single CSV files for the entire season and should not be run per-week
 *   to avoid play cache staleness issues.
 */
const STAGE_SOURCES = {
  games: ['nfl', 'ngs', 'nflverse', 'sportradar'],
  plays: ['nfl', 'ngs', 'nflfastr', 'ftn', 'sportradar'],
  gamelogs: ['ngs'],
  advanced: ['espn', 'pff']
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
 * Determine if a stage should run based on start/end/skip configuration
 */
const should_run_stage = ({
  stage_name,
  start_stage = null,
  end_stage = null,
  skip_stages = []
}) => {
  // Check if stage is in skip list
  if (skip_stages.includes(stage_name)) {
    return false
  }

  const stage_index = STAGE_ORDER.indexOf(stage_name)

  // Check start_stage boundary
  if (start_stage) {
    const start_index = STAGE_ORDER.indexOf(start_stage)
    if (stage_index < start_index) {
      return false
    }
  }

  // Check end_stage boundary
  if (end_stage) {
    const end_index = STAGE_ORDER.indexOf(end_stage)
    if (stage_index > end_index) {
      return false
    }
  }

  return true
}

/**
 * Determine if a source should run within a stage based on skip configuration
 */
const should_run_source = ({ stage_name, source_name, skip_sources = [] }) => {
  const stage_source_key = `${stage_name}.${source_name}`
  return !skip_sources.includes(stage_source_key)
}

/**
 * Parse and validate skip sources string (e.g., "plays.nflfastr,games.sportradar")
 */
const parse_skip_sources = (skip_string) => {
  if (!skip_string) {
    return []
  }

  const skip_sources = skip_string.split(',').map((s) => s.trim())

  for (const skip_source of skip_sources) {
    if (!skip_source.includes('.')) {
      throw new Error(
        `Invalid skip source format: "${skip_source}". Expected format: stage.source (e.g., plays.nflfastr)`
      )
    }

    const [stage, source] = skip_source.split('.')

    if (!STAGE_ORDER.includes(stage)) {
      throw new Error(
        `Invalid stage in skip source: "${stage}". Valid stages: ${STAGE_ORDER.join(', ')}`
      )
    }

    if (!STAGE_SOURCES[stage]) {
      throw new Error(
        `Stage "${stage}" does not have skippable sources. Stages with sources: ${Object.keys(STAGE_SOURCES).join(', ')}`
      )
    }

    if (!STAGE_SOURCES[stage].includes(source)) {
      throw new Error(
        `Invalid source "${source}" for stage "${stage}". Valid sources: ${STAGE_SOURCES[stage].join(', ')}`
      )
    }
  }

  return skip_sources
}

/**
 * Validate stage configuration CLI arguments
 */
const validate_stage_config = ({
  start_stage = null,
  end_stage = null,
  skip_stages = []
}) => {
  // Validate start_stage
  if (start_stage && !STAGE_ORDER.includes(start_stage)) {
    throw new Error(
      `Invalid start_stage: "${start_stage}". Valid stages: ${STAGE_ORDER.join(', ')}`
    )
  }

  // Validate end_stage
  if (end_stage && !STAGE_ORDER.includes(end_stage)) {
    throw new Error(
      `Invalid end_stage: "${end_stage}". Valid stages: ${STAGE_ORDER.join(', ')}`
    )
  }

  // Validate start_stage comes before end_stage
  if (start_stage && end_stage) {
    const start_index = STAGE_ORDER.indexOf(start_stage)
    const end_index = STAGE_ORDER.indexOf(end_stage)
    if (start_index > end_index) {
      throw new Error(
        `start_stage "${start_stage}" must come before end_stage "${end_stage}" in pipeline order`
      )
    }
  }

  // Validate skip_stages
  for (const skip_stage of skip_stages) {
    if (!STAGE_ORDER.includes(skip_stage)) {
      throw new Error(
        `Invalid skip_stage: "${skip_stage}". Valid stages: ${STAGE_ORDER.join(', ')}`
      )
    }
  }
}

/**
 * Import games from all sources for a season
 */
const import_games_for_season = async ({
  year,
  seas_type,
  ignore_cache,
  dry,
  collector,
  skip_sources = []
}) => {
  collector.start_stage('game_imports', { year, seas_type })

  const weeks = get_season_weeks(seas_type)

  for (const week of weeks) {
    log(`Importing games for ${year} ${seas_type} Week ${week}`)

    // 1. NFL Games (base game structure)
    if (
      should_run_source({
        stage_name: 'games',
        source_name: 'nfl',
        skip_sources
      })
    ) {
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
    } else {
      log(`Skipping games.nfl (in skip list)`)
    }

    // 2. NGS Games (NGS IDs)
    if (
      should_run_source({
        stage_name: 'games',
        source_name: 'ngs',
        skip_sources
      })
    ) {
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
    } else {
      log(`Skipping games.ngs (in skip list)`)
    }

    // 3. nflverse Games (metadata, betting lines)
    if (
      should_run_source({
        stage_name: 'games',
        source_name: 'nflverse',
        skip_sources
      })
    ) {
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
    } else {
      log(`Skipping games.nflverse (in skip list)`)
    }

    // 4. Sportradar Games (sportradar mapping)
    if (
      should_run_source({
        stage_name: 'games',
        source_name: 'sportradar',
        skip_sources
      })
    ) {
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
    } else {
      log(`Skipping games.sportradar (in skip list)`)
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
  collector,
  skip_sources = []
}) => {
  collector.start_stage(`play_imports_week_${week}`, { year, week, seas_type })

  // 1. NFL v1 (base structure)
  if (
    should_run_source({ stage_name: 'plays', source_name: 'nfl', skip_sources })
  ) {
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
  } else {
    log(`Skipping plays.nfl (in skip list)`)
  }

  // 2. NGS Plays (if available)
  if (
    import_plays_ngs &&
    should_run_source({ stage_name: 'plays', source_name: 'ngs', skip_sources })
  ) {
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
  } else if (import_plays_ngs) {
    log(`Skipping plays.ngs (in skip list)`)
  }

  // Note: nflfastr and ftn imports moved to import_nflverse_plays_for_season()
  // They use full-season CSV files and should only run once after all weeks complete

  // 3. Sportradar (detailed play-by-play)
  if (
    should_run_source({
      stage_name: 'plays',
      source_name: 'sportradar',
      skip_sources
    })
  ) {
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
  } else {
    log(`Skipping plays.sportradar (in skip list)`)
  }
  collector.end_stage()
}

/**
 * Import nflverse play data for the entire season (nflfastr, ftn)
 *
 * These sources provide single CSV files for the entire season and should
 * only be run once after all per-week play imports complete. Running them
 * per-week causes play cache staleness issues since the cache is initialized
 * once and not reloaded between weeks.
 */
const import_nflverse_plays_for_season = async ({
  year,
  ignore_cache,
  collector,
  skip_sources = []
}) => {
  collector.start_stage('nflverse_play_imports', { year })

  // 1. nflfastR (EPA, WPA, probability metrics) - full season CSV
  if (
    should_run_source({
      stage_name: 'plays',
      source_name: 'nflfastr',
      skip_sources
    })
  ) {
    log(`Importing nflfastr plays for entire ${year} season`)
    try {
      await import_plays_nflfastr({
        year,
        force_download: ignore_cache,
        collector
      })
    } catch (error) {
      collector.add_error(error, {
        script: 'import_plays_nflfastr',
        year
      })
    }
    await wait(DELAYS.BETWEEN_SCRIPTS)
  } else {
    log(`Skipping plays.nflfastr (in skip list)`)
  }

  // 2. nflfastR-FTN (charting data) - full season CSV
  // Depends on nflfastr plays existing for proper matching
  if (
    should_run_source({ stage_name: 'plays', source_name: 'ftn', skip_sources })
  ) {
    log(`Importing FTN charting data for entire ${year} season`)
    try {
      await import_plays_nflfastr_ftn({
        year,
        force_download: ignore_cache,
        collector
      })
    } catch (error) {
      collector.add_error(error, {
        script: 'import_plays_nflfastr_ftn',
        year
      })
    }
  } else {
    log(`Skipping plays.ftn (in skip list)`)
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
  collector,
  skip_sources = []
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
  if (
    import_gamelogs_ngs &&
    should_run_source({
      stage_name: 'gamelogs',
      source_name: 'ngs',
      skip_sources
    })
  ) {
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
  } else if (import_gamelogs_ngs) {
    log(`Skipping gamelogs.ngs (in skip list)`)
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
const run_advanced_stats = async ({
  year,
  ignore_cache,
  collector,
  skip_sources = []
}) => {
  collector.start_stage('advanced_stats', { year })

  // ESPN Receiving Tracking Metrics (public)
  if (
    should_run_source({
      stage_name: 'advanced',
      source_name: 'espn',
      skip_sources
    })
  ) {
    try {
      await import_espn_receiving_tracking_metrics({ ignore_cache, collector })
    } catch (error) {
      collector.add_error(error, {
        script: 'import_espn_receiving_tracking_metrics',
        year
      })
    }
    await wait(DELAYS.BETWEEN_SCRIPTS)
  } else {
    log(`Skipping advanced.espn (in skip list)`)
  }

  // PFF Grades (private)
  if (
    import_pff_grades &&
    should_run_source({
      stage_name: 'advanced',
      source_name: 'pff',
      skip_sources
    })
  ) {
    try {
      await import_pff_grades({ year, collector })
    } catch (error) {
      collector.add_error(error, { script: 'import_pff_grades', year })
    }
    await wait(DELAYS.BETWEEN_SCRIPTS)
  } else if (import_pff_grades) {
    log(`Skipping advanced.pff (in skip list)`)
  }

  // PFF Seasonlogs (private)
  if (
    import_pff_seasonlogs &&
    should_run_source({
      stage_name: 'advanced',
      source_name: 'pff',
      skip_sources
    })
  ) {
    try {
      await import_pff_seasonlogs({ year, collector })
    } catch (error) {
      collector.add_error(error, { script: 'import_pff_seasonlogs', year })
    }
    await wait(DELAYS.BETWEEN_SCRIPTS)
  }

  // PFF Team Grades (private)
  if (
    import_pff_team_grades &&
    should_run_source({
      stage_name: 'advanced',
      source_name: 'pff',
      skip_sources
    })
  ) {
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
  start_week = null,
  end_week = null,
  start_stage = null,
  end_stage = null,
  skip_stages = [],
  skip_sources = []
} = {}) => {
  // Validate stage configuration
  validate_stage_config({ start_stage, end_stage, skip_stages })

  const collector = create_import_collector(year)

  // Build stage config for helper functions
  const stage_config = { start_stage, end_stage, skip_stages }

  log(`Starting full season import for ${year}`)
  log(
    `Options: dry=${dry}, ignore_cache=${ignore_cache}, seas_type=${seas_type || 'ALL'}`
  )

  // Log active stages
  const active_stages = STAGE_ORDER.filter((stage) =>
    should_run_stage({ stage_name: stage, ...stage_config })
  )
  log(`Active stages: ${active_stages.join(' -> ')}`)

  if (skip_stages.length > 0) {
    log(`Skipped stages: ${skip_stages.join(', ')}`)
  }
  if (skip_sources.length > 0) {
    log(`Skipped sources: ${skip_sources.join(', ')}`)
  }

  // Determine which season types to process
  const seas_types = seas_type ? [seas_type] : ['PRE', 'REG', 'POST']

  // Stage 1: Game Imports
  if (should_run_stage({ stage_name: 'games', ...stage_config })) {
    log('=== Stage 1: Game Imports ===')
    for (const st of seas_types) {
      await import_games_for_season({
        year,
        seas_type: st,
        ignore_cache,
        dry,
        collector,
        skip_sources
      })
      await wait(DELAYS.BETWEEN_STAGES)
    }
  } else {
    log('=== Stage 1: Game Imports (SKIPPED) ===')
  }

  // Stage 2-4: Play Imports, Processing, and Gamelogs (per week)
  const run_plays = should_run_stage({ stage_name: 'plays', ...stage_config })
  const run_processing = should_run_stage({
    stage_name: 'processing',
    ...stage_config
  })
  const run_gamelogs = should_run_stage({
    stage_name: 'gamelogs',
    ...stage_config
  })

  if (run_plays || run_processing || run_gamelogs) {
    log('=== Stages 2-4: Play Imports, Processing, Gamelogs ===')
    for (const st of seas_types) {
      const weeks = get_season_weeks(st, start_week, end_week)

      for (const week of weeks) {
        log(`Processing ${year} ${st} Week ${week}`)

        // Import plays for week
        if (run_plays) {
          await import_plays_for_week({
            year,
            week,
            seas_type: st,
            ignore_cache,
            dry,
            collector,
            skip_sources
          })
          await wait(DELAYS.BETWEEN_STAGES)
        }

        // Process plays for week
        if (run_processing) {
          await process_plays_for_week({
            year,
            week,
            seas_type: st,
            dry,
            collector
          })
          await wait(DELAYS.BETWEEN_STAGES)
        }

        // Generate gamelogs for week
        if (run_gamelogs) {
          await generate_gamelogs_for_week({
            year,
            week,
            seas_type: st,
            dry,
            collector,
            skip_sources
          })
          await wait(DELAYS.BETWEEN_WEEKS)
        }
      }
    }

    // After all per-week imports complete, run full-season nflverse imports
    // These use single CSV files for the entire season and must run after
    // all per-week play data is imported to ensure proper cache population
    if (run_plays) {
      log('=== nflverse Full-Season Play Imports (nflfastr, ftn) ===')
      await import_nflverse_plays_for_season({
        year,
        ignore_cache,
        collector,
        skip_sources
      })
      await wait(DELAYS.BETWEEN_STAGES)
    }
  } else {
    log('=== Stages 2-4: Play Imports, Processing, Gamelogs (SKIPPED) ===')
  }

  // Stage 5: Aggregation (once at end)
  if (should_run_stage({ stage_name: 'aggregation', ...stage_config })) {
    log('=== Stage 5: Aggregation ===')
    await run_aggregation({ year, seas_types, dry, collector })
    await wait(DELAYS.BETWEEN_STAGES)
  } else {
    log('=== Stage 5: Aggregation (SKIPPED) ===')
  }

  // Stage 6: Advanced Stats
  if (should_run_stage({ stage_name: 'advanced', ...stage_config })) {
    log('=== Stage 6: Advanced Stats ===')
    await run_advanced_stats({ year, ignore_cache, collector, skip_sources })
    await wait(DELAYS.BETWEEN_STAGES)
  } else {
    log('=== Stage 6: Advanced Stats (SKIPPED) ===')
  }

  // Stage 7: Validation
  if (should_run_stage({ stage_name: 'validation', ...stage_config })) {
    log('=== Stage 7: Validation ===')
    await run_validation({ year, ignore_cache, collector })
    await wait(DELAYS.BETWEEN_STAGES)
  } else {
    log('=== Stage 7: Validation (SKIPPED) ===')
  }

  // Stage 8: Exports
  if (should_run_stage({ stage_name: 'exports', ...stage_config })) {
    log('=== Stage 8: Exports ===')
    await run_exports({ year, collector })
  } else {
    log('=== Stage 8: Exports (SKIPPED) ===')
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
    .option('start-week', {
      type: 'number',
      describe: 'Start week (overrides season type defaults)'
    })
    .option('end-week', {
      type: 'number',
      describe: 'End week (overrides season type defaults)'
    })
    .option('start-stage', {
      type: 'string',
      describe: 'Start from this stage',
      choices: STAGE_ORDER
    })
    .option('end-stage', {
      type: 'string',
      describe: 'End after this stage',
      choices: STAGE_ORDER
    })
    .option('skip-stages', {
      type: 'string',
      describe: 'Comma-separated stages to skip',
      coerce: (arg) => (arg ? arg.split(',').map((s) => s.trim()) : [])
    })
    .option('skip', {
      type: 'string',
      describe:
        'Comma-separated stage.source pairs to skip (e.g., plays.nflfastr,games.sportradar)'
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
      start_week: argv['start-week'],
      end_week: argv['end-week'],
      start_stage: argv['start-stage'],
      end_stage: argv['end-stage'],
      skip_stages: argv['skip-stages'] || [],
      skip_sources: parse_skip_sources(argv.skip)
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
