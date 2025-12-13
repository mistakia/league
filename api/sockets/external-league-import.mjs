import debug from 'debug'
import db from '#db'
import sync_queue from '#libs-server/external-fantasy-leagues/queue/import-queue.mjs'
import { SyncOrchestrator } from '#libs-server/external-fantasy-leagues/index.mjs'
import {
  send_websocket_message,
  validate_required_fields,
  create_error_payload
} from './utils.mjs'

const log = debug('external-league-import-socket')

/**
 * WebSocket message types for external league sync operations
 * Note: Outgoing message types match those used by import-queue.mjs
 */
export const MESSAGE_TYPES = {
  // Client-to-server messages (incoming)
  QUEUE_SYNC_JOB: 'QUEUE_SYNC_JOB',
  CANCEL_SYNC_JOB: 'CANCEL_SYNC_JOB',
  GET_JOB_STATUS: 'GET_JOB_STATUS',
  GET_QUEUE_STATS: 'GET_QUEUE_STATS',
  GET_CONNECTION_STATUS: 'GET_CONNECTION_STATUS',
  VALIDATE_CONNECTION: 'VALIDATE_CONNECTION',
  SUBSCRIBE_TO_JOB: 'SUBSCRIBE_TO_JOB',
  UNSUBSCRIBE_FROM_JOB: 'UNSUBSCRIBE_FROM_JOB',

  // Server-to-client messages (outgoing)
  // These match the types used by import-queue.mjs
  EXTERNAL_LEAGUE_IMPORT_QUEUED: 'EXTERNAL_LEAGUE_IMPORT_QUEUED',
  EXTERNAL_LEAGUE_IMPORT_STARTED: 'EXTERNAL_LEAGUE_IMPORT_STARTED',
  EXTERNAL_LEAGUE_IMPORT_PROGRESS: 'EXTERNAL_LEAGUE_IMPORT_PROGRESS',
  EXTERNAL_LEAGUE_IMPORT_COMPLETED: 'EXTERNAL_LEAGUE_IMPORT_COMPLETED',
  EXTERNAL_LEAGUE_IMPORT_FAILED: 'EXTERNAL_LEAGUE_IMPORT_FAILED',
  EXTERNAL_LEAGUE_IMPORT_CANCELLED: 'EXTERNAL_LEAGUE_IMPORT_CANCELLED',
  EXTERNAL_LEAGUE_IMPORT_ERROR: 'EXTERNAL_LEAGUE_IMPORT_ERROR',
  EXTERNAL_LEAGUE_IMPORT_STATUS: 'EXTERNAL_LEAGUE_IMPORT_STATUS',
  EXTERNAL_LEAGUE_IMPORT_QUEUE_STATS: 'EXTERNAL_LEAGUE_IMPORT_QUEUE_STATS',
  EXTERNAL_LEAGUE_CONNECTION_STATUS: 'EXTERNAL_LEAGUE_CONNECTION_STATUS',
  EXTERNAL_LEAGUE_CONNECTION_VALIDATED: 'EXTERNAL_LEAGUE_CONNECTION_VALIDATED',
  EXTERNAL_LEAGUE_CONNECTION_INVALID: 'EXTERNAL_LEAGUE_CONNECTION_INVALID',
  EXTERNAL_LEAGUE_JOB_SUBSCRIBED: 'EXTERNAL_LEAGUE_JOB_SUBSCRIBED',
  EXTERNAL_LEAGUE_JOB_UNSUBSCRIBED: 'EXTERNAL_LEAGUE_JOB_UNSUBSCRIBED'
}

/**
 * Map of job_id -> Set of WebSocket connections subscribed to that job
 * Used for broadcasting job updates to multiple subscribers
 */
const job_subscriptions = new Map()

/**
 * Progress step types for detailed progress reporting
 * These match the step names used by the sync orchestrator
 */
export const PROGRESS_STEPS = {
  INITIALIZING: 'initializing',
  AUTHENTICATING: 'authenticating',
  FETCHING_CONFIG: 'fetching_config',
  FETCHING_TEAMS: 'fetching_teams',
  FETCHING_ROSTERS: 'fetching_rosters',
  FETCHING_TRANSACTIONS: 'fetching_transactions',
  PROCESSING_CONFIG: 'processing_config',
  PROCESSING_TEAMS: 'processing_teams',
  PROCESSING_ROSTERS: 'processing_rosters',
  PROCESSING_TRANSACTIONS: 'processing_transactions',
  SAVING_DATA: 'saving_data',
  COMPLETED: 'completed',
  ERROR: 'error'
}

/**
 * Job status constants matching database enum values
 */
export const JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/**
 * WebSocket handler for external league sync operations
 * Routes incoming messages to appropriate handlers
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} message - Parsed message object with type and payload
 */
export default function handle_external_league_import_socket(ws, message) {
  const { type, payload } = message

  // Message handler registry - defined here after all handlers are declared
  const MESSAGE_HANDLERS = {
    [MESSAGE_TYPES.QUEUE_SYNC_JOB]: handle_queue_sync_job,
    [MESSAGE_TYPES.CANCEL_SYNC_JOB]: handle_cancel_sync_job,
    [MESSAGE_TYPES.GET_JOB_STATUS]: handle_get_job_status,
    [MESSAGE_TYPES.GET_QUEUE_STATS]: handle_get_queue_stats,
    [MESSAGE_TYPES.GET_CONNECTION_STATUS]: handle_get_connection_status,
    [MESSAGE_TYPES.VALIDATE_CONNECTION]: handle_validate_connection,
    [MESSAGE_TYPES.SUBSCRIBE_TO_JOB]: handle_subscribe_to_job,
    [MESSAGE_TYPES.UNSUBSCRIBE_FROM_JOB]: handle_unsubscribe_from_job
  }

  const handler = MESSAGE_HANDLERS[type]
  if (handler) {
    return handler(ws, payload)
  }

  // Unknown message type
  log('Unknown message type:', type)
  send_error_message(
    ws,
    `Unknown message type: ${type}`,
    'unknown_message_type'
  )
}

/**
 * Handle sync job queuing request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {string} payload.connection_id - External league connection ID
 * @param {string} [payload.job_type='full_sync'] - Type of sync job
 * @param {Object} [payload.sync_components] - Components to sync
 * @param {boolean} [payload.dry_run=false] - Whether this is a dry run
 * @param {number} payload.user_id - User initiating the job
 */
async function handle_queue_sync_job(ws, payload) {
  try {
    const validation = validate_required_fields(payload, [
      'connection_id',
      'user_id'
    ])
    if (!validation.valid) {
      throw new Error(
        `Missing required fields: ${validation.missing.join(', ')}`
      )
    }

    const {
      connection_id,
      job_type = 'full_sync',
      sync_components = {
        league_config: true,
        rosters: true,
        transactions: true
      },
      dry_run = false,
      user_id
    } = payload

    const job_id = await sync_queue.queue_job({
      ws,
      connection_id,
      job_type,
      sync_components,
      dry_run,
      user_id
    })

    log('Sync job queued via WebSocket', { job_id, connection_id, user_id })
  } catch (error) {
    log('Error queuing sync job via WebSocket:', error.message)
    send_error_message(ws, error.message, 'queue_sync_job')
  }
}

/**
 * Handle sync job cancellation request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {string} payload.job_id - Job ID to cancel
 * @param {number} payload.user_id - User requesting cancellation
 */
async function handle_cancel_sync_job(ws, payload) {
  try {
    const validation = validate_required_fields(payload, ['job_id', 'user_id'])
    if (!validation.valid) {
      throw new Error(
        `Missing required fields: ${validation.missing.join(', ')}`
      )
    }

    const { job_id, user_id } = payload

    await sync_queue.cancel_job({ job_id, user_id })

    // The queue will send the cancellation message, but we also send here
    // for immediate feedback if the queue hasn't processed it yet
    send_message(ws, MESSAGE_TYPES.EXTERNAL_LEAGUE_IMPORT_CANCELLED, {
      job_id
    })

    log('Sync job cancelled via WebSocket', { job_id, user_id })
  } catch (error) {
    log('Error cancelling sync job via WebSocket:', error.message)
    send_error_message(ws, error.message, 'cancel_sync_job')
  }
}

/**
 * Handle job status request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {string} payload.job_id - Job ID to get status for
 */
async function handle_get_job_status(ws, payload) {
  try {
    const validation = validate_required_fields(payload, ['job_id'])
    if (!validation.valid) {
      throw new Error(
        `Missing required fields: ${validation.missing.join(', ')}`
      )
    }

    const { job_id } = payload

    const status = await sync_queue.get_job_status({ job_id })

    send_message(ws, MESSAGE_TYPES.EXTERNAL_LEAGUE_IMPORT_STATUS, {
      job_id,
      status
    })
  } catch (error) {
    log('Error getting job status via WebSocket:', error.message)
    send_error_message(ws, error.message, 'get_job_status')
  }
}

/**
 * Handle queue statistics request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} _payload - Request payload (unused)
 */
async function handle_get_queue_stats(ws, _payload) {
  try {
    const stats = await sync_queue.get_queue_stats()

    send_message(ws, MESSAGE_TYPES.EXTERNAL_LEAGUE_IMPORT_QUEUE_STATS, {
      stats
    })
  } catch (error) {
    log('Error getting queue stats via WebSocket:', error.message)
    send_error_message(ws, error.message, 'get_queue_stats')
  }
}

/**
 * Handle connection status request
 * Retrieves connection details and sync history from database
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {string} payload.connection_id - Connection ID to get status for
 */
async function handle_get_connection_status(ws, payload) {
  try {
    const validation = validate_required_fields(payload, ['connection_id'])
    if (!validation.valid) {
      throw new Error(
        `Missing required fields: ${validation.missing.join(', ')}`
      )
    }

    const { connection_id } = payload

    // Get connection details from database
    const connection = await db('external_league_connections')
      .where({ connection_id })
      .select(
        'connection_id',
        'platform',
        'external_league_id',
        'connection_name',
        'status',
        'last_sync',
        'last_validated',
        'auto_sync_enabled',
        'created_at'
      )
      .first()

    if (!connection) {
      throw new Error(`Connection not found: ${connection_id}`)
    }

    // Get sync job statistics for this connection
    const job_stats = await db('external_league_import_jobs')
      .where({ connection_id })
      .select(
        db.raw('COUNT(*) as total_jobs'),
        db.raw(
          "COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs"
        ),
        db.raw("COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs"),
        db.raw(
          "COUNT(*) FILTER (WHERE status IN ('queued', 'running')) as active_jobs"
        ),
        db.raw('MAX(completed_at) as last_completed_sync')
      )
      .first()

    const connection_status = {
      connection_id: connection.connection_id,
      platform: connection.platform,
      external_league_id: connection.external_league_id,
      display_name: connection.connection_name,
      is_active: connection.status === 'active',
      last_sync_at: connection.last_sync,
      last_validated_at: connection.last_validated,
      auto_sync_enabled: connection.auto_sync_enabled,
      created_at: connection.created_at,
      sync_statistics: {
        total_jobs: parseInt(job_stats?.total_jobs || 0),
        completed_jobs: parseInt(job_stats?.completed_jobs || 0),
        failed_jobs: parseInt(job_stats?.failed_jobs || 0),
        active_jobs: parseInt(job_stats?.active_jobs || 0),
        last_completed_sync: job_stats?.last_completed_sync
      }
    }

    send_message(ws, MESSAGE_TYPES.EXTERNAL_LEAGUE_CONNECTION_STATUS, {
      connection_status
    })
  } catch (error) {
    log('Error getting connection status via WebSocket:', error.message)
    send_error_message(ws, error.message, 'get_connection_status')
  }
}

/**
 * Handle connection validation request
 * Tests credentials and connectivity without importing data
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {string} payload.platform - Platform identifier
 * @param {string} payload.external_league_id - External league ID
 * @param {Object} [payload.credentials={}] - Platform authentication credentials
 */
async function handle_validate_connection(ws, payload) {
  try {
    const validation = validate_required_fields(payload, [
      'platform',
      'external_league_id'
    ])
    if (!validation.valid) {
      throw new Error(
        `Missing required fields: ${validation.missing.join(', ')}`
      )
    }

    const { platform, external_league_id, credentials = {} } = payload

    const orchestrator = new SyncOrchestrator()
    const result = await orchestrator.fetch_league_data({
      platform_name: platform,
      external_league_id,
      credentials,
      fetch_options: { validate_only: true }
    })

    if (result.success) {
      const league_config = result.raw_data?.league_config || {}
      const teams = result.raw_data?.teams || []
      const parts = Object.keys(result.raw_data || {})

      send_message(ws, MESSAGE_TYPES.EXTERNAL_LEAGUE_CONNECTION_VALIDATED, {
        validation_result: {
          valid: true,
          platform,
          external_league_id,
          parts,
          league_info: {
            name: league_config.name || 'Unknown',
            season: league_config.year || new Date().getFullYear(),
            total_teams: league_config.settings?.num_teams || teams.length || 0
          }
        }
      })
    } else {
      send_message(ws, MESSAGE_TYPES.EXTERNAL_LEAGUE_CONNECTION_INVALID, {
        platform,
        external_league_id,
        errors: result.errors?.map((e) => e.message) || [result.error] || [
            'Connection validation failed'
          ]
      })
    }
  } catch (error) {
    log('Error validating connection via WebSocket:', error.message)
    send_error_message(ws, error.message, 'validate_connection')
  }
}

/**
 * Handle job subscription request
 * Subscribes WebSocket to receive updates for a specific job
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {string} payload.job_id - Job ID to subscribe to
 */
async function handle_subscribe_to_job(ws, payload) {
  try {
    const validation = validate_required_fields(payload, ['job_id'])
    if (!validation.valid) {
      throw new Error(
        `Missing required fields: ${validation.missing.join(', ')}`
      )
    }

    const { job_id } = payload

    // Verify job exists
    const job = await db('external_league_import_jobs')
      .where({ job_id })
      .first()

    if (!job) {
      throw new Error(`Job not found: ${job_id}`)
    }

    // Add WebSocket to job subscriptions
    if (!job_subscriptions.has(job_id)) {
      job_subscriptions.set(job_id, new Set())
    }
    job_subscriptions.get(job_id).add(ws)

    // Store job_id on WebSocket for cleanup on disconnect
    if (!ws.subscribed_jobs) {
      ws.subscribed_jobs = new Set()
    }
    ws.subscribed_jobs.add(job_id)

    send_message(ws, MESSAGE_TYPES.EXTERNAL_LEAGUE_JOB_SUBSCRIBED, {
      job_id,
      subscribed: true
    })

    log('Client subscribed to job updates', {
      job_id,
      client_id: ws.client_id
    })
  } catch (error) {
    log('Error subscribing to job via WebSocket:', error.message)
    send_error_message(ws, error.message, 'subscribe_to_job')
  }
}

/**
 * Handle job unsubscription request
 * Removes WebSocket from receiving updates for a specific job
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {string} payload.job_id - Job ID to unsubscribe from
 */
async function handle_unsubscribe_from_job(ws, payload) {
  try {
    const validation = validate_required_fields(payload, ['job_id'])
    if (!validation.valid) {
      throw new Error(
        `Missing required fields: ${validation.missing.join(', ')}`
      )
    }

    const { job_id } = payload

    // Remove WebSocket from job subscriptions
    const subscribers = job_subscriptions.get(job_id)
    if (subscribers) {
      subscribers.delete(ws)
      if (subscribers.size === 0) {
        job_subscriptions.delete(job_id)
      }
    }

    // Remove from WebSocket's subscribed jobs set
    if (ws.subscribed_jobs) {
      ws.subscribed_jobs.delete(job_id)
    }

    send_message(ws, MESSAGE_TYPES.EXTERNAL_LEAGUE_JOB_UNSUBSCRIBED, {
      job_id,
      subscribed: false
    })

    log('Client unsubscribed from job updates', {
      job_id,
      client_id: ws.client_id
    })
  } catch (error) {
    log('Error unsubscribing from job via WebSocket:', error.message)
    send_error_message(ws, error.message, 'unsubscribe_from_job')
  }
}

/**
 * Send a message to a WebSocket client
 * Wrapper around shared utility for consistency
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} type - Message type
 * @param {Object} payload - Message payload
 */
function send_message(ws, type, payload) {
  send_websocket_message(ws, type, payload)
}

/**
 * Utility function to send error messages
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} error_message - Error message
 * @param {string} context - Error context/operation
 */
function send_error_message(ws, error_message, context) {
  send_websocket_message(
    ws,
    MESSAGE_TYPES.EXTERNAL_LEAGUE_IMPORT_ERROR,
    create_error_payload(error_message, context)
  )
}

/**
 * Broadcast a message to all subscribers of a job
 * Used by the import queue to notify multiple subscribers
 * @param {string} job_id - Job ID
 * @param {string} type - Message type
 * @param {Object} payload - Message payload
 */
export function broadcast_to_job_subscribers(job_id, type, payload) {
  const subscribers = job_subscriptions.get(job_id)
  if (subscribers) {
    subscribers.forEach((ws) => {
      send_message(ws, type, payload)
    })
  }
}

/**
 * Handle client disconnection
 * Cleans up subscriptions and removes client from queue
 * @param {string} client_id - WebSocket client ID
 */
export function handle_client_disconnect(client_id) {
  // Remove client from sync queue
  sync_queue.remove_client({ client_id })

  // Clean up job subscriptions for this client
  // Find all WebSockets with this client_id and remove them
  for (const [job_id, subscribers] of job_subscriptions.entries()) {
    for (const ws of subscribers) {
      if (ws.client_id === client_id) {
        subscribers.delete(ws)
        if (subscribers.size === 0) {
          job_subscriptions.delete(job_id)
        }
      }
    }
  }

  log('Client disconnected, cleaned up subscriptions', { client_id })
}
