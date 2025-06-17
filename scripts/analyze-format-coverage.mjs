#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import db from '#db'
import { is_main } from '#libs-server'
import { named_scoring_formats } from '#libs-shared/named-scoring-formats-generated.mjs'
import { named_league_formats } from '#libs-shared/named-league-formats-generated.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Define all tables that contain format hashes
const FORMAT_TABLES = {
  // Core format definition tables
  scoring_format_definitions: {
    table: 'league_scoring_formats',
    hash_column: 'scoring_format_hash',
    type: 'scoring',
    description: 'Core scoring format definitions',
    time_columns: []
  },

  league_format_definitions: {
    table: 'league_formats',
    hash_column: 'league_format_hash',
    type: 'league',
    description: 'Core league format definitions',
    time_columns: [],
    additional_columns: ['scoring_format_hash']
  },

  // Season configuration
  seasons: {
    table: 'seasons',
    hash_column: 'league_format_hash',
    type: 'league',
    description: 'Season configurations by league and year',
    time_columns: ['year'],
    additional_columns: ['lid', 'scoring_format_hash']
  },

  // League format player data tables
  league_format_player_seasonlogs: {
    table: 'league_format_player_seasonlogs',
    hash_column: 'league_format_hash',
    type: 'league',
    description: 'Player season statistics by league format',
    time_columns: ['year'],
    additional_columns: ['pid']
  },

  league_format_player_careerlogs: {
    table: 'league_format_player_careerlogs',
    hash_column: 'league_format_hash',
    type: 'league',
    description: 'Player career statistics by league format',
    time_columns: [],
    additional_columns: ['pid']
  },

  league_format_player_gamelogs: {
    table: 'league_format_player_gamelogs',
    hash_column: 'league_format_hash',
    type: 'league',
    description: 'Player game-by-game statistics by league format',
    time_columns: [],
    additional_columns: ['pid', 'esbid']
  },

  league_format_player_projection_values: {
    table: 'league_format_player_projection_values',
    hash_column: 'league_format_hash',
    type: 'league',
    description: 'Player projections and market values by league format',
    time_columns: ['week', 'year'],
    additional_columns: ['pid']
  },

  league_format_draft_pick_value: {
    table: 'league_format_draft_pick_value',
    hash_column: 'league_format_hash',
    type: 'league',
    description: 'Draft pick value analysis by league format',
    time_columns: [],
    additional_columns: ['rank']
  },

  // Scoring format player data tables
  scoring_format_player_seasonlogs: {
    table: 'scoring_format_player_seasonlogs',
    hash_column: 'scoring_format_hash',
    type: 'scoring',
    description: 'Player season statistics by scoring format',
    time_columns: ['year'],
    additional_columns: ['pid']
  },

  scoring_format_player_careerlogs: {
    table: 'scoring_format_player_careerlogs',
    hash_column: 'scoring_format_hash',
    type: 'scoring',
    description: 'Player career statistics by scoring format',
    time_columns: [],
    additional_columns: ['pid']
  },

  scoring_format_player_gamelogs: {
    table: 'scoring_format_player_gamelogs',
    hash_column: 'scoring_format_hash',
    type: 'scoring',
    description: 'Player game-by-game points by scoring format',
    time_columns: [],
    additional_columns: ['pid', 'esbid']
  },

  scoring_format_player_projection_points: {
    table: 'scoring_format_player_projection_points',
    hash_column: 'scoring_format_hash',
    type: 'scoring',
    description: 'Player projections by scoring format',
    time_columns: ['week', 'year'],
    additional_columns: ['pid']
  }
}

// Analyze coverage for a specific format hash in a table
const analyze_table_coverage = async (
  table_config,
  format_hash,
  format_name
) => {
  const {
    table,
    hash_column,
    time_columns,
    additional_columns = []
  } = table_config

  try {
    // Check if format exists in table
    const exists_query = `
      SELECT COUNT(*) as count
      FROM ${table}
      WHERE ${hash_column} = ?
    `
    const exists_result = await db.raw(exists_query, [format_hash])
    const record_count = parseInt(exists_result.rows[0].count)

    if (record_count === 0) {
      return {
        format_name,
        format_hash,
        exists: false,
        record_count: 0,
        coverage: {}
      }
    }

    // Analyze time-based coverage if time columns exist
    const coverage = {}

    for (const time_col of time_columns) {
      const time_query = `
        SELECT ${time_col}, COUNT(*) as count
        FROM ${table}
        WHERE ${hash_column} = ?
        GROUP BY ${time_col}
        ORDER BY ${time_col}
      `
      const time_result = await db.raw(time_query, [format_hash])
      coverage[time_col] = time_result.rows.map((row) => ({
        [time_col]: row[time_col],
        count: parseInt(row.count)
      }))
    }

    // Get additional dimensional coverage
    for (const col of additional_columns) {
      if (col === 'pid') {
        // For player data, get unique player count
        const player_query = `
          SELECT COUNT(DISTINCT ${col}) as unique_count
          FROM ${table}
          WHERE ${hash_column} = ?
        `
        const player_result = await db.raw(player_query, [format_hash])
        coverage.unique_players = parseInt(player_result.rows[0].unique_count)
      } else if (col === 'lid') {
        // For league data, get unique league count
        const league_query = `
          SELECT COUNT(DISTINCT ${col}) as unique_count
          FROM ${table}
          WHERE ${hash_column} = ?
        `
        const league_result = await db.raw(league_query, [format_hash])
        coverage.unique_leagues = parseInt(league_result.rows[0].unique_count)
      }
    }

    return {
      format_name,
      format_hash,
      exists: true,
      record_count,
      coverage
    }
  } catch (error) {
    return {
      format_name,
      format_hash,
      exists: false,
      error: error.message,
      record_count: 0,
      coverage: {}
    }
  }
}

// Analyze all named formats against a specific table
const analyze_table_for_all_formats = async (table_name, table_config) => {
  console.log(`\nAnalyzing table: ${table_config.table}`)
  console.log(`Description: ${table_config.description}`)

  const results = []
  const format_source =
    table_config.type === 'scoring'
      ? named_scoring_formats
      : named_league_formats

  for (const [format_name, format_data] of Object.entries(format_source)) {
    const analysis = await analyze_table_coverage(
      table_config,
      format_data.hash,
      format_name
    )
    results.push(analysis)

    if (analysis.exists) {
      console.log(`  ✓ ${format_name}: ${analysis.record_count} records`)

      // Show time coverage
      if (analysis.coverage.year) {
        const years = analysis.coverage.year.map((y) => y.year).sort()
        console.log(`    Years: ${years.join(', ')}`)
      }

      if (analysis.coverage.unique_players) {
        console.log(`    Players: ${analysis.coverage.unique_players}`)
      }

      if (analysis.coverage.unique_leagues) {
        console.log(`    Leagues: ${analysis.coverage.unique_leagues}`)
      }
    } else {
      console.log(
        `  ✗ ${format_name}: No data${analysis.error ? ` (${analysis.error})` : ''}`
      )
    }
  }

  return {
    table_name,
    table_config,
    results
  }
}

// Generate coverage summary report
const generate_coverage_report = (all_results) => {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_tables: Object.keys(FORMAT_TABLES).length,
      scoring_format_coverage: {},
      league_format_coverage: {}
    },
    tables: all_results,
    missing_coverage: {
      scoring_formats: [],
      league_formats: []
    }
  }

  // Calculate format coverage across all tables
  for (const [format_name] of Object.entries(named_scoring_formats)) {
    let tables_with_data = 0
    let total_scoring_tables = 0

    for (const table_result of all_results) {
      if (table_result.table_config.type === 'scoring') {
        total_scoring_tables++
        const format_result = table_result.results.find(
          (r) => r.format_name === format_name
        )
        if (format_result && format_result.exists) {
          tables_with_data++
        }
      }
    }

    report.summary.scoring_format_coverage[format_name] = {
      tables_with_data,
      total_tables: total_scoring_tables,
      coverage_percentage:
        total_scoring_tables > 0
          ? ((tables_with_data / total_scoring_tables) * 100).toFixed(1)
          : 0
    }

    if (tables_with_data === 0) {
      report.missing_coverage.scoring_formats.push(format_name)
    }
  }

  for (const [format_name] of Object.entries(named_league_formats)) {
    let tables_with_data = 0
    let total_league_tables = 0

    for (const table_result of all_results) {
      if (table_result.table_config.type === 'league') {
        total_league_tables++
        const format_result = table_result.results.find(
          (r) => r.format_name === format_name
        )
        if (format_result && format_result.exists) {
          tables_with_data++
        }
      }
    }

    report.summary.league_format_coverage[format_name] = {
      tables_with_data,
      total_tables: total_league_tables,
      coverage_percentage:
        total_league_tables > 0
          ? ((tables_with_data / total_league_tables) * 100).toFixed(1)
          : 0
    }

    if (tables_with_data === 0) {
      report.missing_coverage.league_formats.push(format_name)
    }
  }

  return report
}

// Print summary to console
const print_summary = (report) => {
  console.log('\n' + '='.repeat(80))
  console.log('FORMAT COVERAGE SUMMARY')
  console.log('='.repeat(80))

  console.log('\nSCORING FORMATS:')
  for (const [format_name, coverage] of Object.entries(
    report.summary.scoring_format_coverage
  )) {
    const status = coverage.tables_with_data > 0 ? '✓' : '✗'
    console.log(
      `  ${status} ${format_name}: ${coverage.tables_with_data}/${coverage.total_tables} tables (${coverage.coverage_percentage}%)`
    )
  }

  console.log('\nLEAGUE FORMATS:')
  for (const [format_name, coverage] of Object.entries(
    report.summary.league_format_coverage
  )) {
    const status = coverage.tables_with_data > 0 ? '✓' : '✗'
    console.log(
      `  ${status} ${format_name}: ${coverage.tables_with_data}/${coverage.total_tables} tables (${coverage.coverage_percentage}%)`
    )
  }

  if (report.missing_coverage.scoring_formats.length > 0) {
    console.log('\nSCORING FORMATS WITH NO DATA:')
    report.missing_coverage.scoring_formats.forEach((name) =>
      console.log(`  - ${name}`)
    )
  }

  if (report.missing_coverage.league_formats.length > 0) {
    console.log('\nLEAGUE FORMATS WITH NO DATA:')
    report.missing_coverage.league_formats.forEach((name) =>
      console.log(`  - ${name}`)
    )
  }
}

// Main analysis function
const main = async () => {
  console.log('Starting format coverage analysis...')
  console.log(
    `Analyzing ${Object.keys(named_scoring_formats).length} scoring formats and ${Object.keys(named_league_formats).length} league formats`
  )
  console.log(`Checking ${Object.keys(FORMAT_TABLES).length} database tables`)

  const all_results = []

  // Analyze each table
  for (const [table_name, table_config] of Object.entries(FORMAT_TABLES)) {
    const table_results = await analyze_table_for_all_formats(
      table_name,
      table_config
    )
    all_results.push(table_results)
  }

  // Generate and save detailed report
  const report = generate_coverage_report(all_results)

  const report_path = path.join(
    __dirname,
    '..',
    'docs',
    'format-coverage-analysis.json'
  )
  await fs.writeFile(report_path, JSON.stringify(report, null, 2), 'utf8')
  console.log(
    `\nDetailed report saved to: ${path.relative(process.cwd(), report_path)}`
  )

  // Print summary
  print_summary(report)

  console.log('\nAnalysis complete!')

  await db.destroy()
}

if (is_main(import.meta.url)) {
  main().catch((error) => {
    console.error('Analysis failed:', error)
    process.exit(1)
  })
}

export default main
