import debug from 'debug'

import db from '#db'
import { chunk_array } from '#libs-shared/chunk.mjs'

const log = debug('selection-result-writer')

/**
 * Write selection results and metric values to database using bulk operations
 *
 * Writes both selection_result and metric_result_value to prop_market_selections_index.
 * metric_result_value is stored per-selection to support multi-selection markets
 * (e.g., ANYTIME_TOUCHDOWN) where each player has a different actual result.
 *
 * @param {Object} params - Named parameters
 * @param {Array} params.updates - Array of result updates with metric_value
 * @param {boolean} params.dry_run - Preview mode, skip actual writes
 * @returns {Object} Object with selection_count written
 */
export const write_selection_results_to_db = async ({
  updates,
  dry_run = false
}) => {
  if (dry_run || updates.length === 0) {
    log(`DRY RUN: Would write ${updates.length} selection results`)
    return { selection_count: 0 }
  }

  log(`Writing ${updates.length} selection results and metric values`)

  const selection_updates = []
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
  }

  if (skipped > 0) {
    log(`Skipped ${skipped} updates due to missing required fields`)
  }

  log(`Processing ${selection_updates.length} selection results`)

  let selection_written = 0
  const batch_size = 2000

  await db.transaction(async (trx) => {
    const chunks = chunk_array({
      items: selection_updates,
      chunk_size: batch_size
    })

    log(
      `Processing ${selection_updates.length} selections in ${chunks.length} chunks`
    )

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunk_number = i + 1

      // Build CASE statements for selection_result and metric_result_value
      // IMPORTANT: Keep bindings separate - PostgreSQL processes all placeholders
      // for the first CASE, then all for the second CASE sequentially
      const result_case_parts = []
      const metric_case_parts = []
      const result_bindings = []
      const metric_bindings = []
      const where_bindings = []
      const where_values = []

      chunk.forEach((update) => {
        if (
          update.source_id &&
          update.source_market_id &&
          update.source_selection_id &&
          update.time_type
        ) {
          // Add CASE for selection_result
          result_case_parts.push(
            'WHEN (source_id = ? AND source_market_id = ? AND source_selection_id = ? AND time_type = ?) THEN ?'
          )
          result_bindings.push(
            update.source_id,
            update.source_market_id,
            update.source_selection_id,
            update.time_type,
            update.selection_result
          )

          // Add CASE for metric_result_value (can be null)
          metric_case_parts.push(
            'WHEN (source_id = ? AND source_market_id = ? AND source_selection_id = ? AND time_type = ?) THEN ?'
          )
          metric_bindings.push(
            update.source_id,
            update.source_market_id,
            update.source_selection_id,
            update.time_type,
            update.metric_value !== null && update.metric_value !== undefined
              ? update.metric_value
              : null
          )

          where_bindings.push('(?, ?, ?, ?)')
          where_values.push(
            update.source_id,
            update.source_market_id,
            update.source_selection_id,
            update.time_type
          )
        }
      })

      if (result_case_parts.length === 0) {
        continue
      }

      const query = `
        UPDATE prop_market_selections_index
        SET selection_result = (CASE
          ${result_case_parts.join('\n          ')}
        END)::wager_status,
        metric_result_value = (CASE
          ${metric_case_parts.join('\n          ')}
        END)::numeric
        WHERE (source_id, source_market_id, source_selection_id, time_type) IN (
          ${where_bindings.join(', ')}
        )
      `

      const result = await trx.raw(query, [
        ...result_bindings,
        ...metric_bindings,
        ...where_values
      ])
      const rows_affected = result.rowCount || 0
      selection_written += rows_affected

      log(
        `Updated ${rows_affected} selection rows (chunk ${chunk_number}/${chunks.length})`
      )
    }
  })

  log(
    `Successfully wrote ${selection_written} selection results with metric values`
  )
  return { selection_count: selection_written }
}
