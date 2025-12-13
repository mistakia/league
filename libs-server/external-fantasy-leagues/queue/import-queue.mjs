import debug from 'debug'
import db from '#db'
import { SyncOrchestrator } from '#libs-server/external-fantasy-leagues/index.mjs'
import { decrypt_credentials } from '#libs-server/external-fantasy-leagues/utils/credential-encryption.mjs'

const log = debug('external:sync-queue')

/**
 * External League Sync Queue
 * Manages background processing of external fantasy league synchronization jobs.
 * Handles job queuing, execution, progress tracking, and WebSocket notifications.
 */
class ExternalLeagueSyncQueue {
  constructor() {
    this.is_processing = false
    // Map of active jobs: job_id -> { ws, job_data, connection_data, started_at }
    this.active_jobs = new Map()
    this.sync_orchestrator = new SyncOrchestrator()
    this.processor_interval_id = null
    this.processor_interval_ms = 5000 // Check for new jobs every 5 seconds
    this.max_job_duration_ms = 30 * 60 * 1000 // 30 minutes max job duration

    log('ExternalLeagueSyncQueue initialized')

    // Start background job processor
    this.start_job_processor()
  }

  /**
   * Queue a new sync job
   * @param {Object} params - Job parameters
   * @param {WebSocket} params.ws - WebSocket connection for real-time updates
   * @param {string} params.connection_id - External league connection ID
   * @param {string} [params.job_type='full_sync'] - Type of sync job
   * @param {Object} [params.sync_components] - Components to sync (league_config, rosters, transactions)
   * @param {boolean} [params.dry_run=false] - Whether this is a dry run (preview only)
   * @param {number} params.user_id - User initiating the job
   * @returns {Promise<string>} Job ID
   */
  async queue_job({
    ws,
    connection_id,
    job_type = 'full_sync',
    sync_components = {
      league_config: true,
      rosters: true,
      transactions: true
    },
    dry_run = false,
    user_id
  }) {
    try {
      log('Queuing sync job', { connection_id, job_type, user_id, dry_run })

      // Get connection details
      const connection = await db('external_league_connections')
        .where({ connection_id })
        .first()

      if (!connection) {
        throw new Error(`Connection not found: ${connection_id}`)
      }

      // Validate sync_components structure
      const validated_sync_components =
        this._validate_sync_components(sync_components)

      // Create job record
      const [job] = await db('external_league_import_jobs')
        .insert({
          connection_id,
          lid: connection.lid,
          job_type,
          sync_components: JSON.stringify(validated_sync_components),
          dry_run,
          initiated_by: user_id,
          status: 'queued'
        })
        .returning('*')

      const job_id = job.job_id

      // Register WebSocket connection for this job
      this.active_jobs.set(job_id, {
        ws,
        job_data: job,
        connection_data: connection,
        started_at: null
      })

      // Send initial response
      this.send_message_to_client({
        ws,
        type: 'EXTERNAL_LEAGUE_IMPORT_QUEUED',
        payload: {
          job_id,
          status: 'queued',
          position: await this.get_queue_position({ job_id })
        }
      })

      log('Sync job queued successfully', { job_id, connection_id })
      return job_id
    } catch (error) {
      log('Error queuing sync job:', error.message)
      this.send_message_to_client({
        ws,
        type: 'EXTERNAL_LEAGUE_IMPORT_ERROR',
        payload: {
          error: error.message,
          context: 'queue_job'
        }
      })
      throw error
    }
  }

  /**
   * Cancel a sync job
   * @param {Object} params - Parameters object
   * @param {string} params.job_id - Job ID to cancel
   * @param {number} params.user_id - User requesting cancellation
   */
  async cancel_job({ job_id, user_id }) {
    try {
      log('Cancelling sync job', { job_id, user_id })

      const job = await db('external_league_import_jobs')
        .where({ job_id })
        .first()

      if (!job) {
        throw new Error(`Job not found: ${job_id}`)
      }

      if (job.initiated_by !== user_id) {
        throw new Error('Unauthorized to cancel this job')
      }

      if (job.status === 'running') {
        throw new Error('Cannot cancel job that is currently running')
      }

      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        throw new Error(`Job is already ${job.status}`)
      }

      // Update job status
      await db('external_league_import_jobs').where({ job_id }).update({
        status: 'cancelled',
        completed_at: new Date(),
        updated_at: new Date()
      })

      // Notify client and cleanup
      const job_info = this.active_jobs.get(job_id)
      if (job_info) {
        this.send_message_to_client({
          ws: job_info.ws,
          type: 'EXTERNAL_LEAGUE_IMPORT_CANCELLED',
          payload: { job_id }
        })
        this.active_jobs.delete(job_id)
      }

      log('Sync job cancelled successfully', { job_id })
    } catch (error) {
      log('Error cancelling sync job:', error.message)
      throw error
    }
  }

  /**
   * Get current position of job in queue
   * @param {Object} params - Parameters object
   * @param {string} params.job_id - Job ID
   * @returns {Promise<number>} Queue position (1-based)
   */
  async get_queue_position({ job_id }) {
    const queued_jobs = await db('external_league_import_jobs')
      .where({ status: 'queued' })
      .orderBy('queued_at', 'asc')
      .select('job_id')

    const position = queued_jobs.findIndex((job) => job.job_id === job_id) + 1
    return position || 0
  }

  /**
   * Start background job processor
   * Polls database for queued jobs and processes them sequentially
   */
  start_job_processor() {
    if (this.processor_interval_id) {
      log('Job processor already running')
      return
    }

    this.processor_interval_id = setInterval(async () => {
      if (!this.is_processing) {
        await this.process_next_job()
      }
    }, this.processor_interval_ms)

    log('Job processor started', {
      interval_ms: this.processor_interval_ms
    })
  }

  /**
   * Stop background job processor
   */
  stop_job_processor() {
    if (this.processor_interval_id) {
      clearInterval(this.processor_interval_id)
      this.processor_interval_id = null
      log('Job processor stopped')
    }
  }

  /**
   * Process the next job in the queue
   * Uses database function for thread-safe job selection
   */
  async process_next_job() {
    if (this.is_processing) {
      return
    }

    try {
      this.is_processing = true

      // Get next job from database using thread-safe function
      const job_id = await db
        .raw('SELECT get_next_queued_job() as job_id')
        .then((result) => result.rows[0]?.job_id)

      if (!job_id) {
        // No jobs in queue
        return
      }

      log('Processing sync job', { job_id })

      // Get full job details with connection information
      const job = await db('external_league_import_jobs')
        .join(
          'external_league_connections',
          'external_league_import_jobs.connection_id',
          'external_league_connections.connection_id'
        )
        .where('external_league_import_jobs.job_id', job_id)
        .select(
          'external_league_import_jobs.*',
          'external_league_connections.platform',
          'external_league_connections.external_league_id',
          'external_league_connections.credentials_encrypted'
        )
        .first()

      if (!job) {
        log('Job not found after selection, skipping', { job_id })
        return
      }

      // Check for stuck jobs (running for too long)
      await this._check_and_handle_stuck_jobs()

      await this.execute_job(job)
    } catch (error) {
      log('Error in job processor:', error.message, error.stack)
    } finally {
      this.is_processing = false
    }
  }

  /**
   * Execute a sync job
   * @param {Object} job - Job details from database
   */
  async execute_job(job) {
    const job_id = job.job_id
    const job_info = this.active_jobs.get(job_id)

    // Update job info with start time for timeout tracking
    if (job_info) {
      job_info.started_at = new Date()
    }

    try {
      log('Executing sync job', {
        job_id,
        platform: job.platform,
        job_type: job.job_type,
        dry_run: job.dry_run
      })

      // Send start notification
      if (job_info) {
        this.send_message_to_client({
          ws: job_info.ws,
          type: 'EXTERNAL_LEAGUE_IMPORT_STARTED',
          payload: { job_id }
        })
      }

      // Decrypt credentials
      const credentials = decrypt_credentials(job.credentials_encrypted)

      // Parse sync components
      const sync_components = this._parse_sync_components(job.sync_components)

      log('Sync components configuration:', sync_components)

      // Progress callback for real-time updates
      const progress_callback = async (step, progress, details = {}) => {
        await this.update_job_progress({ job_id, progress, step, details })
      }

      // Execute the sync operation
      let result
      if (job.dry_run) {
        // Dry run: fetch data without writing to database
        result = await this.sync_orchestrator.fetch_league_data({
          platform_name: job.platform,
          external_league_id: job.external_league_id,
          credentials,
          fetch_options: { progress_callback }
        })
      } else {
        // Actual sync: fetch and write data to database
        // Note: sync_components are passed but orchestrator currently only respects
        // sync_transactions flag. Full component filtering may be added in future.
        result = await this.sync_orchestrator.sync({
          platform_name: job.platform,
          external_league_id: job.external_league_id,
          internal_league_id: job.lid,
          credentials,
          dry_run: false,
          sync_options: {
            progress_callback,
            sync_transactions: sync_components.transactions !== false,
            // Future: add sync_league_config, sync_rosters flags when orchestrator supports them
            sync_components // Pass through for future use
          }
        })
      }

      // Complete job with results
      await this.complete_job({
        job_id,
        success: result.success,
        result,
        job_info
      })
    } catch (error) {
      log('Sync job execution failed', {
        job_id,
        error: error.message,
        stack: error.stack
      })
      await this.complete_job({
        job_id,
        success: false,
        result: {
          error: error.message,
          error_context: {
            step: 'execution',
            platform: job.platform
          }
        },
        job_info
      })
    } finally {
      // Cleanup job info
      if (job_info) {
        job_info.started_at = null
      }
    }
  }

  /**
   * Update job progress
   * @param {Object} params - Parameters object
   * @param {string} params.job_id - Job ID
   * @param {number} params.progress - Progress percentage (0-100)
   * @param {string} params.step - Current step description
   * @param {Object} [params.details={}] - Additional progress details
   */
  async update_job_progress({ job_id, progress, step, details = {} }) {
    try {
      // Update database
      await db.raw('SELECT update_job_progress(?, ?, ?)', [
        job_id,
        Math.min(100, Math.max(0, progress)),
        step
      ])

      // Send progress update to client
      const job_info = this.active_jobs.get(job_id)
      if (job_info) {
        this.send_message_to_client({
          ws: job_info.ws,
          type: 'EXTERNAL_LEAGUE_IMPORT_PROGRESS',
          payload: {
            job_id,
            progress,
            step,
            details
          }
        })
      }
    } catch (error) {
      log('Error updating job progress:', error.message)
    }
  }

  /**
   * Complete a job
   * @param {Object} params - Parameters object
   * @param {string} params.job_id - Job ID
   * @param {boolean} params.success - Whether job succeeded
   * @param {Object} params.result - Job results
   * @param {Object} params.job_info - Job info from active_jobs
   */
  async complete_job({ job_id, success, result, job_info }) {
    try {
      log('Completing job', { job_id, success })

      // Update database using helper function
      await db.raw('SELECT complete_job(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        job_id,
        success,
        JSON.stringify(result),
        result.error || null,
        result.error_context ? JSON.stringify(result.error_context) : null,
        result.stats?.total_players || 0,
        result.validation?.players_failed || 0,
        result.stats?.total_rosters || 0,
        result.stats?.total_transactions || 0,
        result.validation?.transactions_invalid || 0
      ])

      // Send completion notification to client
      if (job_info) {
        this.send_message_to_client({
          ws: job_info.ws,
          type: success
            ? 'EXTERNAL_LEAGUE_IMPORT_COMPLETED'
            : 'EXTERNAL_LEAGUE_IMPORT_FAILED',
          payload: {
            job_id,
            result: {
              success,
              stats: result.stats || {},
              validation: result.validation || {},
              errors: result.errors || [],
              metadata: result.metadata || {}
            }
          }
        })

        // Clean up active job
        this.active_jobs.delete(job_id)
      }
    } catch (error) {
      log('Error completing job:', error.message)
    }
  }

  /**
   * Get job status and details
   * @param {Object} params - Parameters object
   * @param {string} params.job_id - Job ID
   * @returns {Promise<Object>} Job status
   */
  async get_job_status({ job_id }) {
    const job = await db('external_league_import_jobs')
      .where({ job_id })
      .first()

    if (!job) {
      throw new Error(`Job not found: ${job_id}`)
    }

    const status = {
      job_id,
      status: job.status,
      progress: job.progress_percentage,
      current_step: job.current_step,
      queued_at: job.queued_at,
      started_at: job.started_at,
      completed_at: job.completed_at
    }

    if (job.status === 'queued') {
      status.queue_position = await this.get_queue_position({ job_id })
    }

    if (job.status === 'completed' || job.status === 'failed') {
      status.results = job.results
      if (job.players_mapped !== undefined) {
        status.stats = {
          players_mapped: job.players_mapped,
          players_failed: job.players_failed,
          rosters_updated: job.rosters_updated,
          transactions_imported: job.transactions_imported,
          transactions_failed: job.transactions_failed
        }
      }
    }

    return status
  }

  /**
   * Remove client connection when WebSocket disconnects
   * @param {Object} params - Parameters object
   * @param {string} params.client_id - WebSocket client ID
   */
  remove_client({ client_id }) {
    log('Removing client connection', { client_id })

    const removed_jobs = []
    for (const [job_id, job_info] of this.active_jobs.entries()) {
      if (job_info.ws?.client_id === client_id) {
        this.active_jobs.delete(job_id)
        removed_jobs.push(job_id)
      }
    }

    if (removed_jobs.length > 0) {
      log('Removed jobs from active connections', {
        client_id,
        job_ids: removed_jobs
      })
    }
  }

  /**
   * Clean up stale WebSocket connections
   * Removes jobs with closed or invalid WebSocket connections
   */
  cleanup_stale_connections() {
    const stale_jobs = []
    for (const [job_id, job_info] of this.active_jobs.entries()) {
      const ws = job_info.ws
      // Check if WebSocket is closed or invalid
      if (
        !ws ||
        ws.readyState === 2 || // CLOSING
        ws.readyState === 3 // CLOSED
      ) {
        this.active_jobs.delete(job_id)
        stale_jobs.push(job_id)
      }
    }

    if (stale_jobs.length > 0) {
      log('Cleaned up stale WebSocket connections', {
        stale_job_count: stale_jobs.length,
        job_ids: stale_jobs
      })
    }

    return stale_jobs.length
  }

  /**
   * Send message to WebSocket client
   * @param {Object} params - Message parameters
   * @param {WebSocket} params.ws - WebSocket connection
   * @param {string} params.type - Message type
   * @param {Object} params.payload - Message payload
   */
  send_message_to_client({ ws, type, payload }) {
    if (ws && ws.readyState === 1) {
      // WebSocket.OPEN
      try {
        ws.send(JSON.stringify({ type, payload }))
      } catch (error) {
        log('Error sending message to client:', error.message)
      }
    }
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue statistics
   */
  async get_queue_stats() {
    const stats = await db('external_league_import_jobs')
      .select('status')
      .count('* as count')
      .groupBy('status')

    const result = {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    }

    stats.forEach((stat) => {
      result[stat.status] = parseInt(stat.count)
    })

    result.active_connections = this.active_jobs.size
    result.is_processing = this.is_processing

    return result
  }

  /**
   * Validate sync components structure
   * @param {Object} sync_components - Sync components to validate
   * @returns {Object} Validated sync components with defaults
   * @private
   */
  _validate_sync_components(sync_components) {
    if (!sync_components || typeof sync_components !== 'object') {
      return {
        league_config: true,
        rosters: true,
        transactions: true
      }
    }

    return {
      league_config:
        sync_components.league_config !== false &&
        sync_components.league_config !== undefined,
      rosters:
        sync_components.rosters !== false &&
        sync_components.rosters !== undefined,
      transactions:
        sync_components.transactions !== false &&
        sync_components.transactions !== undefined
    }
  }

  /**
   * Parse sync components from database (handles string or object)
   * @param {string|Object} sync_components - Sync components from database
   * @returns {Object} Parsed sync components
   * @private
   */
  _parse_sync_components(sync_components) {
    if (!sync_components) {
      return {
        league_config: true,
        rosters: true,
        transactions: true
      }
    }

    try {
      return typeof sync_components === 'string'
        ? JSON.parse(sync_components)
        : sync_components
    } catch (parse_error) {
      log('Error parsing sync_components, using defaults', {
        error: parse_error.message
      })
      return {
        league_config: true,
        rosters: true,
        transactions: true
      }
    }
  }

  /**
   * Check for and handle stuck jobs (running for too long)
   * @returns {Promise<number>} Number of stuck jobs found
   * @private
   */
  async _check_and_handle_stuck_jobs() {
    const stuck_threshold = new Date(Date.now() - this.max_job_duration_ms)

    const stuck_jobs = await db('external_league_import_jobs')
      .where({ status: 'running' })
      .where('started_at', '<', stuck_threshold)
      .select('job_id', 'started_at')

    if (stuck_jobs.length > 0) {
      log('Found stuck jobs, marking as failed', {
        stuck_count: stuck_jobs.length,
        job_ids: stuck_jobs.map((j) => j.job_id)
      })

      for (const stuck_job of stuck_jobs) {
        await db('external_league_import_jobs')
          .where({ job_id: stuck_job.job_id })
          .update({
            status: 'failed',
            completed_at: new Date(),
            error_message:
              'Job exceeded maximum duration and was marked as failed',
            updated_at: new Date()
          })

        // Clean up active job tracking
        this.active_jobs.delete(stuck_job.job_id)
      }
    }

    return stuck_jobs.length
  }
}

// Singleton instance
const sync_queue = new ExternalLeagueSyncQueue()

export default sync_queue
