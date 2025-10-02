import debug from 'debug'

import db from '#db'
import { chunk_array } from '#libs-shared/chunk.mjs'

const log = debug('selection-result-writer')

/**
 * Write selection results and metric values to database using bulk operations
 *
 * @param {Object} params - Named parameters
 * @param {Array} params.updates - Array of result updates with metric_value
 * @param {boolean} params.dry_run - Preview mode, skip actual writes
 * @returns {Object} Object with selection_count and market_count written
 */
export const write_selection_results_to_db = async ({
  updates,
  dry_run = false
}) => {
  if (dry_run || updates.length === 0) {
    log(`DRY RUN: Would write ${updates.length} selection results`)
    return { selection_count: 0, market_count: 0 }
  }

  log(`Writing ${updates.length} selection results and metric values`)

  // Validate and separate updates by type
  const selection_updates = []
  const market_updates = []
  let skipped = 0

  for (const update of updates) {
    if (
      !update.time_type ||
      !update.source_id ||
      !update.source_market_id ||
      !update.source_selection_id ||
      !update.selection_result
    ) {
      log(
        `Skipping update due to missing required fields: ${JSON.stringify(update)}`
      )
      skipped++
      continue
    }

    selection_updates.push(update)

    // Add to market updates if metric_value is present
    if (update.metric_value !== null && update.metric_value !== undefined) {
      market_updates.push(update)
    }
  }

  if (skipped > 0) {
    log(`Skipped ${skipped} updates due to missing required fields`)
  }

  log(`Processing ${selection_updates.length} selection results`)
  log(`Processing ${market_updates.length} market metric values`)

  let selection_written = 0
  let market_written = 0
  const batch_size = 2000

  await db.transaction(async (trx) => {
    // Update selection results grouped by result value
    const grouped_by_result = {}
    for (const update of selection_updates) {
      const result = update.selection_result
      if (!grouped_by_result[result]) {
        grouped_by_result[result] = []
      }
      grouped_by_result[result].push(update)
    }

    const result_values = Object.keys(grouped_by_result)
    log(`Processing ${result_values.length} distinct selection result values`)

    for (const result_value of result_values) {
      const result_updates = grouped_by_result[result_value]
      const chunks = chunk_array({
        items: result_updates,
        chunk_size: batch_size
      })

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const chunk_number = i + 1

        const bindings = []
        const placeholders = []

        chunk.forEach((update) => {
          if (
            update.source_id &&
            update.source_market_id &&
            update.source_selection_id &&
            update.time_type
          ) {
            placeholders.push('(?, ?, ?, ?)')
            bindings.push(
              update.source_id,
              update.source_market_id,
              update.source_selection_id,
              update.time_type
            )
          }
        })

        if (placeholders.length === 0) {
          continue
        }

        const query = `
          UPDATE prop_market_selections_index
          SET selection_result = ?
          WHERE (source_id, source_market_id, source_selection_id, time_type) IN (
            ${placeholders.join(', ')}
          )
        `

        const result = await trx.raw(query, [result_value, ...bindings])
        const rows_affected = result.rowCount || 0
        selection_written += rows_affected

        log(
          `Updated ${rows_affected} selection rows (chunk ${chunk_number}/${chunks.length})`
        )
      }
    }

    // Update market metric values
    if (market_updates.length > 0) {
      const market_chunks = chunk_array({
        items: market_updates,
        chunk_size: batch_size
      })

      log(
        `Processing ${market_updates.length} market metric values in ${market_chunks.length} chunks`
      )

      for (let i = 0; i < market_chunks.length; i++) {
        const chunk = market_chunks[i]
        const chunk_number = i + 1

        // Build CASE statement for metric_result_value
        const case_parts = []
        const bindings = []
        const where_bindings = []

        chunk.forEach((update) => {
          if (
            update.source_id &&
            update.source_market_id &&
            update.time_type &&
            update.metric_value !== null &&
            update.metric_value !== undefined
          ) {
            case_parts.push(
              'WHEN (source_id = ? AND source_market_id = ? AND time_type = ?) THEN ?'
            )
            bindings.push(
              update.source_id,
              update.source_market_id,
              update.time_type,
              update.metric_value
            )
            where_bindings.push(`(?, ?, ?)`)
          }
        })

        if (case_parts.length === 0) {
          continue
        }

        // Extract WHERE clause bindings
        const where_values = []
        chunk.forEach((update) => {
          if (
            update.source_id &&
            update.source_market_id &&
            update.time_type &&
            update.metric_value !== null &&
            update.metric_value !== undefined
          ) {
            where_values.push(
              update.source_id,
              update.source_market_id,
              update.time_type
            )
          }
        })

        const query = `
          UPDATE prop_markets_index
          SET metric_result_value = (CASE
            ${case_parts.join('\n            ')}
          END)::numeric
          WHERE (source_id, source_market_id, time_type) IN (
            ${where_bindings.join(', ')}
          )
        `

        const result = await trx.raw(query, [...bindings, ...where_values])
        const rows_affected = result.rowCount || 0
        market_written += rows_affected

        log(
          `Updated ${rows_affected} market metric values (chunk ${chunk_number}/${market_chunks.length})`
        )
      }
    }
  })

  log(
    `Successfully wrote ${selection_written} selection results and ${market_written} market metric values`
  )
  return { selection_count: selection_written, market_count: market_written }
}
