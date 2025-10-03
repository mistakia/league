#!/usr/bin/env node

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'
import path from 'path'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main } from '#libs-server'

const log = debug('export-weekly-market-review')
debug.enable('export-weekly-market-review')

/**
 * Format query results to markdown table
 */
const format_results_to_markdown_table = ({ results, columns, title, query_info }) => {
  const lines = []

  lines.push(`# ${title}`)
  lines.push('')

  if (query_info) {
    lines.push(`**Query Info**: ${query_info}`)
    lines.push('')
  }

  if (!results || results.length === 0) {
    lines.push('No results found.')
    return lines.join('\n')
  }

  lines.push(`**Total Results**: ${results.length}`)
  lines.push('')

  // Filter columns to only include those with data
  const active_columns = columns.filter(col => {
    // Always include non-week columns
    if (!col.key.startsWith('week_')) {
      return true
    }
    // For week columns, check if any row has data
    return results.some(row => row[col.key] && row[col.key] !== '0' && row[col.key] !== 0)
  })

  // Build header
  const header_cells = active_columns.map(c => c.label)
  lines.push(`| ${header_cells.join(' | ')} |`)

  // Build separator
  const separator_cells = active_columns.map(() => '---')
  lines.push(`| ${separator_cells.join(' | ')} |`)

  // Build rows
  results.forEach(row => {
    const cells = active_columns.map(col => {
      const value = row[col.key]

      if (value === null || value === undefined) {
        return col.empty || '-'
      }

      if (col.format) {
        return col.format(value)
      }

      return String(value)
    })
    lines.push(`| ${cells.join(' | ')} |`)
  })

  return lines.join('\n')
}

/**
 * Detect the most recent week with longshot betting results
 */
const detect_latest_week_with_longshots = async ({ year }) => {
  log('Detecting latest week with longshot results...')

  const result = await db('prop_market_selections_index as pmsi')
    .join('prop_markets_index as pmi', function() {
      this.on('pmsi.source_id', '=', 'pmi.source_id')
        .on('pmsi.source_market_id', '=', 'pmi.source_market_id')
    })
    .join('nfl_games as ng', 'pmi.esbid', 'ng.esbid')
    .where('pmsi.time_type', 'CLOSE')
    .where('ng.year', year)
    .where('ng.seas_type', 'REG')
    .where('pmsi.odds_american', '>', 200)
    .where('pmsi.selection_result', 'WON')
    .select('ng.week')
    .groupBy('ng.week')
    .orderBy('ng.week', 'desc')
    .limit(1)

  if (result.length === 0) {
    throw new Error(`No longshot results found for year ${year}`)
  }

  const week = result[0].week
  log(`Latest week with longshots: ${week}`)
  return week
}

/**
 * Query 1: Player winning selections aggregated by week
 */
const query_player_winning_selections = async ({ year }) => {
  log('Executing player winning selections query...')

  const sql = `
    WITH winning_selections AS (
      SELECT
        pmsi.selection_pid as player_id,
        p.pname as player_name,
        p.pos as position,
        ng.week,
        pmi.market_type,
        pmi.source_market_name,
        pmsi.selection_name,
        pmsi.selection_metric_line,
        pmsi.odds_decimal,
        pmsi.odds_american,
        ROW_NUMBER() OVER (
          PARTITION BY pmsi.selection_pid, pmi.market_type, pmi.source_market_name
          ORDER BY pmsi.odds_american DESC
        ) as rn
      FROM prop_market_selections_index pmsi
      JOIN prop_markets_index pmi ON (
        pmsi.source_id = pmi.source_id
        AND pmsi.source_market_id = pmi.source_market_id
      )
      JOIN nfl_games ng ON pmi.esbid = ng.esbid
      LEFT JOIN player p ON pmsi.selection_pid = p.pid
      WHERE
        pmsi.time_type = 'CLOSE'
        AND ng.year = ?
        AND pmsi.odds_american > 200
        AND pmsi.selection_result = 'WON'
        AND ng.seas_type = 'REG'
        AND pmsi.selection_pid IS NOT NULL
        AND pmsi.selection_pid != ''
    ),
    filtered_selections AS (
      SELECT * FROM winning_selections WHERE rn = 1
    )
    SELECT
      player_id,
      player_name,
      position,
      COUNT(*) FILTER (WHERE week = 1) as week_1,
      COUNT(*) FILTER (WHERE week = 2) as week_2,
      COUNT(*) FILTER (WHERE week = 3) as week_3,
      COUNT(*) FILTER (WHERE week = 4) as week_4,
      COUNT(*) FILTER (WHERE week = 5) as week_5,
      COUNT(*) FILTER (WHERE week = 6) as week_6,
      COUNT(*) FILTER (WHERE week = 7) as week_7,
      COUNT(*) FILTER (WHERE week = 8) as week_8,
      COUNT(*) FILTER (WHERE week = 9) as week_9,
      COUNT(*) FILTER (WHERE week = 10) as week_10,
      COUNT(*) FILTER (WHERE week = 11) as week_11,
      COUNT(*) FILTER (WHERE week = 12) as week_12,
      COUNT(*) FILTER (WHERE week = 13) as week_13,
      COUNT(*) FILTER (WHERE week = 14) as week_14,
      COUNT(*) FILTER (WHERE week = 15) as week_15,
      COUNT(*) FILTER (WHERE week = 16) as week_16,
      COUNT(*) FILTER (WHERE week = 17) as week_17,
      COUNT(*) FILTER (WHERE week = 18) as week_18,
      COUNT(*) as total_season
    FROM filtered_selections
    GROUP BY player_id, player_name, position
    HAVING COUNT(*) >= 3
    ORDER BY total_season DESC, player_name ASC
  `

  const results = await db.raw(sql, [year])
  log(`  Found ${results.rows.length} players with 3+ longshot wins`)
  return results.rows
}

/**
 * Query 2: Team winning selections aggregated by week
 */
const query_team_winning_selections = async ({ year }) => {
  log('Executing team winning selections query...')

  const sql = `
    WITH winning_selections AS (
      SELECT
        pgl.tm as team,
        ng.week,
        pmsi.selection_pid as player_id,
        p.pname as player_name,
        p.pos as position,
        pmi.market_type,
        pmi.source_market_name,
        pmsi.selection_name,
        pmsi.selection_metric_line,
        pmsi.odds_decimal,
        pmsi.odds_american,
        ROW_NUMBER() OVER (
          PARTITION BY pmsi.selection_pid, pmi.market_type, pmi.source_market_name
          ORDER BY pmsi.odds_american DESC
        ) as rn
      FROM prop_market_selections_index pmsi
      JOIN prop_markets_index pmi ON (
        pmsi.source_id = pmi.source_id
        AND pmsi.source_market_id = pmi.source_market_id
      )
      JOIN nfl_games ng ON pmi.esbid = ng.esbid
      JOIN player_gamelogs pgl ON (
        pmsi.selection_pid = pgl.pid
        AND pmi.esbid = pgl.esbid
      )
      LEFT JOIN player p ON pmsi.selection_pid = p.pid
      WHERE
        pmsi.time_type = 'CLOSE'
        AND ng.year = ?
        AND pmsi.odds_american > 200
        AND pmsi.selection_result = 'WON'
        AND ng.seas_type = 'REG'
        AND pmsi.selection_pid IS NOT NULL
        AND pmsi.selection_pid != ''
    ),
    filtered_selections AS (
      SELECT * FROM winning_selections WHERE rn = 1
    ),
    team_summary AS (
      SELECT
        team,
        COUNT(*) FILTER (WHERE week = 1) as week_1,
        COUNT(*) FILTER (WHERE week = 2) as week_2,
        COUNT(*) FILTER (WHERE week = 3) as week_3,
        COUNT(*) FILTER (WHERE week = 4) as week_4,
        COUNT(*) FILTER (WHERE week = 5) as week_5,
        COUNT(*) FILTER (WHERE week = 6) as week_6,
        COUNT(*) FILTER (WHERE week = 7) as week_7,
        COUNT(*) FILTER (WHERE week = 8) as week_8,
        COUNT(*) FILTER (WHERE week = 9) as week_9,
        COUNT(*) FILTER (WHERE week = 10) as week_10,
        COUNT(*) FILTER (WHERE week = 11) as week_11,
        COUNT(*) FILTER (WHERE week = 12) as week_12,
        COUNT(*) FILTER (WHERE week = 13) as week_13,
        COUNT(*) FILTER (WHERE week = 14) as week_14,
        COUNT(*) FILTER (WHERE week = 15) as week_15,
        COUNT(*) FILTER (WHERE week = 16) as week_16,
        COUNT(*) FILTER (WHERE week = 17) as week_17,
        COUNT(*) FILTER (WHERE week = 18) as week_18,
        COUNT(*) as total_season
      FROM filtered_selections
      GROUP BY team
    ),
    team_players AS (
      SELECT
        team,
        STRING_AGG(DISTINCT COALESCE(player_name, player_id) || ' (' || COALESCE(position, 'UNK') || ')', ', ') as top_players
      FROM filtered_selections
      WHERE player_id IN (
        SELECT player_id
        FROM filtered_selections
        GROUP BY player_id
        HAVING COUNT(*) >= 3
      )
      GROUP BY team
    )
    SELECT
      ts.*,
      tp.top_players
    FROM team_summary ts
    LEFT JOIN team_players tp ON ts.team = tp.team
    ORDER BY ts.total_season DESC, ts.team ASC
  `

  const results = await db.raw(sql, [year])
  log(`  Found ${results.rows.length} teams with longshot production`)
  return results.rows
}

/**
 * Query 3: Opponent winning selections aggregated by week
 */
const query_opponent_winning_selections = async ({ year }) => {
  log('Executing opponent winning selections query...')

  const sql = `
    WITH winning_selections AS (
      SELECT
        pgl.opp as opponent,
        ng.week,
        pmsi.selection_pid as player_id,
        p.pname as player_name,
        p.pos as position,
        pmi.market_type,
        pmi.source_market_name,
        pmsi.selection_name,
        pmsi.selection_metric_line,
        pmsi.odds_decimal,
        pmsi.odds_american,
        ROW_NUMBER() OVER (
          PARTITION BY pmsi.selection_pid, pmi.market_type, pmi.source_market_name
          ORDER BY pmsi.odds_american DESC
        ) as rn
      FROM prop_market_selections_index pmsi
      JOIN prop_markets_index pmi ON (
        pmsi.source_id = pmi.source_id
        AND pmsi.source_market_id = pmi.source_market_id
      )
      JOIN nfl_games ng ON pmi.esbid = ng.esbid
      JOIN player_gamelogs pgl ON (
        pmsi.selection_pid = pgl.pid
        AND pmi.esbid = pgl.esbid
      )
      LEFT JOIN player p ON pmsi.selection_pid = p.pid
      WHERE
        pmsi.time_type = 'CLOSE'
        AND ng.year = ?
        AND pmsi.odds_american > 200
        AND pmsi.selection_result = 'WON'
        AND ng.seas_type = 'REG'
        AND pmsi.selection_pid IS NOT NULL
        AND pmsi.selection_pid != ''
    ),
    filtered_selections AS (
      SELECT * FROM winning_selections WHERE rn = 1
    ),
    opponent_summary AS (
      SELECT
        opponent,
        COUNT(*) FILTER (WHERE week = 1) as week_1,
        COUNT(*) FILTER (WHERE week = 2) as week_2,
        COUNT(*) FILTER (WHERE week = 3) as week_3,
        COUNT(*) FILTER (WHERE week = 4) as week_4,
        COUNT(*) FILTER (WHERE week = 5) as week_5,
        COUNT(*) FILTER (WHERE week = 6) as week_6,
        COUNT(*) FILTER (WHERE week = 7) as week_7,
        COUNT(*) FILTER (WHERE week = 8) as week_8,
        COUNT(*) FILTER (WHERE week = 9) as week_9,
        COUNT(*) FILTER (WHERE week = 10) as week_10,
        COUNT(*) FILTER (WHERE week = 11) as week_11,
        COUNT(*) FILTER (WHERE week = 12) as week_12,
        COUNT(*) FILTER (WHERE week = 13) as week_13,
        COUNT(*) FILTER (WHERE week = 14) as week_14,
        COUNT(*) FILTER (WHERE week = 15) as week_15,
        COUNT(*) FILTER (WHERE week = 16) as week_16,
        COUNT(*) FILTER (WHERE week = 17) as week_17,
        COUNT(*) FILTER (WHERE week = 18) as week_18,
        COUNT(*) as total_season
      FROM filtered_selections
      GROUP BY opponent
    ),
    opponent_players AS (
      SELECT
        opponent,
        STRING_AGG(DISTINCT COALESCE(player_name, player_id) || ' (' || COALESCE(position, 'UNK') || ')', ', ') as top_players
      FROM filtered_selections
      WHERE player_id IN (
        SELECT player_id
        FROM filtered_selections
        GROUP BY player_id
        HAVING COUNT(*) >= 3
      )
      GROUP BY opponent
    )
    SELECT
      os.*,
      op.top_players
    FROM opponent_summary os
    LEFT JOIN opponent_players op ON os.opponent = op.opponent
    ORDER BY os.total_season DESC, os.opponent ASC
  `

  const results = await db.raw(sql, [year])
  log(`  Found ${results.rows.length} opponents triggering longshots`)
  return results.rows
}

/**
 * Query 4: All longshot selections from latest week (200+ odds)
 */
const query_all_longshots_latest_week = async ({ year, week }) => {
  log(`Executing all longshots query for week ${week}...`)

  const sql = `
    WITH winning_selections AS (
      SELECT
        pmsi.selection_pid as player_id,
        COALESCE(p.pname, 'Unknown Player') as player_name,
        COALESCE(p.pos, 'UNK') as position,
        ng.week,
        pmi.market_type,
        pmsi.selection_name,
        pmsi.selection_metric_line,
        pmsi.odds_american,
        ROW_NUMBER() OVER (
          PARTITION BY pmsi.selection_pid, pmi.market_type, pmi.source_market_name
          ORDER BY pmsi.odds_american DESC
        ) as rn
      FROM prop_market_selections_index pmsi
      JOIN prop_markets_index pmi ON (
        pmsi.source_id = pmi.source_id
        AND pmsi.source_market_id = pmi.source_market_id
      )
      JOIN nfl_games ng ON pmi.esbid = ng.esbid
      LEFT JOIN player p ON pmsi.selection_pid = p.pid
      WHERE
        pmsi.time_type = 'CLOSE'
        AND ng.year = ?
        AND ng.week = ?
        AND pmsi.odds_american > 200
        AND pmsi.selection_result = 'WON'
        AND ng.seas_type = 'REG'
        AND pmsi.selection_pid IS NOT NULL
        AND pmsi.selection_pid != ''
    )
    SELECT
      player_id,
      player_name,
      position,
      week,
      market_type,
      selection_name,
      selection_metric_line,
      odds_american
    FROM winning_selections
    WHERE rn = 1
    ORDER BY odds_american ASC, player_name ASC, market_type ASC
  `

  const results = await db.raw(sql, [year, week])
  log(`  Found ${results.rows.length} longshot selections in week ${week}`)
  return results.rows
}

/**
 * Query 5: Extreme longshots from latest week (1000+ odds)
 */
const query_extreme_longshots_latest_week = async ({ year, week }) => {
  log(`Executing extreme longshots query for week ${week}...`)

  const sql = `
    WITH winning_selections AS (
      SELECT
        pmsi.selection_pid as player_id,
        COALESCE(p.pname, 'Unknown Player') as player_name,
        COALESCE(p.pos, 'UNK') as position,
        ng.week,
        pmi.market_type,
        pmsi.selection_name,
        pmsi.selection_metric_line,
        pmsi.odds_american,
        ROW_NUMBER() OVER (
          PARTITION BY pmsi.selection_pid, pmi.market_type, pmi.source_market_name
          ORDER BY pmsi.odds_american DESC
        ) as rn
      FROM prop_market_selections_index pmsi
      JOIN prop_markets_index pmi ON (
        pmsi.source_id = pmi.source_id
        AND pmsi.source_market_id = pmi.source_market_id
      )
      JOIN nfl_games ng ON pmi.esbid = ng.esbid
      LEFT JOIN player p ON pmsi.selection_pid = p.pid
      WHERE
        pmsi.time_type = 'CLOSE'
        AND ng.year = ?
        AND ng.week = ?
        AND pmsi.odds_american >= 1000
        AND pmsi.selection_result = 'WON'
        AND ng.seas_type = 'REG'
        AND pmsi.selection_pid IS NOT NULL
        AND pmsi.selection_pid != ''
    )
    SELECT
      player_id,
      player_name,
      position,
      week,
      market_type,
      selection_name,
      selection_metric_line,
      odds_american
    FROM winning_selections
    WHERE rn = 1
    ORDER BY odds_american DESC, player_name ASC
  `

  const results = await db.raw(sql, [year, week])
  log(`  Found ${results.rows.length} extreme longshot selections in week ${week}`)
  return results.rows
}

/**
 * Query 6: Player context for identified players
 */
const query_player_context = async ({ year, player_ids }) => {
  if (!player_ids || player_ids.length === 0) {
    log('No player IDs provided for context query')
    return []
  }

  log(`Executing player context query for ${player_ids.length} players...`)

  const sql = `
    SELECT
      p.pid,
      p.pname,
      p.pos,
      p.nfl_draft_year,
      p.height,
      p.weight,
      p.col as college,
      p.current_nfl_team,
      CASE
        WHEN p.nfl_draft_year = ? THEN 'Rookie'
        WHEN p.nfl_draft_year = ? THEN '2nd Year'
        WHEN p.nfl_draft_year >= ? THEN 'Young Player'
        ELSE 'Veteran'
      END as player_category,
      (? - p.nfl_draft_year + 1) as nfl_seasons
    FROM player p
    WHERE p.pid = ANY(?)
    ORDER BY p.nfl_draft_year DESC, p.pname ASC
  `

  const results = await db.raw(sql, [year, year - 1, year - 4, year, player_ids])
  log(`  Found context for ${results.rows.length} players`)
  return results.rows
}

/**
 * Save metadata file
 */
const save_metadata = async ({ output_dir, year, week, query_results, execution_time_ms }) => {
  const metadata = {
    year,
    week,
    executed_at: new Date().toISOString(),
    execution_time_ms,
    queries: query_results
  }

  await fs.writeFile(
    path.join(output_dir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  )

  log('Saved metadata.json')
}

/**
 * Main script execution
 */
const main = async () => {
  const argv = await yargs(hideBin(process.argv))
    .option('outputDir', {
      alias: 'output-dir',
      type: 'string',
      describe: 'Output directory for markdown files',
      demandOption: true
    })
    .option('year', {
      type: 'number',
      describe: 'Season year',
      default: constants.season.year
    })
    .option('week', {
      type: 'number',
      describe: 'Week number (auto-detects latest if not provided)'
    })
    .help()
    .parse()

  const start_time = Date.now()

  try {
    log('Starting weekly market review export...')
    log(`  Year: ${argv.year}`)
    log(`  Base directory: ${argv.outputDir}`)

    // Detect or use provided week
    const week = argv.week || await detect_latest_week_with_longshots({ year: argv.year })
    log(`  Week: ${week}`)

    // Create output directory with YYYY/week-N structure
    const base_dir = path.isAbsolute(argv.outputDir)
      ? argv.outputDir
      : path.join(process.cwd(), argv.outputDir)
    const output_dir = path.join(base_dir, String(argv.year), `week-${week}`)
    await fs.ensureDir(output_dir)
    log(`Created output directory: ${output_dir}`)

    const query_results = []

    // Query 1: Player winning selections
    const player_results = await query_player_winning_selections({ year: argv.year })
    const player_markdown = format_results_to_markdown_table({
      results: player_results,
      title: 'Players by Longshot Wins (200+ Odds)',
      query_info: `Players with 3+ longshot wins across ${argv.year} regular season`,
      columns: [
        { key: 'player_name', label: 'Player' },
        { key: 'position', label: 'Pos' },
        { key: 'week_1', label: 'W1', empty: '0' },
        { key: 'week_2', label: 'W2', empty: '0' },
        { key: 'week_3', label: 'W3', empty: '0' },
        { key: 'week_4', label: 'W4', empty: '0' },
        { key: 'week_5', label: 'W5', empty: '0' },
        { key: 'week_6', label: 'W6', empty: '0' },
        { key: 'week_7', label: 'W7', empty: '0' },
        { key: 'week_8', label: 'W8', empty: '0' },
        { key: 'week_9', label: 'W9', empty: '0' },
        { key: 'week_10', label: 'W10', empty: '0' },
        { key: 'week_11', label: 'W11', empty: '0' },
        { key: 'week_12', label: 'W12', empty: '0' },
        { key: 'week_13', label: 'W13', empty: '0' },
        { key: 'week_14', label: 'W14', empty: '0' },
        { key: 'week_15', label: 'W15', empty: '0' },
        { key: 'week_16', label: 'W16', empty: '0' },
        { key: 'week_17', label: 'W17', empty: '0' },
        { key: 'week_18', label: 'W18', empty: '0' },
        { key: 'total_season', label: 'Total' }
      ]
    })
    await fs.writeFile(path.join(output_dir, 'player-winning-selections.md'), player_markdown)
    query_results.push({ query: 'player-winning-selections', row_count: player_results.length })

    // Query 2: Team winning selections
    const team_results = await query_team_winning_selections({ year: argv.year })
    const team_markdown = format_results_to_markdown_table({
      results: team_results,
      title: 'Team Longshot Production',
      query_info: `Teams generating the most longshot wins in ${argv.year} regular season`,
      columns: [
        { key: 'team', label: 'Team' },
        { key: 'week_1', label: 'W1', empty: '0' },
        { key: 'week_2', label: 'W2', empty: '0' },
        { key: 'week_3', label: 'W3', empty: '0' },
        { key: 'week_4', label: 'W4', empty: '0' },
        { key: 'week_5', label: 'W5', empty: '0' },
        { key: 'week_6', label: 'W6', empty: '0' },
        { key: 'week_7', label: 'W7', empty: '0' },
        { key: 'week_8', label: 'W8', empty: '0' },
        { key: 'week_9', label: 'W9', empty: '0' },
        { key: 'week_10', label: 'W10', empty: '0' },
        { key: 'week_11', label: 'W11', empty: '0' },
        { key: 'week_12', label: 'W12', empty: '0' },
        { key: 'week_13', label: 'W13', empty: '0' },
        { key: 'week_14', label: 'W14', empty: '0' },
        { key: 'week_15', label: 'W15', empty: '0' },
        { key: 'week_16', label: 'W16', empty: '0' },
        { key: 'week_17', label: 'W17', empty: '0' },
        { key: 'week_18', label: 'W18', empty: '0' },
        { key: 'total_season', label: 'Total' },
        { key: 'top_players', label: 'Top Contributors' }
      ]
    })
    await fs.writeFile(path.join(output_dir, 'team-winning-selections.md'), team_markdown)
    query_results.push({ query: 'team-winning-selections', row_count: team_results.length })

    // Query 3: Opponent winning selections
    const opponent_results = await query_opponent_winning_selections({ year: argv.year })
    const opponent_markdown = format_results_to_markdown_table({
      results: opponent_results,
      title: 'Opponent-Triggered Longshots',
      query_info: `Opponents that allow the most longshot wins in ${argv.year} regular season`,
      columns: [
        { key: 'opponent', label: 'Opponent' },
        { key: 'week_1', label: 'W1', empty: '0' },
        { key: 'week_2', label: 'W2', empty: '0' },
        { key: 'week_3', label: 'W3', empty: '0' },
        { key: 'week_4', label: 'W4', empty: '0' },
        { key: 'week_5', label: 'W5', empty: '0' },
        { key: 'week_6', label: 'W6', empty: '0' },
        { key: 'week_7', label: 'W7', empty: '0' },
        { key: 'week_8', label: 'W8', empty: '0' },
        { key: 'week_9', label: 'W9', empty: '0' },
        { key: 'week_10', label: 'W10', empty: '0' },
        { key: 'week_11', label: 'W11', empty: '0' },
        { key: 'week_12', label: 'W12', empty: '0' },
        { key: 'week_13', label: 'W13', empty: '0' },
        { key: 'week_14', label: 'W14', empty: '0' },
        { key: 'week_15', label: 'W15', empty: '0' },
        { key: 'week_16', label: 'W16', empty: '0' },
        { key: 'week_17', label: 'W17', empty: '0' },
        { key: 'week_18', label: 'W18', empty: '0' },
        { key: 'total_season', label: 'Total' },
        { key: 'top_players', label: 'Top Players' }
      ]
    })
    await fs.writeFile(path.join(output_dir, 'opponent-winning-selections.md'), opponent_markdown)
    query_results.push({ query: 'opponent-winning-selections', row_count: opponent_results.length })

    // Query 4: All longshots from latest week
    const all_longshots_results = await query_all_longshots_latest_week({ year: argv.year, week })
    const all_longshots_markdown = format_results_to_markdown_table({
      results: all_longshots_results,
      title: `All Longshot Selections (200+ Odds) - Week ${week}`,
      query_info: `Complete list of all longshot wins from week ${week}`,
      columns: [
        { key: 'player_name', label: 'Player' },
        { key: 'position', label: 'Pos' },
        { key: 'market_type', label: 'Market Type' },
        { key: 'selection_name', label: 'Selection' },
        { key: 'selection_metric_line', label: 'Line' },
        { key: 'odds_american', label: 'Odds', format: (v) => `+${v}` }
      ]
    })
    await fs.writeFile(path.join(output_dir, 'all-longshots.md'), all_longshots_markdown)
    query_results.push({ query: 'all-longshots', row_count: all_longshots_results.length })

    // Query 5: Extreme longshots from latest week
    const extreme_longshots_results = await query_extreme_longshots_latest_week({ year: argv.year, week })
    const extreme_longshots_markdown = format_results_to_markdown_table({
      results: extreme_longshots_results,
      title: `Extreme Longshot Highlights (1000+ Odds) - Week ${week}`,
      query_info: `Only the most extreme longshot wins from week ${week}`,
      columns: [
        { key: 'player_name', label: 'Player' },
        { key: 'position', label: 'Pos' },
        { key: 'market_type', label: 'Market Type' },
        { key: 'selection_name', label: 'Selection' },
        { key: 'selection_metric_line', label: 'Line' },
        { key: 'odds_american', label: 'Odds', format: (v) => `+${v}` },
        { key: 'week', label: 'Week' }
      ]
    })
    await fs.writeFile(path.join(output_dir, 'extreme-longshots.md'), extreme_longshots_markdown)
    query_results.push({ query: 'extreme-longshots', row_count: extreme_longshots_results.length })

    // Query 6: Player context
    const all_player_ids = new Set([
      ...player_results.map(p => p.player_id),
      ...all_longshots_results.map(p => p.player_id),
      ...extreme_longshots_results.map(p => p.player_id)
    ])
    const player_context_results = await query_player_context({
      year: argv.year,
      player_ids: Array.from(all_player_ids)
    })
    const player_context_markdown = format_results_to_markdown_table({
      results: player_context_results,
      title: 'Player Context Analysis',
      query_info: `Background information for players with longshot wins`,
      columns: [
        { key: 'pname', label: 'Player' },
        { key: 'pos', label: 'Pos' },
        { key: 'player_category', label: 'Category' },
        { key: 'nfl_seasons', label: 'Seasons' },
        { key: 'current_nfl_team', label: 'Team' },
        { key: 'height', label: 'Height' },
        { key: 'weight', label: 'Weight' },
        { key: 'college', label: 'College' },
        { key: 'nfl_draft_year', label: 'Draft Year' }
      ]
    })
    await fs.writeFile(path.join(output_dir, 'player-context.md'), player_context_markdown)
    query_results.push({ query: 'player-context', row_count: player_context_results.length })

    // Save metadata
    const execution_time_ms = Date.now() - start_time
    await save_metadata({ output_dir, year: argv.year, week, query_results, execution_time_ms })

    log(`✓ Export complete in ${execution_time_ms}ms`)
    log(`  Data saved to: ${output_dir}`)
    log(`  Next step: Run summary script with --data-dir ${output_dir}`)

    log(`Report: Successfully exported week ${week} data with ${query_results.length} queries`)

  } catch (error) {
    log(`Error: ${error.message}`)

    throw error
  } finally {
    await db.destroy()
  }
}

if (is_main(import.meta.url)) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export default main
