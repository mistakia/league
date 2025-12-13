import debug from 'debug'

import db from '#db'
import { TransactionMapper } from '../mappers/index.mjs'
import SyncUtils from './sync-utils.mjs'

const log = debug('external:transaction-sync')

/**
 * Transaction sync module
 * Handles syncing transaction data from external platforms
 *
 * Responsibilities:
 * - Fetch transaction data from external platform
 * - Map external transactions to internal transaction format
 * - Insert transactions into database with duplicate handling
 * - Track transaction import statistics
 *
 * Note: Transaction sync failures are non-fatal (errors are logged but don't stop sync)
 */
export class TransactionSync {
  constructor() {
    this.transaction_mapper = new TransactionMapper()
    this.sync_utils = new SyncUtils()
  }

  /**
   * Sync transactions from external platform
   * @param {Object} options - Transaction sync options
   * @param {Object} options.adapter - Platform adapter instance
   * @param {Object} options.sync_context - Sync context with league and platform info
   * @param {Object} [options.sync_options] - Additional sync options
   * @param {Object} options.sync_stats - Sync statistics object
   * @param {Function} [options.progress_callback] - Optional progress reporting callback
   * @param {Array} [options.sync_stats_errors] - Array to collect sync errors
   * @returns {Promise<Object>} Transaction sync results
   */
  async sync_transactions({
    adapter,
    sync_context,
    sync_options = {},
    sync_stats,
    progress_callback = null,
    sync_stats_errors = []
  }) {
    try {
      log(`Syncing transactions for ${sync_context.platform}`)

      const external_transactions = await adapter.get_transactions({
        league_id: sync_context.external_league_id,
        options: {
          week: sync_context.week,
          year: sync_context.year,
          limit: sync_options.transaction_limit || 100
        }
      })

      if (progress_callback) {
        await progress_callback('Retrieved transaction data', 75, {
          step: 'transactions',
          transaction_count: external_transactions?.length || 0
        })
      }

      await this._process_transactions({
        external_transactions,
        sync_context,
        progress_callback,
        sync_stats,
        sync_stats_errors
      })

      if (progress_callback) {
        await progress_callback('Transactions synchronized', 95, {
          step: 'transactions',
          transactions_processed: external_transactions?.length || 0,
          transactions_imported: sync_stats.transactions_imported
        })
      }

      log(`Imported ${sync_stats.transactions_imported} transactions`)

      return {
        success: true,
        transactions_processed: external_transactions?.length || 0,
        transactions_imported: sync_stats.transactions_imported
      }
    } catch (error) {
      log(`Error syncing transactions: ${error.message}`)
      const sync_error = this.sync_utils.create_sync_error({
        error_type: 'transaction_sync_failure',
        error_message: error.message,
        step: 'sync_transactions',
        context_data: {
          platform: sync_context.platform,
          external_league_id: sync_context.external_league_id,
          week: sync_context.week
        }
      })
      sync_stats_errors.push(sync_error)
      // Don't throw - transactions are optional
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Process transactions
   * @param {Object} options - Transaction processing options
   * @param {Array} options.external_transactions - Array of external transaction data
   * @param {Object} options.sync_context - Sync context
   * @param {Function} [options.progress_callback] - Optional progress reporting callback
   * @param {Object} options.sync_stats - Sync statistics object
   * @param {Array} options.sync_stats_errors - Array to collect sync errors
   * @returns {Promise<Object>} Processing results
   * @private
   */
  async _process_transactions({
    external_transactions,
    sync_context,
    progress_callback = null,
    sync_stats,
    sync_stats_errors
  }) {
    const transactions = external_transactions || []
    let processed_transactions = 0

    for (const external_transaction of transactions) {
      try {
        if (progress_callback && transactions.length > 0) {
          const transaction_progress =
            75 + (processed_transactions / transactions.length) * 18 // 75-93%
          await progress_callback(
            `Processing transaction ${processed_transactions + 1}/${transactions.length}`,
            Math.round(transaction_progress),
            {
              step: 'transactions',
              transaction_type: external_transaction.type,
              processed: processed_transactions,
              total: transactions.length
            }
          )
        }

        // Map transaction to internal format
        const mapped_transaction = this.transaction_mapper.map_transaction({
          platform: sync_context.platform,
          external_transaction,
          context: {
            league_id: sync_context.internal_league_id,
            year: sync_context.year,
            week: sync_context.week,
            player_mappings: sync_context.player_mappings,
            team_mappings: sync_context.team_mappings,
            user_mappings: sync_context.user_mappings
          }
        })

        if (mapped_transaction) {
          await this._insert_transaction({
            transaction: mapped_transaction,
            sync_stats,
            sync_stats_errors
          })
        } else {
          // Transaction was skipped or invalid (already logged by mapper)
          log(
            `Skipped transaction: ${external_transaction.transaction_id || external_transaction.id || 'unknown'}`
          )
        }

        processed_transactions++
      } catch (error) {
        log(`Error processing transaction: ${error.message}`)
        const sync_error = this.sync_utils.create_sync_error({
          error_type: 'transaction_processing_failure',
          error_message: error.message,
          step: 'process_transaction',
          context_data: {
            transaction_id:
              external_transaction.transaction_id ||
              external_transaction.id ||
              'unknown',
            transaction_type: external_transaction.type
          }
        })
        sync_stats_errors.push(sync_error)
        processed_transactions++
      }
    }

    return {
      processed: processed_transactions,
      imported: sync_stats.transactions_imported
    }
  }

  /**
   * Insert transaction into database with conflict handling
   * @param {Object} options - Transaction insertion options
   * @param {Object} options.transaction - Mapped transaction data
   * @param {Object} options.sync_stats - Sync statistics object
   * @param {Array} options.sync_stats_errors - Array to collect sync errors
   * @returns {Promise<void>}
   * @private
   */
  async _insert_transaction({ transaction, sync_stats, sync_stats_errors }) {
    try {
      await db('transactions').insert(transaction)
      sync_stats.transactions_imported++
    } catch (error) {
      if (error.code === '23505') {
        // Duplicate key error
        log(`Transaction already exists, skipping`)
      } else {
        log(`Error inserting transaction: ${error.message}`)
        const sync_error = this.sync_utils.create_sync_error({
          error_type: 'transaction_insert_failure',
          error_message: error.message,
          step: 'insert_transaction',
          context_data: {
            transaction_id: transaction.transaction_id || transaction.id,
            transaction_type: transaction.type
          }
        })
        sync_stats_errors.push(sync_error)
      }
    }
  }
}

export default TransactionSync
