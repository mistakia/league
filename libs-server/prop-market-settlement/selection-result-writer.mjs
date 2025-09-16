import debug from 'debug'

import db from '#db'
import { chunk_array } from '#libs-shared/chunk.mjs'

const log = debug('selection-result-writer')

/**
 * Write selection results to database using bulk operations grouped by result value
 *
 * @param {Object} params - Named parameters
 * @param {Array} params.updates - Array of result updates
 * @param {boolean} params.dry_run - Preview mode, skip actual writes
 * @returns {number} Number of records written
 */
export const write_selection_results_to_db = async ({
  updates,
  dry_run = false
}) => {
  if (dry_run || updates.length === 0) {
    log(`DRY RUN: Would write ${updates.length} selection results`)
    return 0
  }

  log(`Writing ${updates.length} selection results`)

  // Validate and group updates by result value
  const grouped_by_result = {}
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

    const result = update.selection_result
    if (!grouped_by_result[result]) {
      grouped_by_result[result] = []
    }
    grouped_by_result[result].push(update)
  }

  if (skipped > 0) {
    log(`Skipped ${skipped} updates due to missing required fields`)
  }

  const result_values = Object.keys(grouped_by_result)
  log(`Processing ${result_values.length} distinct result values`)

  let written = 0
  const batch_size = 2000

  await db.transaction(async (trx) => {
    for (const result_value of result_values) {
      const result_updates = grouped_by_result[result_value]
      const chunks = chunk_array({
        items: result_updates,
        chunk_size: batch_size
      })

      log(
        `Processing result '${result_value}': ${result_updates.length} updates in ${chunks.length} chunks`
      )

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const chunk_number = i + 1

        // Build parameter bindings and placeholders
        const bindings = []
        const placeholders = []

        chunk.forEach((update) => {
          // Double-check all required fields are present
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
          log(
            `No valid records in chunk ${chunk_number} for result '${result_value}'`
          )
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
        written += rows_affected

        log(
          `Updated ${rows_affected} rows with result '${result_value}' (chunk ${chunk_number}/${chunks.length})`
        )
      }
    }
  })

  log(`Successfully wrote ${written} selection results`)
  return written
}
