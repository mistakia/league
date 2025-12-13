import debug from 'debug'

const log = debug('external:progress-reporter')

/**
 * Progress reporting module
 * Handles standardized progress reporting for sync operations
 */
export class ProgressReporter {
  constructor() {
    // Progress step definitions with expected progress ranges
    this.progress_steps = {
      validation: { start: 0, end: 5 },
      adapter_init: { start: 5, end: 10 },
      fetch_config: { start: 10, end: 15 },
      league_config: { start: 15, end: 23 },
      teams: { start: 25, end: 38 },
      rosters: { start: 40, end: 68 },
      transactions: { start: 70, end: 95 },
      completed: { start: 100, end: 100 }
    }
  }

  /**
   * Create a standardized progress callback with default behavior
   * @param {Object} options - Progress callback options
   * @param {Function} [options.callback] - Custom progress callback function
   * @param {boolean} [options.enable_logging] - Enable debug logging
   * @returns {Function} Progress callback function
   */
  create_progress_callback({ callback = null, enable_logging = true }) {
    return async (message, progress_percentage, context_data = {}) => {
      if (enable_logging) {
        log(`Progress: ${progress_percentage}% - ${message}`)
      }

      if (callback && typeof callback === 'function') {
        await callback(message, progress_percentage, context_data)
      }
    }
  }

  /**
   * Report validation step progress
   * @param {Object} options - Validation progress options
   * @param {Function} options.progress_callback - Progress callback function
   * @param {string} [options.status] - Validation status
   * @param {Array} [options.validation_errors] - Validation errors if any
   * @returns {Promise<void>}
   */
  async report_validation_progress({
    progress_callback,
    status = 'validating',
    validation_errors = []
  }) {
    if (status === 'validating') {
      await progress_callback('Validating parameters', 5, {
        step: 'validation'
      })
    } else if (status === 'failed') {
      await progress_callback('Validation failed', 0, {
        step: 'error',
        errors: validation_errors
      })
    }
  }

  /**
   * Report adapter initialization progress
   * @param {Object} options - Adapter initialization progress options
   * @param {Function} options.progress_callback - Progress callback function
   * @param {string} options.platform_name - Platform identifier
   * @param {string} [options.status] - Initialization status
   * @returns {Promise<void>}
   */
  async report_adapter_init_progress({
    progress_callback,
    platform_name,
    status = 'initializing'
  }) {
    if (status === 'initializing') {
      await progress_callback('Initializing adapter', 10, {
        step: 'adapter_init'
      })
    } else if (status === 'authenticating') {
      await progress_callback('Authenticating with platform', 10, {
        platform: platform_name
      })
    }
  }

  /**
   * Report data fetching progress
   * @param {Object} options - Data fetching progress options
   * @param {Function} options.progress_callback - Progress callback function
   * @param {string} options.data_type - Type of data being fetched
   * @param {number} [options.progress_percentage] - Current progress percentage
   * @param {Object} [options.context_data] - Additional context data
   * @returns {Promise<void>}
   */
  async report_fetch_progress({
    progress_callback,
    data_type,
    progress_percentage = 15,
    context_data = {}
  }) {
    const message_map = {
      config: 'Fetching league configuration',
      users: 'Fetching user data',
      complete: 'Retrieved league data'
    }

    const message = message_map[data_type] || `Fetching ${data_type} data`

    await progress_callback(message, progress_percentage, {
      step: `fetch_${data_type}`,
      ...context_data
    })
  }

  /**
   * Report sync completion progress
   * @param {Object} options - Completion progress options
   * @param {Function} options.progress_callback - Progress callback function
   * @param {string} [options.status] - Completion status
   * @param {Object} [options.sync_stats] - Final sync statistics
   * @param {Object} [options.validation_results] - Validation results
   * @param {string} [options.error_message] - Error message if failed
   * @returns {Promise<void>}
   */
  async report_completion_progress({
    progress_callback,
    status = 'success',
    sync_stats = {},
    validation_results = {},
    error_message = null
  }) {
    if (status === 'success') {
      await progress_callback('Sync completed successfully', 100, {
        step: 'completed',
        stats: sync_stats,
        validation_results
      })
    } else if (status === 'fetch_complete') {
      await progress_callback('Fetch completed successfully', 100, {
        step: 'completed',
        validation_results
      })
    } else if (status === 'error') {
      await progress_callback('Sync failed', 0, {
        step: 'error',
        error: error_message
      })
    }
  }

  /**
   * Calculate progress percentage within a step range
   * @param {Object} options - Progress calculation options
   * @param {string} options.step_name - Name of the progress step
   * @param {number} options.current_item - Current item index (0-based)
   * @param {number} options.total_items - Total number of items
   * @returns {number} Calculated progress percentage
   */
  calculate_step_progress({ step_name, current_item, total_items }) {
    const step = this.progress_steps[step_name]
    if (!step || total_items === 0) {
      return step?.start || 0
    }

    const step_range = step.end - step.start
    const item_progress = current_item / total_items

    return Math.round(step.start + item_progress * step_range)
  }

  /**
   * Create a step-specific progress reporter
   * @param {Object} options - Step progress reporter options
   * @param {Function} options.progress_callback - Main progress callback
   * @param {string} options.step_name - Name of the step
   * @param {number} options.total_items - Total items to process
   * @param {string} options.item_type - Type of items being processed
   * @returns {Function} Step-specific progress reporter function
   */
  create_step_progress_reporter({
    progress_callback,
    step_name,
    total_items,
    item_type
  }) {
    return async (current_item, item_context = {}) => {
      const progress_percentage = this.calculate_step_progress({
        step_name,
        current_item,
        total_items
      })

      const message = `Processing ${item_type} ${current_item + 1}/${total_items}`

      await progress_callback(message, progress_percentage, {
        step: step_name,
        processed: current_item,
        total: total_items,
        ...item_context
      })
    }
  }
}

export default ProgressReporter
