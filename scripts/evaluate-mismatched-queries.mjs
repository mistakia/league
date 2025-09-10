#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import knex from '#db'
import {
  is_main,
  get_data_view_results_query,
  load_data_view_test_queries,
  update_test_file,
  process_expected_query,
  format_sql,
  normalize_sql_for_comparison
} from '#libs-server'

const log = debug('evaluate-mismatched-queries')

/**
 * Configuration for query evaluation
 */
const EVALUATION_CONFIG = {
  query_timeout_ms: 40000, // 40 seconds to match production
  performance_runs: 2,
  result_sample_size: 100
}

/**
 * Compare queries using the same logic as the test suite
 */
const compare_queries_logic = (actual_query, expected_query) => {
  const actual_query_normalized = normalize_sql_for_comparison(actual_query)
  const expected_query_normalized = normalize_sql_for_comparison(expected_query)

  return {
    matches: actual_query_normalized === expected_query_normalized,
    actual_normalized: actual_query_normalized,
    expected_normalized: expected_query_normalized
  }
}

/**
 * Format SQL query for better readability in diffs
 */
const format_sql_query = async (query) => {
  return await format_sql(query, {
    parser: 'babel',
    wrapInTemplate: true,
    keywordCase: 'lower',
    printWidth: 80,
    tabWidth: 2
  })
}

/**
 * Sanitize filename for safe use in shell commands
 */
const sanitize_filename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 100) // Limit length
}

/**
 * Generate a git-style diff between two strings
 */
const generate_diff = async (actual, expected, label = 'query') => {
  let temp_dir = null
  let expected_file = null
  let actual_file = null

  try {
    // Use system temp directory and create a unique subdirectory
    const base_temp_dir = os.tmpdir()
    const unique_id = `query_diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    temp_dir = path.join(base_temp_dir, unique_id)
    await fs.mkdir(temp_dir, { recursive: true })

    // Sanitize the label for filename
    const safe_label = sanitize_filename(label)
    expected_file = path.join(temp_dir, `${safe_label}_expected.sql`)
    actual_file = path.join(temp_dir, `${safe_label}_actual.sql`)

    await fs.writeFile(expected_file, expected, 'utf8')
    await fs.writeFile(actual_file, actual, 'utf8')

    // Try git diff with proper error handling
    try {
      const diff_output = execSync(
        `git diff --no-index --color=always --word-diff=color "${expected_file}" "${actual_file}"`,
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }
      )
      return diff_output
    } catch (git_error) {
      // Git diff returns exit code 1 when files differ, which is expected
      if (git_error.status === 1 && git_error.stdout) {
        return git_error.stdout
      }

      // If git diff fails completely, throw an error
      throw new Error(`Git diff failed: ${git_error.message}`)
    }
  } catch (error) {
    throw new Error(`Error generating diff for ${label}: ${error.message}`)
  } finally {
    // Clean up temp files
    try {
      if (expected_file) await fs.unlink(expected_file).catch(() => {})
      if (actual_file) await fs.unlink(actual_file).catch(() => {})
      if (temp_dir) await fs.rmdir(temp_dir).catch(() => {})
    } catch (cleanup_error) {
      console.warn('Error cleaning up temp files:', cleanup_error.message)
    }
  }
}

/**
 * Format data rows for diff comparison
 */
const format_data_for_diff = (rows) => {
  if (!rows || rows.length === 0) {
    return 'No data returned'
  }

  // Preserve original order - this is important for comparing query results
  return rows
    .map((row, index) => {
      const sorted_keys = Object.keys(row).sort()
      const sorted_row = {}
      sorted_keys.forEach((key) => {
        sorted_row[key] = row[key]
      })
      return `Row ${index + 1}:\n${JSON.stringify(sorted_row, null, 2)}`
    })
    .join('\n---\n')
}

/**
 * Generate a data diff between actual and expected results
 */
const generate_data_diff = async (
  actual_data,
  expected_data,
  label = 'data'
) => {
  const formatted_actual = format_data_for_diff(actual_data)
  const formatted_expected = format_data_for_diff(expected_data)

  return await generate_diff(
    formatted_actual,
    formatted_expected,
    `${label}_data`
  )
}

/**
 * Clean up SQL error messages to extract the meaningful part
 */
const clean_sql_error = (error_message) => {
  // Look for the pattern "- " followed by the actual error message
  const dash_index = error_message.lastIndexOf(' - ')
  if (dash_index !== -1) {
    return error_message.substring(dash_index + 3).trim()
  }
  return error_message
}

/**
 * Execute a query with timeout and performance analysis
 */
const evaluate_query = async (
  query,
  label,
  timeout_ms = EVALUATION_CONFIG.query_timeout_ms
) => {
  const start = process.hrtime.bigint()
  let timeoutId

  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeout_ms}ms`))
    }, timeout_ms)
  })

  try {
    // Race between query execution and timeout
    const result = await Promise.race([
      execute_query_with_analysis(query),
      timeoutPromise
    ])

    clearTimeout(timeoutId)

    const totalTime = Number(process.hrtime.bigint() - start) / 1000000

    return {
      ...result,
      total_execution_time_ms: totalTime,
      timed_out: false
    }
  } catch (error) {
    clearTimeout(timeoutId)

    const totalTime = Number(process.hrtime.bigint() - start) / 1000000

    return {
      success: false,
      error: clean_sql_error(error.message),
      timed_out: error.message.includes('timeout'),
      total_execution_time_ms: totalTime,
      row_count: 0,
      execution_time_ms: null,
      planning_time_ms: null,
      query_plan: null,
      sample_data: [],
      data_checksum: null
    }
  }
}

/**
 * Execute query with EXPLAIN ANALYZE and get results
 */
const execute_query_with_analysis = async (query) => {
  // First get the explain plan
  const explainResult = await knex.raw(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
  )
  const queryPlan = explainResult.rows[0]['QUERY PLAN'][0]

  // Then execute the actual query for results
  const dataResult = await knex.raw(query)

  // Calculate data checksum for comparison
  const data_checksum = calculate_data_checksum(dataResult.rows)

  return {
    success: true,
    row_count: dataResult.rows.length,
    execution_time_ms: queryPlan['Execution Time'],
    planning_time_ms: queryPlan['Planning Time'],
    query_plan: summarize_query_plan(queryPlan.Plan),
    sample_data: dataResult.rows.slice(0, EVALUATION_CONFIG.result_sample_size),
    data_checksum,
    error: null
  }
}

/**
 * Calculate a checksum for query results
 */
const calculate_data_checksum = (rows) => {
  if (!rows || rows.length === 0) return 'empty'

  // Preserve original order - only sort keys within each row for consistency
  const normalizedData = rows
    .slice(0, EVALUATION_CONFIG.result_sample_size)
    .map((row, index) => {
      const sortedKeys = Object.keys(row).sort()
      const rowData = sortedKeys
        .map((key) => `${key}:${JSON.stringify(row[key])}`)
        .join('|')
      return `${index}:${rowData}` // Include row index to preserve order
    })
    .join('\n')

  // Simple hash
  let hash = 0
  for (let i = 0; i < normalizedData.length; i++) {
    const char = normalizedData.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }

  return hash.toString(16)
}

/**
 * Summarize query plan for reporting
 */
const summarize_query_plan = (plan) => {
  if (!plan) return null

  return {
    node_type: plan['Node Type'],
    total_cost: plan['Total Cost'],
    startup_cost: plan['Startup Cost'],
    plan_rows: plan['Plan Rows'],
    plan_width: plan['Plan Width'],
    actual_rows: plan['Actual Rows'],
    actual_loops: plan['Actual Loops'],
    actual_total_time: plan['Actual Total Time'],
    has_subplans: Boolean(plan.Plans && plan.Plans.length > 0)
  }
}

/**
 * Compare two query evaluation results
 */
const compare_results = (actual_result, expected_result, test_name) => {
  const comparison = {
    test_name,
    data_matches: false,
    performance_comparison: null,
    recommendation: 'INVESTIGATE',
    details: []
  }

  // Check if both succeeded
  if (!actual_result.success && !expected_result.success) {
    comparison.details.push('Both queries failed')
    if (actual_result.timed_out || expected_result.timed_out) {
      comparison.details.push('One or both queries timed out')
      comparison.recommendation = 'TIMEOUT'
    } else {
      comparison.recommendation = 'BOTH_FAILED'
    }
    return comparison
  }

  if (!actual_result.success) {
    comparison.details.push(`Actual query failed: ${actual_result.error}`)
    comparison.recommendation = actual_result.timed_out
      ? 'ACTUAL_TIMEOUT'
      : 'ACTUAL_FAILED'
    return comparison
  }

  if (!expected_result.success) {
    comparison.details.push(`Expected query failed: ${expected_result.error}`)
    comparison.recommendation = expected_result.timed_out
      ? 'EXPECTED_TIMEOUT'
      : 'EXPECTED_FAILED'
    return comparison
  }

  // Both succeeded - compare data
  comparison.data_matches =
    actual_result.data_checksum === expected_result.data_checksum

  if (comparison.data_matches) {
    comparison.details.push(`Data matches (${actual_result.row_count} rows)`)
  } else {
    comparison.details.push(
      `Data mismatch - Actual: ${actual_result.row_count} rows, Expected: ${expected_result.row_count} rows`,
      `Checksums: ${actual_result.data_checksum} vs ${expected_result.data_checksum}`
    )
  }

  // Compare performance
  const actualTime = actual_result.execution_time_ms || 0
  const expectedTime = expected_result.execution_time_ms || 0

  if (actualTime > 0 && expectedTime > 0) {
    const performanceRatio = actualTime / expectedTime
    comparison.performance_comparison = {
      actual_ms: actualTime,
      expected_ms: expectedTime,
      ratio: performanceRatio,
      improvement:
        performanceRatio < 1
          ? `${((1 - performanceRatio) * 100).toFixed(1)}% faster`
          : `${((performanceRatio - 1) * 100).toFixed(1)}% slower`
    }

    comparison.details.push(
      `Performance: ${comparison.performance_comparison.improvement}`
    )
  }

  // Determine recommendation
  if (comparison.data_matches) {
    if (
      !comparison.performance_comparison ||
      comparison.performance_comparison.ratio <= 1.2
    ) {
      comparison.recommendation = 'SAFE_TO_UPDATE'
    } else {
      comparison.recommendation = 'PERFORMANCE_REGRESSION'
    }
  } else {
    comparison.recommendation = 'DATA_MISMATCH'
  }

  return comparison
}

/**
 * Main evaluation function
 */
const main = async () => {
  try {
    // Parse command line arguments
    const options = parse_arguments()

    log('Loading test cases...')
    const all_test_cases = await load_data_view_test_queries()

    if (all_test_cases.length === 0) {
      console.log('No test cases found in test/data-view-queries directory')
      process.exit(0)
    }

    // Handle list options
    if (options.listTags) {
      list_available_tags(all_test_cases)
      process.exit(0)
    }

    if (options.listTests) {
      list_available_tests(all_test_cases)
      process.exit(0)
    }

    // Filter test cases based on options
    const test_cases = filter_test_cases(all_test_cases, options)

    if (test_cases.length === 0) {
      console.log('No test cases match the specified filters')
      process.exit(0)
    }

    // Show filtering information
    if (test_cases.length !== all_test_cases.length) {
      console.log(
        `\nFiltered ${test_cases.length} test cases from ${all_test_cases.length} total`
      )
      if (options.file) {
        console.log(`File filter: ${options.file}`)
      }
      if (options.tag && options.tag.length > 0) {
        console.log(`Tag filter: ${options.tag.join(', ')}`)
      }
      if (options.grep) {
        console.log(`Grep filter: ${options.grep}`)
      }
    } else {
      console.log(`\nLoaded ${test_cases.length} test cases`)
    }

    console.log('Checking for query mismatches...\n')

    const mismatched_cases = []
    const matched_cases = []

    // First pass: check which queries match
    for (const test_case of test_cases) {
      try {
        // Generate query using the data view system
        const { query } = await get_data_view_results_query(test_case.request)
        const actual_query = query.toString()

        // Process the expected query to handle template literals
        const expected_query = process_expected_query(test_case.expected_query)

        // Compare with expected query
        const comparison = compare_queries_logic(actual_query, expected_query)

        if (comparison.matches) {
          matched_cases.push({
            name: test_case.name,
            filename: test_case.filename
          })
        } else {
          mismatched_cases.push({
            ...test_case,
            actual_query,
            expected_query_processed: expected_query,
            query_comparison: comparison
          })
        }
      } catch (error) {
        const cleaned_error = clean_sql_error(error.message)
        console.log(
          `ERROR - Generation failed for ${test_case.name}: ${cleaned_error}`
        )
        console.log('Full stack trace:')
        console.log(error.stack)
        mismatched_cases.push({
          ...test_case,
          actual_query: null,
          generation_error: cleaned_error,
          generation_error_stack: error.stack
        })
      }
    }

    console.log(`Matched queries: ${matched_cases.length}`)
    console.log(`Mismatched queries: ${mismatched_cases.length}`)

    if (mismatched_cases.length === 0) {
      console.log('\nAll queries match! No further evaluation needed.')
      process.exit(0)
    }

    console.log(
      `\nEvaluating ${mismatched_cases.length} mismatched queries...\n`
    )

    const evaluation_results = []

    // Process mismatched cases sequentially
    for (let i = 0; i < mismatched_cases.length; i++) {
      const test_case = mismatched_cases[i]

      console.log(
        `Evaluating ${i + 1}/${mismatched_cases.length}: ${test_case.filename}`
      )

      // Skip if no actual query generated
      if (!test_case.actual_query) {
        const error_msg = clean_sql_error(
          test_case.generation_error || 'No actual query generated'
        )
        console.log(`  ERROR - Skipping - Generation failed: ${error_msg}`)
        if (test_case.generation_error_stack) {
          console.log('  Full stack trace:')
          console.log(test_case.generation_error_stack)
        }
        evaluation_results.push({
          test_name: test_case.name,
          filename: test_case.filename,
          error: error_msg,
          error_stack: test_case.generation_error_stack,
          recommendation: 'GENERATION_FAILED',
          query_diff: null,
          actual_result: null,
          expected_result: null,
          comparison: null
        })
        continue
      }

      // Generate beautified diff
      const formatted_actual = await format_sql_query(
        test_case.query_comparison.actual_normalized
      )
      const formatted_expected = await format_sql_query(
        test_case.query_comparison.expected_normalized
      )
      const query_diff = await generate_diff(
        formatted_actual,
        formatted_expected,
        test_case.name
      )

      // Evaluate both queries for performance and results
      // Use the processed expected query if available, otherwise fall back to original
      const expected_query_to_evaluate =
        test_case.expected_query_processed || test_case.expected_query
      const [actual_result, expected_result] = await Promise.all([
        evaluate_query(test_case.actual_query, 'actual'),
        evaluate_query(expected_query_to_evaluate, 'expected')
      ])

      // Compare results
      const comparison = compare_results(
        actual_result,
        expected_result,
        test_case.name
      )

      // Generate data diff if there's a data mismatch
      let data_diff = null
      if (
        comparison.recommendation === 'DATA_MISMATCH' &&
        actual_result.success &&
        expected_result.success
      ) {
        try {
          data_diff = await generate_data_diff(
            actual_result.sample_data,
            expected_result.sample_data,
            test_case.name
          )
        } catch (error) {
          console.warn(
            `Failed to generate data diff for ${test_case.name}: ${error.message}`
          )
        }
      }

      evaluation_results.push({
        test_name: test_case.name,
        filename: test_case.filename,
        request: test_case.request,
        actual_query: test_case.actual_query, // Store raw actual query
        query_diff,
        data_diff,
        formatted_actual_query: formatted_actual,
        formatted_expected_query: formatted_expected,
        actual_result,
        expected_result,
        comparison
      })

      console.log(`  Result: ${comparison.recommendation}`)

      // Show SQL errors immediately for visibility
      if (actual_result.error) {
        console.log(`  ERROR - Actual Query Error: ${actual_result.error}`)
      }
      if (expected_result.error) {
        console.log(`  ERROR - Expected Query Error: ${expected_result.error}`)
      }
    }

    // Generate summary
    const count_by_recommendation = (recommendation) =>
      evaluation_results.filter(
        (r) =>
          r.comparison?.recommendation === recommendation ||
          r.recommendation === recommendation
      ).length

    const summary = {
      total_test_cases: test_cases.length,
      matched_queries: matched_cases.length,
      mismatched_queries: mismatched_cases.length,
      total_evaluated: evaluation_results.length,
      safe_to_update: count_by_recommendation('SAFE_TO_UPDATE'),
      data_mismatches: count_by_recommendation('DATA_MISMATCH'),
      performance_regressions: count_by_recommendation(
        'PERFORMANCE_REGRESSION'
      ),
      timeouts: evaluation_results.filter((r) =>
        r.comparison?.recommendation?.includes('TIMEOUT')
      ).length,
      errors: evaluation_results.filter((r) =>
        r.comparison?.recommendation?.includes('FAILED')
      ).length,
      generation_failures: count_by_recommendation('GENERATION_FAILED')
    }

    console.log(`Generation failures: ${summary.generation_failures}`)

    // Display results without saving
    console.log('\n=== EVALUATION RESULTS ===')
    console.log(`Total test cases: ${summary.total_test_cases}`)
    console.log(`Matched queries: ${summary.matched_queries}`)
    console.log(`Mismatched queries: ${summary.mismatched_queries}`)
    console.log(`Total evaluated: ${summary.total_evaluated}`)
    console.log(
      `Safe to update: ${summary.safe_to_update} (${((summary.safe_to_update / summary.total_evaluated) * 100).toFixed(1)}%)`
    )
    console.log(`Data mismatches: ${summary.data_mismatches}`)
    console.log(`Performance regressions: ${summary.performance_regressions}`)
    console.log(`Timeouts: ${summary.timeouts}`)
    console.log(`SQL Errors: ${summary.errors}`)
    console.log(`Generation failures: ${summary.generation_failures}`)

    // Show detailed error breakdown if there are errors
    if (
      summary.errors > 0 ||
      summary.generation_failures > 0 ||
      summary.timeouts > 0
    ) {
      console.log('\n=== ERROR DETAILS ===')

      const error_results = evaluation_results.filter(
        (r) =>
          r.actual_result?.error ||
          r.expected_result?.error ||
          r.error ||
          r.actual_result?.timed_out ||
          r.expected_result?.timed_out
      )

      error_results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.test_name} (${result.filename})`)
        if (result.error) {
          console.log(`   ERROR - Generation Error: ${result.error}`)
          if (result.error_stack) {
            console.log('   Full stack trace:')
            console.log(result.error_stack)
          }
        }
        if (result.actual_result?.error) {
          console.log(
            `   ERROR - Actual Query Error: ${result.actual_result.error}`
          )
          if (result.actual_result.timed_out) {
            console.log(`   TIMEOUT - Actual query timed out`)
          }
        }
        if (result.expected_result?.error) {
          console.log(
            `   ERROR - Expected Query Error: ${result.expected_result.error}`
          )
          if (result.expected_result.timed_out) {
            console.log(`   TIMEOUT - Expected query timed out`)
          }
        }
      })
    }

    // Generate update recommendations
    generate_update_recommendations(evaluation_results, options)

    // Handle update options
    if (options.updateSafe) {
      await handle_test_updates(evaluation_results, options)
    }

    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

/**
 * Handle test file updates
 */
const handle_test_updates = async (results, options) => {
  // Only update files marked as SAFE_TO_UPDATE
  const safe_updates = results.filter(
    (r) => r.comparison?.recommendation === 'SAFE_TO_UPDATE'
  )

  if (safe_updates.length === 0) {
    console.log('\nNo safe test files to update')
    return
  }

  console.log(`\n=== UPDATING SAFE TEST FILES ===`)
  console.log(`Files to update: ${safe_updates.length}`)

  for (const result of safe_updates) {
    try {
      // Get the raw actual query (not formatted)
      const actual_query = result.actual_query || result.formatted_actual_query
      await update_test_file(result.filename, actual_query)
      console.log(`✓ Updated: ${result.filename}`)
    } catch (error) {
      console.error(`✗ Failed to update ${result.filename}: ${error.message}`)
    }
  }

  console.log(`\nUpdated ${safe_updates.length} test files`)
}

/**
 * Display query diff with consistent formatting
 */
const display_query_diff = (
  query_diff,
  label = 'Query Differences',
  max_query_diff_display_lines = 200
) => {
  if (!query_diff?.trim()) return

  console.log(`   ${label}:`)
  const diff_lines = query_diff.split('\n').filter((line) => line.trim())
  const limited_diff_lines = diff_lines.slice(0, max_query_diff_display_lines)
  limited_diff_lines.forEach((line) => console.log(`     ${line}`))
  if (diff_lines.length > max_query_diff_display_lines) {
    console.log(
      `     ... (${diff_lines.length - max_query_diff_display_lines} more lines)`
    )
  }
}

/**
 * Display data diff with consistent formatting
 */
const display_data_diff = (result, label = 'Data Differences') => {
  if (result.data_diff?.trim()) {
    console.log(`   ${label}:`)
    const diff_lines = result.data_diff
      .split('\n')
      .filter((line) => line.trim())
    const limited_diff_lines = diff_lines.slice(0, 30)
    limited_diff_lines.forEach((line) => console.log(`     ${line}`))
    if (diff_lines.length > 30) {
      console.log(`     ... (${diff_lines.length - 30} more lines)`)
    }
  } else {
    console.log(
      `   ${label}: (No diff generated - this may indicate an issue with diff generation)`
    )
    console.log(`   Actual checksum: ${result.actual_result?.data_checksum}`)
    console.log(
      `   Expected checksum: ${result.expected_result?.data_checksum}`
    )
    console.log(
      `   Actual sample size: ${result.actual_result?.sample_data?.length || 0}`
    )
    console.log(
      `   Expected sample size: ${result.expected_result?.sample_data?.length || 0}`
    )

    // Show first few rows to help with debugging
    if (
      result.actual_result?.sample_data?.length > 0 &&
      result.expected_result?.sample_data?.length > 0
    ) {
      console.log(
        `   First actual row: ${JSON.stringify(result.actual_result.sample_data[0])}`
      )
      console.log(
        `   First expected row: ${JSON.stringify(result.expected_result.sample_data[0])}`
      )
    }
  }
}

/**
 * Display full queries if requested
 */
const display_full_queries = (result, options) => {
  if (
    !options.showFullQueries ||
    !result.formatted_actual_query ||
    !result.formatted_expected_query
  ) {
    return
  }

  console.log(`\n   Full Actual Query:`)
  console.log(
    `     ${result.formatted_actual_query.split('\n').join('\n     ')}`
  )
  console.log(`\n   Full Expected Query:`)
  console.log(
    `     ${result.formatted_expected_query.split('\n').join('\n     ')}`
  )
}

/**
 * Display performance information
 */
const display_performance_info = (result) => {
  if (result.comparison?.performance_comparison) {
    const { improvement, actual_ms, expected_ms } =
      result.comparison.performance_comparison
    console.log(
      `   Performance: ${improvement} (${actual_ms.toFixed(1)}ms vs ${expected_ms.toFixed(1)}ms)`
    )
  }
}

/**
 * Display error information
 */
const display_error_info = (result) => {
  if (result.recommendation === 'GENERATION_FAILED') {
    console.log(`   ERROR - Generation Error: ${result.error}`)
    if (result.error_stack) {
      console.log('   Full stack trace:')
      console.log(result.error_stack)
    }
  }

  if (result.actual_result?.error) {
    console.log(
      `   ERROR - SQL Error (Actual Query): ${result.actual_result.error}`
    )
    if (result.actual_result.timed_out) {
      console.log(
        `   TIMEOUT - Query timed out after ${EVALUATION_CONFIG.query_timeout_ms}ms`
      )
    }
  }
  if (result.expected_result?.error) {
    console.log(
      `   ERROR - SQL Error (Expected Query): ${result.expected_result.error}`
    )
    if (result.expected_result.timed_out) {
      console.log(
        `   TIMEOUT - Query timed out after ${EVALUATION_CONFIG.query_timeout_ms}ms`
      )
    }
  }
}

/**
 * Display result details
 */
const display_result_details = (result) => {
  if (result.comparison?.details?.length > 0) {
    console.log(`   Result Details:`)
    result.comparison.details.forEach((detail) =>
      console.log(`     - ${detail}`)
    )
  }
}

/**
 * Display common query information for any result
 */
const display_query_info = (result, options) => {
  // Always show row count if available
  if (result.actual_result?.row_count !== undefined) {
    console.log(`   Rows: ${result.actual_result.row_count}`)
  }

  // Always show performance info
  display_performance_info(result)

  // Always show query diff
  display_query_diff(result.query_diff, 'Query Differences', options.maxLines)

  // Show error information
  display_error_info(result)

  // Show result details
  display_result_details(result)

  // Show data diff for data mismatches
  if (result.comparison?.recommendation === 'DATA_MISMATCH') {
    display_data_diff(result)
  }

  // Show full queries if requested
  display_full_queries(result, options)
}

/**
 * Generate update recommendations
 */
const generate_update_recommendations = (results, options = {}) => {
  const safe_updates = results.filter(
    (r) => r.comparison?.recommendation === 'SAFE_TO_UPDATE'
  )
  const needs_review = results.filter(
    (r) =>
      r.comparison?.recommendation !== 'SAFE_TO_UPDATE' &&
      r.recommendation !== 'SAFE_TO_UPDATE'
  )

  console.log('\n=== UPDATE RECOMMENDATIONS ===')

  if (safe_updates.length > 0) {
    console.log(`\nSafe to update (${safe_updates.length} queries):`)
    safe_updates.forEach((r, index) => {
      const perf_change =
        r.comparison.performance_comparison?.improvement || 'No change'
      console.log(`\n${index + 1}. ${r.filename}: ${perf_change}`)
      display_query_info(r, options)
    })

    console.log(`\n   To update these test files, run with --update-safe flag`)
  }

  if (needs_review.length > 0) {
    console.log(`\nNeeds review (${needs_review.length} queries):`)
    needs_review.forEach((r, index) => {
      const reason = r.comparison?.recommendation || r.recommendation || r.error
      console.log(`\n${index + 1}. ${r.filename}: ${reason}`)
      display_query_info(r, options)
    })
  }
}

/**
 * Filter test cases based on provided options
 */
const filter_test_cases = (test_cases, options) => {
  let filtered_cases = [...test_cases]

  // Filter by specific file path
  if (options.file) {
    const target_filename = path.basename(options.file)
    filtered_cases = filtered_cases.filter(
      (test_case) => test_case.filename === target_filename
    )
    if (filtered_cases.length === 0) {
      console.log(`No test case found with filename: ${target_filename}`)
      process.exit(1)
    }
  }

  // Filter by tags
  if (options.tag && options.tag.length > 0) {
    filtered_cases = filtered_cases.filter((test_case) => {
      if (!test_case.tags || !Array.isArray(test_case.tags)) {
        return false
      }
      return options.tag.some((tag) => test_case.tags.includes(tag))
    })
  }

  // Filter by grep pattern (name or description)
  if (options.grep) {
    const grep_pattern = new RegExp(options.grep, 'i')
    filtered_cases = filtered_cases.filter((test_case) => {
      return (
        grep_pattern.test(test_case.name) ||
        grep_pattern.test(test_case.description || '') ||
        grep_pattern.test(test_case.filename)
      )
    })
  }

  return filtered_cases
}

/**
 * Parse command line arguments
 */
const parse_arguments = () => {
  return yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('file', {
      alias: 'f',
      type: 'string',
      description: 'Run a specific test file (provide path or filename)'
    })
    .option('tag', {
      alias: 't',
      type: 'array',
      description: 'Filter by tag(s) - can be specified multiple times'
    })
    .option('grep', {
      alias: 'g',
      type: 'string',
      description:
        'Filter by pattern matching test name, description, or filename'
    })
    .option('list-tags', {
      type: 'boolean',
      description: 'List all available tags and exit'
    })
    .option('list-tests', {
      type: 'boolean',
      description: 'List all available test cases and exit'
    })
    .option('show-full-queries', {
      type: 'boolean',
      description:
        'Show the full beautified actual and expected queries in output'
    })
    .option('update-safe', {
      type: 'boolean',
      description: 'Update test files that are marked as SAFE_TO_UPDATE'
    })
    .option('max-lines', {
      type: 'number',
      default: 200,
      description:
        'Maximum number of lines to display in query diffs (default: 200)'
    })
    .help()
    .alias('help', 'h')
    .example('$0', 'Run all mismatched queries')
    .example(
      '$0 --file create-a-keeptradecut-query.json',
      'Run a specific test file'
    )
    .example(
      '$0 --tag player --tag sorting',
      'Run tests with "player" OR "sorting" tags'
    )
    .example(
      '$0 --grep "keeptradecut"',
      'Run tests matching "keeptradecut" pattern'
    )
    .example('$0 --list-tags', 'Show all available tags')
    .example('$0 --list-tests', 'Show all available test cases')
    .example(
      '$0 --show-full-queries',
      'Include full beautified queries in output'
    )
    .example('$0 --update-safe', 'Update test files that are safe to update')
    .example('$0 --max-lines 100', 'Limit query diff output to 100 lines').argv
}

/**
 * List all available tags from test cases
 */
const list_available_tags = (test_cases) => {
  const all_tags = new Set()
  const tag_counts = {}

  test_cases.forEach((test_case) => {
    if (test_case.tags && Array.isArray(test_case.tags)) {
      test_case.tags.forEach((tag) => {
        all_tags.add(tag)
        tag_counts[tag] = (tag_counts[tag] || 0) + 1
      })
    }
  })

  console.log('\n=== AVAILABLE TAGS ===')
  const sorted_tags = Array.from(all_tags).sort()
  sorted_tags.forEach((tag) => {
    console.log(`${tag} (${tag_counts[tag]} tests)`)
  })
  console.log(`\nTotal unique tags: ${sorted_tags.length}`)
}

/**
 * List all available test cases
 */
const list_available_tests = (test_cases) => {
  console.log('\n=== AVAILABLE TEST CASES ===')
  test_cases.forEach((test_case, index) => {
    console.log(`${index + 1}. ${test_case.filename}`)
    console.log(`   Name: ${test_case.name}`)
    if (test_case.description) {
      console.log(`   Description: ${test_case.description}`)
    }
    if (test_case.tags && test_case.tags.length > 0) {
      console.log(`   Tags: ${test_case.tags.join(', ')}`)
    }
    console.log()
  })
  console.log(`Total test cases: ${test_cases.length}`)
}

if (is_main(import.meta.url)) {
  debug.enable('evaluate-mismatched-queries')
  main().catch(console.error)
}
