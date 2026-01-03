/**
 * Import Reporting Module
 *
 * Centralized issue collection and report generation for season import pipeline.
 * Provides structured tracking of issues across all import stages with
 * unified reporting and persistence capabilities.
 */

import fs from 'fs/promises'
import path from 'path'
import debug from 'debug'

const log = debug('import-reporting')

/**
 * Issue types for categorization
 */
export const ISSUE_TYPES = {
  UNMATCHED_PLAY: 'unmatched_play',
  MULTIPLE_MATCH: 'multiple_match',
  COLLISION: 'collision',
  PLAYER_ISSUE: 'player_issue',
  WARNING: 'warning',
  ERROR: 'error'
}

/**
 * ImportCollector - Centralized collector for tracking issues across all import stages
 */
export class ImportCollector {
  constructor(year) {
    this.year = year
    this.start_time = new Date()
    this.end_time = null

    // Stage tracking
    this.stages = []
    this.current_stage = null

    // Issue collections
    this.unmatched_plays = []
    this.multiple_matches = []
    this.collisions = []
    this.player_issues = []
    this.warnings = []
    this.errors = []

    // Aggregate stats
    this.total_plays_processed = 0
    this.total_plays_matched = 0
    this.total_plays_updated = 0
    this.total_games_processed = 0
    this.total_games_updated = 0
  }

  /**
   * Begin tracking a new stage with metadata
   */
  start_stage(name, context = {}) {
    if (this.current_stage) {
      this.end_stage()
    }

    this.current_stage = {
      name,
      context,
      start_time: new Date(),
      end_time: null,
      stats: {},
      issues: {
        unmatched_plays: 0,
        multiple_matches: 0,
        collisions: 0,
        player_issues: 0,
        warnings: 0,
        errors: 0
      }
    }

    log(`Starting stage: ${name}`)
  }

  /**
   * Complete current stage with final statistics
   */
  end_stage(stats = {}) {
    if (!this.current_stage) {
      return
    }

    this.current_stage.end_time = new Date()
    this.current_stage.stats = { ...this.current_stage.stats, ...stats }
    this.current_stage.duration_ms =
      this.current_stage.end_time - this.current_stage.start_time

    log(
      `Completed stage: ${this.current_stage.name} (${this.current_stage.duration_ms}ms)`
    )

    this.stages.push(this.current_stage)
    this.current_stage = null
  }

  /**
   * Set stats for the current stage
   */
  set_stats(stats) {
    if (this.current_stage) {
      this.current_stage.stats = { ...this.current_stage.stats, ...stats }
    }

    // Update aggregate stats
    if (stats.plays_processed) {
      this.total_plays_processed += stats.plays_processed
    }
    if (stats.plays_matched) {
      this.total_plays_matched += stats.plays_matched
    }
    if (stats.plays_updated) {
      this.total_plays_updated += stats.plays_updated
    }
    if (stats.games_processed) {
      this.total_games_processed += stats.games_processed
    }
    if (stats.games_updated) {
      this.total_games_updated += stats.games_updated
    }
  }

  /**
   * Add an unmatched play issue
   */
  add_unmatched_play({ esbid, playId, description, criteria, source }) {
    const issue = {
      type: ISSUE_TYPES.UNMATCHED_PLAY,
      esbid,
      playId,
      description,
      criteria,
      source,
      stage: this.current_stage?.name,
      timestamp: new Date()
    }

    this.unmatched_plays.push(issue)
    if (this.current_stage) {
      this.current_stage.issues.unmatched_plays++
    }
  }

  /**
   * Add a multiple match issue
   */
  add_multiple_match({ esbid, playId, match_count, criteria, source }) {
    const issue = {
      type: ISSUE_TYPES.MULTIPLE_MATCH,
      esbid,
      playId,
      match_count,
      criteria,
      source,
      stage: this.current_stage?.name,
      timestamp: new Date()
    }

    this.multiple_matches.push(issue)
    if (this.current_stage) {
      this.current_stage.issues.multiple_matches++
    }
  }

  /**
   * Add a collision (field conflict) issue
   */
  add_collision({ field, existing, new_value, play_info, source }) {
    const issue = {
      type: ISSUE_TYPES.COLLISION,
      field,
      existing,
      new_value,
      play_info,
      source,
      stage: this.current_stage?.name,
      timestamp: new Date()
    }

    this.collisions.push(issue)
    if (this.current_stage) {
      this.current_stage.issues.collisions++
    }
  }

  /**
   * Add a player-related issue
   */
  add_player_issue({ type, player_name, team, identifier, source, details }) {
    const issue = {
      type: ISSUE_TYPES.PLAYER_ISSUE,
      player_issue_type: type,
      player_name,
      team,
      identifier,
      source,
      details,
      stage: this.current_stage?.name,
      timestamp: new Date()
    }

    this.player_issues.push(issue)
    if (this.current_stage) {
      this.current_stage.issues.player_issues++
    }
  }

  /**
   * Add a warning message
   */
  add_warning(message, context = {}) {
    const issue = {
      type: ISSUE_TYPES.WARNING,
      message,
      context,
      stage: this.current_stage?.name,
      timestamp: new Date()
    }

    this.warnings.push(issue)
    if (this.current_stage) {
      this.current_stage.issues.warnings++
    }
  }

  /**
   * Add an error
   */
  add_error(error, context = {}) {
    const issue = {
      type: ISSUE_TYPES.ERROR,
      message: error.message || String(error),
      stack: error.stack,
      context,
      stage: this.current_stage?.name,
      timestamp: new Date()
    }

    this.errors.push(issue)
    if (this.current_stage) {
      this.current_stage.issues.errors++
    }
  }

  /**
   * Return complete report object
   */
  get_summary() {
    // Ensure any open stage is closed
    if (this.current_stage) {
      this.end_stage()
    }

    this.end_time = new Date()

    return {
      year: this.year,
      start_time: this.start_time.toISOString(),
      end_time: this.end_time.toISOString(),
      duration_ms: this.end_time - this.start_time,

      // Aggregate statistics
      totals: {
        plays_processed: this.total_plays_processed,
        plays_matched: this.total_plays_matched,
        plays_updated: this.total_plays_updated,
        games_processed: this.total_games_processed,
        games_updated: this.total_games_updated
      },

      // Issue counts
      issue_counts: {
        unmatched_plays: this.unmatched_plays.length,
        multiple_matches: this.multiple_matches.length,
        collisions: this.collisions.length,
        player_issues: this.player_issues.length,
        warnings: this.warnings.length,
        errors: this.errors.length,
        total:
          this.unmatched_plays.length +
          this.multiple_matches.length +
          this.collisions.length +
          this.player_issues.length +
          this.warnings.length +
          this.errors.length
      },

      // Stage summaries
      stages: this.stages.map((stage) => ({
        name: stage.name,
        context: stage.context,
        duration_ms: stage.duration_ms,
        stats: stage.stats,
        issues: stage.issues
      })),

      // Detailed issues
      issues: {
        unmatched_plays: this.unmatched_plays,
        multiple_matches: this.multiple_matches,
        collisions: this._summarize_collisions(),
        player_issues: this.player_issues,
        warnings: this.warnings,
        errors: this.errors
      }
    }
  }

  /**
   * Summarize collisions by field with counts and examples
   */
  _summarize_collisions() {
    const by_field = {}

    for (const collision of this.collisions) {
      if (!by_field[collision.field]) {
        by_field[collision.field] = {
          field: collision.field,
          count: 0,
          examples: []
        }
      }

      by_field[collision.field].count++

      // Keep up to 5 examples per field
      if (by_field[collision.field].examples.length < 5) {
        by_field[collision.field].examples.push(collision)
      }
    }

    return {
      total: this.collisions.length,
      by_field: Object.values(by_field).sort((a, b) => b.count - a.count)
    }
  }
}

/**
 * Print unified report to console
 */
export const print_unified_report = (collector) => {
  const summary = collector.get_summary()

  console.log('\n' + '='.repeat(80))
  console.log('SEASON IMPORT REPORT')
  console.log('='.repeat(80))

  console.log(`\nYear: ${summary.year}`)
  console.log(`Start: ${summary.start_time}`)
  console.log(`End: ${summary.end_time}`)
  console.log(`Duration: ${format_duration(summary.duration_ms)}`)

  // Totals
  console.log('\n--- Aggregate Statistics ---')
  console.log(`Games Processed: ${summary.totals.games_processed}`)
  console.log(`Games Updated: ${summary.totals.games_updated}`)
  console.log(`Plays Processed: ${summary.totals.plays_processed}`)
  console.log(`Plays Matched: ${summary.totals.plays_matched}`)
  console.log(`Plays Updated: ${summary.totals.plays_updated}`)

  // Issue summary
  console.log('\n--- Issue Summary ---')
  console.log(`Unmatched Plays: ${summary.issue_counts.unmatched_plays}`)
  console.log(`Multiple Matches: ${summary.issue_counts.multiple_matches}`)
  console.log(`Collisions: ${summary.issue_counts.collisions}`)
  console.log(`Player Issues: ${summary.issue_counts.player_issues}`)
  console.log(`Warnings: ${summary.issue_counts.warnings}`)
  console.log(`Errors: ${summary.issue_counts.errors}`)
  console.log(`Total Issues: ${summary.issue_counts.total}`)

  // Stage breakdown
  if (summary.stages.length > 0) {
    console.log('\n--- Stage Breakdown ---')
    for (const stage of summary.stages) {
      console.log(`\n${stage.name}:`)
      console.log(`  Duration: ${format_duration(stage.duration_ms)}`)
      if (Object.keys(stage.stats).length > 0) {
        console.log(`  Stats: ${JSON.stringify(stage.stats)}`)
      }
      const stage_issues =
        stage.issues.unmatched_plays +
        stage.issues.multiple_matches +
        stage.issues.collisions +
        stage.issues.player_issues +
        stage.issues.warnings +
        stage.issues.errors
      if (stage_issues > 0) {
        console.log(`  Issues: ${stage_issues}`)
      }
    }
  }

  // Collision details
  if (summary.issues.collisions.total > 0) {
    console.log('\n--- Collision Details ---')
    console.log(`Total collisions: ${summary.issues.collisions.total}`)
    console.log('\nBy field:')
    for (const field_summary of summary.issues.collisions.by_field.slice(
      0,
      10
    )) {
      console.log(`  ${field_summary.field}: ${field_summary.count}`)
    }
    if (summary.issues.collisions.by_field.length > 10) {
      console.log(
        `  ... and ${summary.issues.collisions.by_field.length - 10} more fields`
      )
    }
  }

  // Errors
  if (summary.issues.errors.length > 0) {
    console.log('\n--- Errors ---')
    for (const error of summary.issues.errors.slice(0, 10)) {
      console.log(`\n[${error.stage || 'unknown'}] ${error.message}`)
      if (error.context && Object.keys(error.context).length > 0) {
        console.log(`  Context: ${JSON.stringify(error.context)}`)
      }
    }
    if (summary.issues.errors.length > 10) {
      console.log(`\n... and ${summary.issues.errors.length - 10} more errors`)
    }
  }

  // Warnings
  if (summary.issues.warnings.length > 0) {
    console.log('\n--- Warnings (first 20) ---')
    for (const warning of summary.issues.warnings.slice(0, 20)) {
      console.log(`[${warning.stage || 'unknown'}] ${warning.message}`)
    }
    if (summary.issues.warnings.length > 20) {
      console.log(
        `... and ${summary.issues.warnings.length - 20} more warnings`
      )
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('END OF REPORT')
  console.log('='.repeat(80) + '\n')
}

/**
 * Save report to JSON file
 */
export const save_report_to_file = async (collector, output_dir = null) => {
  const summary = collector.get_summary()

  // Default to data/season-import-reports directory
  if (!output_dir) {
    output_dir = path.join(process.cwd(), 'data', 'season-import-reports')
  }

  // Ensure directory exists
  await fs.mkdir(output_dir, { recursive: true })

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${summary.year}-${timestamp}.json`
  const filepath = path.join(output_dir, filename)

  // Write report
  await fs.writeFile(filepath, JSON.stringify(summary, null, 2))

  log(`Report saved to: ${filepath}`)

  return filepath
}

/**
 * Format duration in human-readable format
 */
const format_duration = (ms) => {
  if (ms < 1000) {
    return `${ms}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}

/**
 * Factory function to create a new ImportCollector
 */
export const create_import_collector = (year) => {
  return new ImportCollector(year)
}

export default {
  ImportCollector,
  ISSUE_TYPES,
  create_import_collector,
  print_unified_report,
  save_report_to_file
}
