import debug from 'debug'

import db from '#db'
import { is_main } from '#libs-server'
import {
  get_supported_market_types,
  get_unsupported_market_types,
  get_market_types_by_data_source,
  HANDLER_TYPES
} from '#libs-server/prop-market-settlement/index.mjs'

const log = debug('analyze-market-type-coverage')
debug.enable('analyze-market-type-coverage')

const analyze_market_type_coverage = async () => {
  log('Analyzing market type coverage')

  // Get market type distribution from database
  const market_type_counts = await db('prop_markets_index')
    .select('market_type')
    .count('* as count')
    .groupBy('market_type')
    .orderBy('count', 'desc')

  const total_markets = market_type_counts.reduce(
    (sum, row) => sum + parseInt(row.count),
    0
  )

  log(`Total markets in database: ${total_markets.toLocaleString()}`)

  // Get supported vs unsupported breakdown
  const supported_types = new Set(get_supported_market_types())
  const unsupported_types = new Set(get_unsupported_market_types())
  const data_source_breakdown = get_market_types_by_data_source()

  let supported_count = 0
  let unsupported_count = 0
  let null_count = 0

  console.log('\n=== MARKET TYPE COVERAGE ANALYSIS ===\n')

  console.log('TOP 20 MARKET TYPES BY VOLUME:')
  console.log(
    'Type'.padEnd(50),
    'Count'.padStart(10),
    'Supported'.padStart(12),
    'Handler'
  )
  console.log('-'.repeat(85))

  for (const row of market_type_counts.slice(0, 20)) {
    const market_type = row.market_type
    const count = parseInt(row.count)

    if (market_type === null) {
      null_count += count
      console.log(
        '(NULL)'.padEnd(50),
        count.toLocaleString().padStart(10),
        'No'.padStart(12),
        'N/A'
      )
      continue
    }

    const is_supported = supported_types.has(market_type)
    const calculator_type =
      Object.keys(data_source_breakdown).find((calc_type) =>
        data_source_breakdown[calc_type].includes(market_type)
      ) || 'NONE'

    if (is_supported) {
      supported_count += count
    } else {
      unsupported_count += count
    }

    console.log(
      market_type.padEnd(50),
      count.toLocaleString().padStart(10),
      (is_supported ? 'Yes' : 'No').padStart(12),
      calculator_type.replace('HANDLER_TYPES.', '')
    )
  }

  console.log('-'.repeat(85))
  console.log(
    'TOTALS'.padEnd(50),
    total_markets.toLocaleString().padStart(10),
    '',
    ''
  )

  // Coverage summary
  console.log('\n=== COVERAGE SUMMARY ===\n')

  const supported_percentage = (
    (supported_count / total_markets) *
    100
  ).toFixed(1)
  const unsupported_percentage = (
    (unsupported_count / total_markets) *
    100
  ).toFixed(1)
  const null_percentage = ((null_count / total_markets) * 100).toFixed(1)

  console.log(
    `Supported markets:    ${supported_count.toLocaleString().padStart(12)} (${supported_percentage}%)`
  )
  console.log(
    `Unsupported markets:  ${unsupported_count.toLocaleString().padStart(12)} (${unsupported_percentage}%)`
  )
  console.log(
    `NULL market types:    ${null_count.toLocaleString().padStart(12)} (${null_percentage}%)`
  )
  console.log(
    `Total markets:        ${total_markets.toLocaleString().padStart(12)} (100.0%)`
  )

  // Handler breakdown
  console.log('\n=== CALCULATOR BREAKDOWN ===\n')

  for (const [calculator_type, market_types] of Object.entries(
    data_source_breakdown
  )) {
    if (calculator_type === HANDLER_TYPES.UNSUPPORTED) {
      continue
    }

    const calculator_count = market_types
      .map(
        (type) =>
          market_type_counts.find((row) => row.market_type === type)?.count || 0
      )
      .reduce((sum, count) => sum + parseInt(count), 0)

    const calculator_percentage = (
      (calculator_count / total_markets) *
      100
    ).toFixed(1)

    console.log(`${calculator_type}:`)
    console.log(
      `  Markets: ${calculator_count.toLocaleString()} (${calculator_percentage}%)`
    )
    console.log(`  Types: ${market_types.length}`)

    // Show top 5 market types for this calculator
    const top_types = market_types
      .map((type) => ({
        type,
        count: parseInt(
          market_type_counts.find((row) => row.market_type === type)?.count || 0
        )
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .filter((item) => item.count > 0)

    if (top_types.length > 0) {
      console.log('  Top types:')
      for (const item of top_types) {
        console.log(`    ${item.type}: ${item.count.toLocaleString()}`)
      }
    }
    console.log()
  }

  // Unsupported markets analysis
  console.log('=== UNSUPPORTED MARKETS ===\n')

  const unsupported_with_counts = Array.from(unsupported_types)
    .map((type) => ({
      type,
      count: parseInt(
        market_type_counts.find((row) => row.market_type === type)?.count || 0
      )
    }))
    .sort((a, b) => b.count - a.count)
    .filter((item) => item.count > 0)

  console.log('Type'.padEnd(50), 'Count'.padStart(10), 'Reason')
  console.log('-'.repeat(85))

  for (const item of unsupported_with_counts.slice(0, 10)) {
    let reason = 'Unknown'
    if (item.type.includes('SEASON_')) {
      reason = 'Season aggregation required'
    } else if (item.type.includes('AWARD') || item.type.includes('MVP')) {
      reason = 'External voting data required'
    } else if (item.type.includes('FUTURE') || item.type.includes('WINNER')) {
      reason = 'Future outcome determination'
    }

    console.log(
      item.type.padEnd(50),
      item.count.toLocaleString().padStart(10),
      reason
    )
  }

  console.log('\n=== RECOMMENDATIONS ===\n')

  if (null_percentage > 10) {
    console.log(
      `• High NULL market type percentage (${null_percentage}%) - consider improving market type classification`
    )
  }

  if (supported_percentage < 70) {
    console.log(
      `• Low supported market coverage (${supported_percentage}%) - consider adding more calculators`
    )
  }

  const high_volume_unsupported = unsupported_with_counts
    .filter((item) => item.count > 1000)
    .slice(0, 3)

  if (high_volume_unsupported.length > 0) {
    console.log('• High-volume unsupported market types to prioritize:')
    for (const item of high_volume_unsupported) {
      console.log(`  - ${item.type}: ${item.count.toLocaleString()} markets`)
    }
  }

  console.log()
}

const main = async () => {
  try {
    await analyze_market_type_coverage()
  } catch (error) {
    log(`Error: ${error.message}`)
    console.error(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default analyze_market_type_coverage
