import diff from 'deep-diff'
import debug from 'debug'

import { get_cached_selection_latest } from './betting-market-cache.mjs'

const log = debug('insert-prop-market-selections')

// Fields that trigger a history insert when changed
const SELECTION_UPDATE_FIELDS = [
  'selection_name',
  'selection_metric_line',
  'odds_american'
]

// Extract fields needed for selection history inserts
const get_selection_history_record = (selection, observed_at) => ({
  source_id: selection.source_id,
  source_market_id: selection.source_market_id,
  source_selection_id: selection.source_selection_id,
  selection_name: selection.selection_name,
  selection_metric_line: selection.selection_metric_line,
  odds_decimal: selection.odds_decimal,
  odds_american: selection.odds_american,
  observed_at
})

// Validate required selection fields
const validate_selection = (selection, observed_at) => {
  if (!selection.source_id) {
    throw new Error('source_id is required')
  }
  if (!selection.source_market_id) {
    throw new Error('source_market_id is required')
  }
  if (!selection.source_selection_id) {
    throw new Error('source_selection_id is required')
  }
  if (!selection.odds_american) {
    throw new Error('odds_american is required')
  }
  if (!selection.odds_decimal) {
    throw new Error('odds_decimal is required')
  }
  if (!observed_at) {
    throw new Error('observed_at is required')
  }
}

const process_market_selection = ({
  observed_at,
  selection,
  existing_market,
  market
}) => {
  const selection_history_inserts = []
  const selection_index_inserts = []

  const save_new_selection = () => {
    validate_selection(selection, observed_at)

    selection_history_inserts.push(
      get_selection_history_record(selection, observed_at)
    )

    selection_index_inserts.push({
      ...selection,
      observed_at,
      time_type: 'OPEN'
    })

    if (!market.live) {
      selection_index_inserts.push({
        ...selection,
        observed_at,
        time_type: 'CLOSE'
      })
    }

    return {
      source_selection_id: selection.source_selection_id,
      new_selection: true,
      metric_line_changed: false,
      selection_name_changed: false,
      odds_change_amount: 0,
      selection_history_inserts,
      selection_index_inserts
    }
  }

  if (!existing_market) {
    return save_new_selection()
  }

  const existing_selection = get_cached_selection_latest({
    source_id: existing_market.source_id,
    source_market_id: existing_market.source_market_id,
    source_selection_id: selection.source_selection_id
  })

  if (!existing_selection) {
    return save_new_selection()
  }

  // Create a copy to avoid mutating cached object
  const { observed_at: _, ...existing_without_observed_at } = existing_selection
  const differences = diff(existing_without_observed_at, selection)

  let odds_change_amount = 0
  let selection_name_changed = false
  let metric_line_changed = false

  if (differences && differences.length) {
    const should_update = differences.some((d) =>
      SELECTION_UPDATE_FIELDS.includes(d.path[0])
    )

    if (should_update) {
      selection_history_inserts.push(
        get_selection_history_record(selection, observed_at)
      )

      for (const d of differences) {
        if (d.path[0] === 'selection_name') {
          selection_name_changed = true
        } else if (d.path[0] === 'selection_metric_line') {
          metric_line_changed = true
        } else if (d.path[0] === 'odds_american') {
          odds_change_amount = d.rhs - d.lhs
        }
      }
    }
  }

  if (!market.live) {
    selection_index_inserts.push({
      ...selection,
      observed_at,
      time_type: 'CLOSE'
    })
  }

  return {
    source_selection_id: selection.source_selection_id,
    new_selection: false,
    odds_change_amount,
    selection_name_changed,
    metric_line_changed,
    selection_history_inserts,
    selection_index_inserts
  }
}

export default async function ({
  observed_at,
  selections,
  existing_market,
  market
}) {
  const results = []
  const all_selection_history_inserts = []
  const all_selection_index_inserts = []
  const cleanup_operations = []

  // Guard against truly missing selections (null/undefined)
  // Empty arrays are valid - they indicate all selections were removed
  if (!selections) {
    return {
      selection_history_inserts: all_selection_history_inserts,
      selection_index_inserts: all_selection_index_inserts,
      cleanup_operations,
      results
    }
  }

  // Process all selections (skip if empty array)
  if (selections.length > 0) {
    const selection_results = await Promise.allSettled(
      selections.map((selection) =>
        process_market_selection({
          observed_at,
          selection,
          existing_market,
          market
        })
      )
    )

    for (let i = 0; i < selection_results.length; i++) {
      const settled = selection_results[i]
      if (settled.status === 'fulfilled') {
        const result = settled.value
        results.push(result)

        if (result.selection_history_inserts) {
          all_selection_history_inserts.push(
            ...result.selection_history_inserts
          )
        }
        if (result.selection_index_inserts) {
          all_selection_index_inserts.push(...result.selection_index_inserts)
        }
      } else {
        log(selections[i])
        log(settled.reason)
      }
    }
  }

  // Handle cleanup of missing selections for non-live markets
  // Only run cleanup when we have selections to compare against - empty arrays
  // would incorrectly mark all existing selections for deletion
  if (
    !market.live &&
    existing_market &&
    existing_market.source_market_id &&
    selections.length > 0
  ) {
    const new_selection_ids = selections.map((selection) =>
      selection.source_selection_id.toString()
    )
    cleanup_operations.push({
      // source_id scopes the cleanup to the emitting book. Betting sources reuse
      // each other's source_market_id strings, so a cleanup keyed on the market
      // id alone would reap another book's selections.
      source_id: existing_market.source_id,
      source_market_id: existing_market.source_market_id,
      new_selection_ids,
      missing_selection_ids: [] // Determined during batch execution in insert-prop-markets
    })
  }

  return {
    selection_history_inserts: all_selection_history_inserts,
    selection_index_inserts: all_selection_index_inserts,
    cleanup_operations,
    results
  }
}
