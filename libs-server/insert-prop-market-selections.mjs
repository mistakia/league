import diff from 'deep-diff'
import debug from 'debug'

import db from '#db'
import { get_cached_selection_latest } from './betting-market-cache.mjs'

const log = debug('insert-prop-market-selections')

const process_market_selection = async ({
  timestamp,
  selection,
  existing_market,
  market,
  use_cache = false
}) => {
  const selection_history_inserts = []
  const selection_index_inserts = []
  const save_new_selection = () => {
    const {
      source_id,
      source_market_id,
      source_selection_id,
      selection_name,
      selection_metric_line,
      odds_decimal,
      odds_american
    } = selection
    selection_history_inserts.push({
      source_id,
      source_market_id,
      source_selection_id,
      selection_name,
      selection_metric_line,
      odds_decimal,
      odds_american,
      timestamp
    })

    if (!source_id) {
      throw new Error('source_id is required')
    }

    if (!source_market_id) {
      throw new Error('source_market_id is required')
    }

    if (!source_selection_id) {
      throw new Error('source_selection_id is required')
    }

    if (!odds_american) {
      throw new Error('odds_american is required')
    }

    if (!odds_decimal) {
      throw new Error('odds_decimal is required')
    }

    if (!timestamp) {
      throw new Error('timestamp is required')
    }

    selection_index_inserts.push({
      ...selection,
      timestamp,
      time_type: 'OPEN'
    })
    if (!market.live) {
      selection_index_inserts.push({
        ...selection,
        timestamp,
        time_type: 'CLOSE'
      })
    }

    return {
      source_selection_id,
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

  let existing_selection = null
  if (use_cache) {
    existing_selection = get_cached_selection_latest({
      source_id: existing_market.source_id,
      source_market_id: existing_market.source_market_id,
      source_selection_id: selection.source_selection_id
    })
  } else {
    existing_selection = await db('prop_market_selections_history')
      .where({
        source_id: existing_market.source_id,
        source_market_id: existing_market.source_market_id,
        source_selection_id: selection.source_selection_id
      })
      .orderBy('timestamp', 'desc')
      .first()
  }

  if (!existing_selection) {
    return save_new_selection()
  }

  delete existing_selection.timestamp
  const differences = diff(existing_selection, selection)

  let odds_change_amount = 0
  let selection_name_changed = false
  let metric_line_changed = false

  if (differences && differences.length) {
    const update_on_change = [
      'selection_name',
      'selection_metric_line',
      'odds_american'
    ]
    const should_update = differences.some((difference) =>
      update_on_change.includes(difference.path[0])
    )

    if (should_update) {
      const {
        source_id,
        source_market_id,
        source_selection_id,
        selection_name,
        selection_metric_line,
        odds_decimal,
        odds_american
      } = selection
      selection_history_inserts.push({
        timestamp,
        source_id,
        source_market_id,
        source_selection_id,
        selection_name,
        selection_metric_line,
        odds_decimal,
        odds_american
      })

      differences.forEach((difference) => {
        if (difference.path[0] === 'selection_name') {
          selection_name_changed = true
        } else if (difference.path[0] === 'selection_metric_line') {
          metric_line_changed = true
        } else if (difference.path[0] === 'odds_american') {
          odds_change_amount = difference.rhs - difference.lhs
        }
      })
    }
  }

  if (!market.live) {
    selection_index_inserts.push({
      ...selection,
      timestamp,
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
  timestamp,
  selections,
  existing_market,
  market,
  use_cache = false
}) {
  const results = []
  const all_selection_history_inserts = []
  const all_selection_index_inserts = []
  const cleanup_operations = []

  // Process all selections
  for (const selection of selections) {
    try {
      const result = await process_market_selection({
        timestamp,
        selection,
        existing_market,
        market,
        use_cache
      })
      results.push(result)

      if (result.selection_history_inserts) {
        all_selection_history_inserts.push(...result.selection_history_inserts)
      }
      if (result.selection_index_inserts) {
        all_selection_index_inserts.push(...result.selection_index_inserts)
      }
    } catch (err) {
      log(selection)
      console.log(err)
      log(err)
    }
  }

  // Handle cleanup of missing selections (moved outside loop)
  if (!market.live && existing_market && existing_market.source_market_id) {
    if (use_cache) {
      // For batch mode, just collect the cleanup operation
      const new_selection_ids = selections.map((selection) =>
        selection.source_selection_id.toString()
      )
      cleanup_operations.push({
        source_market_id: existing_market.source_market_id,
        new_selection_ids,
        missing_selection_ids: [] // Will be determined during batch execution
      })
    } else {
      // Legacy mode - execute immediately
      const execute_cleanup = async () => {
        const existing_selections = await db('prop_market_selections_index')
          .where({
            source_market_id: existing_market.source_market_id,
            time_type: 'CLOSE'
          })
          .select('source_selection_id')

        const existing_selection_ids = existing_selections.map(
          (selection) => selection.source_selection_id
        )
        const new_selection_ids = selections.map((selection) =>
          selection.source_selection_id.toString()
        )
        const missing_selection_ids = existing_selection_ids.filter(
          (id) => !new_selection_ids.includes(id)
        )
        if (missing_selection_ids.length) {
          await db('prop_market_selections_index')
            .where({
              source_market_id: existing_market.source_market_id,
              time_type: 'CLOSE'
            })
            .whereIn('source_selection_id', missing_selection_ids)
            .del()
        }
      }
      // Note: This will need to be awaited when called in non-batch mode
      cleanup_operations.push({ execute: execute_cleanup })
    }
  }

  // Return operations for batch mode or results for legacy mode
  if (use_cache) {
    return {
      selection_history_inserts: all_selection_history_inserts,
      selection_index_inserts: all_selection_index_inserts,
      cleanup_operations,
      results
    }
  } else {
    // Legacy mode - need to handle async cleanup
    return { results, cleanup_operations }
  }
}
