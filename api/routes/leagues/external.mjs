import express from 'express'
import debug from 'debug'

import {
  get_supported_platforms,
  is_platform_supported,
  SyncOrchestrator
} from '#libs-server/external-fantasy-leagues/index.mjs'
import sync_queue from '#libs-server/external-fantasy-leagues/queue/import-queue.mjs'
import { encrypt_credentials } from '#libs-server/external-fantasy-leagues/utils/credential-encryption.mjs'
import {
  require_auth,
  validate_and_get_league,
  require_commissioner,
  require_league_access,
  handle_error
} from './middleware.mjs'

const log = debug('api:routes:leagues:external')
const router = express.Router({ mergeParams: true })

/**
 * Default sync components configuration
 */
const DEFAULT_SYNC_COMPONENTS = {
  league_config: true,
  rosters: true,
  transactions: true
}

/**
 * Parse sync components from database (handles string or object)
 * @param {string|Object} sync_components - Sync components from database
 * @param {string} context_id - ID for logging context (connection_id, etc.)
 * @returns {Object} Parsed sync components or defaults
 */
function parse_sync_components(sync_components, context_id = null) {
  if (!sync_components) {
    return DEFAULT_SYNC_COMPONENTS
  }

  try {
    return typeof sync_components === 'string'
      ? JSON.parse(sync_components)
      : sync_components
  } catch (parse_error) {
    log('Error parsing sync_components, using defaults', {
      context_id,
      error: parse_error.message
    })
    return DEFAULT_SYNC_COMPONENTS
  }
}

/**
 * Validate platform support
 * @param {string} platform - Platform name
 * @param {Object} res - Express response object
 * @returns {boolean} True if supported, false if response was sent
 */
function validate_platform(platform, res) {
  if (!is_platform_supported({ platform })) {
    res.status(400).send({
      error: `Unsupported platform: ${platform}`,
      supported_platforms: get_supported_platforms()
    })
    return false
  }
  return true
}

/**
 * @swagger
 * /leagues/{leagueId}/external/connect:
 *   post:
 *     tags:
 *       - External Leagues
 *     summary: Register external league connection
 *     description: |
 *       Register a new external fantasy league connection with credentials and configuration.
 *       Credentials are encrypted and stored securely for later use in import operations.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [sleeper, espn, yahoo, mfl, cbs, ffpc, nffc, fantrax, fleaflicker, nfl, rtsports]
 *                 description: External fantasy platform
 *                 example: sleeper
 *               external_league_id:
 *                 type: string
 *                 description: League ID on the external platform
 *                 example: "123456789"
 *               display_name:
 *                 type: string
 *                 description: Human-readable name for this connection
 *                 example: "My Sleeper League"
 *               credentials:
 *                 type: object
 *                 description: Platform-specific authentication credentials
 *                 example:
 *                   username: "myusername"
 *                   password: "mypassword"
 *               sync_config:
 *                 type: object
 *                 description: Sync configuration options
 *                 properties:
 *                   auto_sync:
 *                     type: boolean
 *                     default: false
 *                   sync_components:
 *                     type: object
 *                     properties:
 *                       league_config:
 *                         type: boolean
 *                         default: true
 *                       rosters:
 *                         type: boolean
 *                         default: true
 *                       transactions:
 *                         type: boolean
 *                         default: true
 *             required:
 *               - platform
 *               - external_league_id
 *               - display_name
 *           examples:
 *             sleeperConnection:
 *               summary: Sleeper league connection
 *               value:
 *                 platform: sleeper
 *                 external_league_id: "123456789"
 *                 display_name: "My Sleeper League"
 *                 credentials: {}
 *                 sync_config:
 *                   auto_sync: false
 *                   sync_components:
 *                     league_config: true
 *                     rosters: true
 *                     transactions: true
 *     responses:
 *       201:
 *         description: Connection registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 connection_id:
 *                   type: string
 *                   format: uuid
 *                   description: Unique connection identifier
 *                 message:
 *                   type: string
 *                   example: "External league connection registered successfully"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/connect', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const {
      platform,
      external_league_id,
      display_name,
      credentials = {},
      sync_config = {}
    } = req.body

    // Authentication check
    if (!require_auth(req, res)) return

    // Validate and get league
    const league = await validate_and_get_league(leagueId, res)
    if (!league) return

    // Verify user is league commissioner
    if (
      !require_commissioner(
        league,
        req.auth.userId,
        res,
        'register connections'
      )
    ) {
      return
    }

    // Validate required fields
    if (!platform) {
      return res.status(400).send({ error: 'Platform is required' })
    }

    if (!external_league_id) {
      return res.status(400).send({ error: 'External league ID is required' })
    }

    if (!display_name) {
      return res.status(400).send({ error: 'Display name is required' })
    }

    // Validate platform support
    if (!validate_platform(platform, res)) return

    // Check for existing connection
    const existing_connection = await db('external_league_connections')
      .where({
        lid: leagueId,
        platform,
        external_league_id
      })
      .first()

    if (existing_connection) {
      return res.status(400).send({
        error: 'Connection already exists for this platform and league ID',
        connection_id: existing_connection.connection_id
      })
    }

    // Encrypt credentials before storage
    const encrypted_credentials = encrypt_credentials(credentials)

    // Create connection record
    const [connection] = await db('external_league_connections')
      .insert({
        lid: leagueId,
        platform,
        external_league_id,
        connection_name: display_name,
        credentials_encrypted: encrypted_credentials,
        sync_components: {
          ...DEFAULT_SYNC_COMPONENTS,
          ...sync_config?.sync_components
        },
        auto_sync_enabled: sync_config?.auto_sync || false,
        created_by: req.auth.userId,
        status: 'active'
      })
      .returning('*')

    log('External league connection registered', {
      connection_id: connection.connection_id,
      platform,
      external_league_id,
      lid: leagueId,
      user_id: req.auth.userId
    })

    res.status(201).send({
      success: true,
      connection_id: connection.connection_id,
      message: 'External league connection registered successfully'
    })
  } catch (err) {
    handle_error(err, logger, res)
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/external/import:
 *   post:
 *     tags:
 *       - External Leagues
 *     summary: Queue sync job
 *     description: |
 *       Queue a sync job for an external league connection. Returns job ID for tracking progress
 *       via WebSocket or the status endpoint. Supports both full sync and dry-run modes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               connection_id:
 *                 type: string
 *                 format: uuid
 *                 description: Connection ID from registered connection
 *               job_type:
 *                 type: string
 *                 enum: [full_sync, rosters_only, transactions_only]
 *                 default: full_sync
 *                 description: Type of sync operation
 *               sync_components:
 *                 type: object
 *                 description: Components to sync (overrides connection defaults)
 *                 properties:
 *                   league_config:
 *                     type: boolean
 *                     default: true
 *                   rosters:
 *                     type: boolean
 *                     default: true
 *                   transactions:
 *                     type: boolean
 *                     default: true
 *               dry_run:
 *                 type: boolean
 *                 default: false
 *                 description: If true, preview sync without making changes
 *             required:
 *               - connection_id
 *           examples:
 *             fullSync:
 *               summary: Full sync import
 *               value:
 *                 connection_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 job_type: full_sync
 *                 dry_run: false
 *             dryRun:
 *               summary: Dry run preview
 *               value:
 *                 connection_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 job_type: full_sync
 *                 dry_run: true
 *     responses:
 *       202:
 *         description: Sync job queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 job_id:
 *                   type: string
 *                   format: uuid
 *                   description: Job ID for tracking progress
 *                 message:
 *                   type: string
 *                   example: "Sync job queued successfully"
 *                 queue_position:
 *                   type: integer
 *                   description: Position in queue (1-based)
 *                   example: 1
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/import', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const {
      connection_id,
      job_type = 'full_sync',
      sync_components,
      dry_run = false
    } = req.body

    // Authentication check
    if (!require_auth(req, res)) return

    // Validate and get league
    const league = await validate_and_get_league(leagueId, res)
    if (!league) return

    // Verify user is league commissioner
    if (
      !require_commissioner(league, req.auth.userId, res, 'initiate sync jobs')
    ) {
      return
    }

    // Validate required fields
    if (!connection_id) {
      return res.status(400).send({ error: 'Connection ID is required' })
    }

    // Verify connection exists and belongs to this league
    const connection = await db('external_league_connections')
      .where({
        connection_id,
        lid: leagueId,
        status: 'active'
      })
      .first()

    if (!connection) {
      return res.status(400).send({ error: 'Connection not found or inactive' })
    }

    // Parse stored sync configuration and merge with provided components
    const stored_sync_components = parse_sync_components(
      connection.sync_components,
      connection_id
    )

    // Use provided sync components or fall back to connection defaults
    const final_sync_components = sync_components || stored_sync_components

    // Create a no-op WebSocket object for REST API calls
    // WebSocket connections are handled separately for real-time updates
    const placeholder_ws = {
      readyState: 1,
      send: () => {}, // No-op for REST API
      client_id: `rest-${Date.now()}`
    }

    // Queue the sync job
    const job_id = await sync_queue.queue_job({
      ws: placeholder_ws,
      connection_id,
      job_type,
      sync_components: final_sync_components,
      dry_run,
      user_id: req.auth.userId
    })

    const queue_position = await sync_queue.get_queue_position({ job_id })

    log('Sync job queued', {
      job_id,
      connection_id,
      job_type,
      dry_run,
      lid: leagueId,
      user_id: req.auth.userId
    })

    res.status(202).send({
      success: true,
      job_id,
      message: 'Sync job queued successfully',
      queue_position
    })
  } catch (err) {
    handle_error(err, logger, res)
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/external/status:
 *   get:
 *     tags:
 *       - External Leagues
 *     summary: Get sync job status
 *     description: |
 *       Get status of sync jobs for the league. Can filter by job_id or show all recent jobs.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: job_id
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Specific job ID to check (optional)
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Maximum number of jobs to return (when not filtering by job_id)
 *     responses:
 *       200:
 *         description: Sync job status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 jobs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       job_id:
 *                         type: string
 *                         format: uuid
 *                       status:
 *                         type: string
 *                         enum: [queued, running, completed, failed, cancelled]
 *                       progress:
 *                         type: integer
 *                         minimum: 0
 *                         maximum: 100
 *                       current_step:
 *                         type: string
 *                       connection_id:
 *                         type: string
 *                         format: uuid
 *                       platform:
 *                         type: string
 *                       external_league_id:
 *                         type: string
 *                       job_type:
 *                         type: string
 *                       dry_run:
 *                         type: boolean
 *                       queued_at:
 *                         type: string
 *                         format: date-time
 *                       started_at:
 *                         type: string
 *                         format: date-time
 *                       completed_at:
 *                         type: string
 *                         format: date-time
 *                       queue_position:
 *                         type: integer
 *                         description: Present only for queued jobs
 *                       stats:
 *                         type: object
 *                         description: Present only for completed/failed jobs
 *                         properties:
 *                           players_mapped:
 *                             type: integer
 *                           players_failed:
 *                             type: integer
 *                           rosters_updated:
 *                             type: integer
 *                           transactions_imported:
 *                             type: integer
 *                           transactions_failed:
 *                             type: integer
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/status', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { job_id, limit: limit_param = '10' } = req.query

    // Validate and parse limit parameter
    const limit = Math.min(Math.max(parseInt(limit_param, 10) || 10, 1), 100)

    // Authentication check
    if (!require_auth(req, res)) return

    // Validate and get league
    const league = await validate_and_get_league(leagueId, res)
    if (!league) return

    // Check if user has access to this league (commissioner or has a team)
    const has_access = await require_league_access(
      league,
      req.auth.userId,
      leagueId,
      db,
      res
    )
    if (!has_access) return

    let jobs_query = db('external_league_import_jobs')
      .join(
        'external_league_connections',
        'external_league_import_jobs.connection_id',
        'external_league_connections.connection_id'
      )
      .where('external_league_connections.lid', leagueId)
      .select(
        'external_league_import_jobs.*',
        'external_league_connections.platform',
        'external_league_connections.external_league_id',
        'external_league_connections.connection_name as display_name'
      )

    if (job_id) {
      jobs_query = jobs_query.where(
        'external_league_import_jobs.job_id',
        job_id
      )
    } else {
      jobs_query = jobs_query
        .orderBy('external_league_import_jobs.queued_at', 'desc')
        .limit(limit)
    }

    const jobs = await jobs_query

    // Add queue position for queued jobs and format response
    const formatted_jobs = await Promise.all(
      jobs.map(async (job) => {
        const formatted_job = {
          job_id: job.job_id,
          status: job.status,
          progress: job.progress_percentage || 0,
          current_step: job.current_step,
          connection_id: job.connection_id,
          platform: job.platform,
          external_league_id: job.external_league_id,
          display_name: job.display_name,
          job_type: job.job_type,
          dry_run: job.dry_run,
          queued_at: job.queued_at,
          started_at: job.started_at,
          completed_at: job.completed_at
        }

        // Add queue position for queued jobs
        if (job.status === 'queued') {
          formatted_job.queue_position = await sync_queue.get_queue_position({
            job_id: job.job_id
          })
        }

        // Add stats for completed/failed jobs
        if (
          (job.status === 'completed' || job.status === 'failed') &&
          job.players_mapped !== undefined
        ) {
          formatted_job.stats = {
            players_mapped: job.players_mapped,
            players_failed: job.players_failed,
            rosters_updated: job.rosters_updated,
            transactions_imported: job.transactions_imported,
            transactions_failed: job.transactions_failed
          }
        }

        return formatted_job
      })
    )

    res.send({
      success: true,
      jobs: formatted_jobs
    })
  } catch (err) {
    handle_error(err, logger, res)
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/external/{jobId}:
 *   delete:
 *     tags:
 *       - External Leagues
 *     summary: Cancel sync job
 *     description: |
 *       Cancel a queued sync job. Jobs that are currently running cannot be cancelled.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: jobId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID to cancel
 *     responses:
 *       200:
 *         description: Job cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Sync job cancelled successfully"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:jobId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId, jobId } = req.params

    // Authentication check
    if (!require_auth(req, res)) return

    // Validate and get league
    const league = await validate_and_get_league(leagueId, res)
    if (!league) return

    // Verify user is league commissioner
    if (
      !require_commissioner(league, req.auth.userId, res, 'cancel sync jobs')
    ) {
      return
    }

    // Verify job exists and belongs to this league
    const job = await db('external_league_import_jobs')
      .join(
        'external_league_connections',
        'external_league_import_jobs.connection_id',
        'external_league_connections.connection_id'
      )
      .where({
        'external_league_import_jobs.job_id': jobId,
        'external_league_connections.lid': leagueId
      })
      .select('external_league_import_jobs.*')
      .first()

    if (!job) {
      return res.status(400).send({ error: 'Job not found' })
    }

    // Cancel the job using the queue system
    await sync_queue.cancel_job({
      job_id: jobId,
      user_id: req.auth.userId
    })

    log('Sync job cancelled', {
      job_id: jobId,
      lid: leagueId,
      user_id: req.auth.userId
    })

    res.send({
      success: true,
      message: 'Sync job cancelled successfully'
    })
  } catch (err) {
    handle_error(err, logger, res)
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/external/connections:
 *   get:
 *     tags:
 *       - External Leagues
 *     summary: List configured connections
 *     description: |
 *       Get list of all external league connections configured for this league.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: include_inactive
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive connections in results
 *     responses:
 *       200:
 *         description: List of configured connections
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 connections:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       connection_id:
 *                         type: string
 *                         format: uuid
 *                       platform:
 *                         type: string
 *                       external_league_id:
 *                         type: string
 *                       display_name:
 *                         type: string
 *                       is_active:
 *                         type: boolean
 *                       sync_config:
 *                         type: object
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       last_sync_at:
 *                         type: string
 *                         format: date-time
 *                       last_sync_status:
 *                         type: string
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/connections', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { include_inactive: include_inactive_param } = req.query

    // Parse include_inactive as boolean (defaults to false)
    const include_inactive =
      include_inactive_param === 'true' || include_inactive_param === true

    // Authentication check
    if (!require_auth(req, res)) return

    // Validate and get league
    const league = await validate_and_get_league(leagueId, res)
    if (!league) return

    // Check if user has access to this league (commissioner or has a team)
    const has_access = await require_league_access(
      league,
      req.auth.userId,
      leagueId,
      db,
      res
    )
    if (!has_access) return

    // Build query
    let connections_query = db('external_league_connections')
      .where({ lid: leagueId })
      .select(
        'connection_id',
        'platform',
        'external_league_id',
        'connection_name',
        'status',
        'sync_components',
        'auto_sync_enabled',
        'created_at',
        'last_sync',
        'last_validated'
      )
      .orderBy('created_at', 'desc')

    // Filter by active status unless explicitly including inactive ones
    if (!include_inactive) {
      connections_query = connections_query.where({ status: 'active' })
    }

    const connections = await connections_query

    // Parse sync_components JSON and format response
    const formatted_connections = connections.map((conn) => {
      const parsed_sync_components = parse_sync_components(
        conn.sync_components,
        conn.connection_id
      )

      return {
        connection_id: conn.connection_id,
        platform: conn.platform,
        external_league_id: conn.external_league_id,
        display_name: conn.connection_name,
        is_active: conn.status === 'active',
        sync_config: {
          auto_sync: conn.auto_sync_enabled,
          sync_components: parsed_sync_components
        },
        created_at: conn.created_at,
        last_sync_at: conn.last_sync,
        last_validated_at: conn.last_validated
      }
    })

    res.send({
      success: true,
      connections: formatted_connections
    })
  } catch (err) {
    handle_error(err, logger, res)
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/external/validate:
 *   post:
 *     tags:
 *       - External Leagues
 *     summary: Validate connection
 *     description: |
 *       Validate external league connection by performing a quick read-only check.
 *       This tests credentials and connectivity without importing any data.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [sleeper, espn, yahoo, mfl, cbs, ffpc, nffc, fantrax, fleaflicker, nfl, rtsports]
 *                 description: External fantasy platform
 *               external_league_id:
 *                 type: string
 *                 description: League ID on the external platform
 *               credentials:
 *                 type: object
 *                 description: Platform-specific authentication credentials
 *             required:
 *               - platform
 *               - external_league_id
 *           examples:
 *             sleeperValidation:
 *               summary: Validate Sleeper connection
 *               value:
 *                 platform: sleeper
 *                 external_league_id: "123456789"
 *                 credentials: {}
 *     responses:
 *       200:
 *         description: Connection validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 valid:
 *                   type: boolean
 *                   description: Whether connection is valid
 *                 message:
 *                   type: string
 *                 league_info:
 *                   type: object
 *                   description: Basic league information if valid
 *                   properties:
 *                     name:
 *                       type: string
 *                     season:
 *                       type: integer
 *                     total_teams:
 *                       type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Validation error messages if invalid
 *                 parts:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Available data components fetched during validation (e.g., league_config, rosters, transactions)
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/validate', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { platform, external_league_id, credentials = {} } = req.body

    // Authentication check
    if (!require_auth(req, res)) return

    // Validate and get league
    const league = await validate_and_get_league(leagueId, res)
    if (!league) return

    // Verify user is league commissioner
    if (
      !require_commissioner(
        league,
        req.auth.userId,
        res,
        'validate connections'
      )
    ) {
      return
    }

    // Validate required fields
    if (!platform) {
      return res.status(400).send({ error: 'Platform is required' })
    }

    if (!external_league_id) {
      return res.status(400).send({ error: 'External league ID is required' })
    }

    // Validate platform support
    if (!validate_platform(platform, res)) return

    // Use sync orchestrator to validate connection
    const sync_orchestrator = new SyncOrchestrator()
    const result = await sync_orchestrator.fetch_league_data({
      platform_name: platform,
      external_league_id,
      credentials,
      fetch_options: { validate_only: true }
    })

    if (result.success) {
      log('Connection validation successful', {
        platform,
        external_league_id,
        lid: leagueId,
        user_id: req.auth.userId
      })

      const league_config = result.raw_data?.league_config || {}
      const teams = result.raw_data?.teams || []
      const parts = Object.keys(result.raw_data || {})

      res.send({
        success: true,
        valid: true,
        message: 'Connection is valid',
        parts,
        league_info: {
          name: league_config.name || 'Unknown',
          season: league_config.year || new Date().getFullYear(),
          total_teams: league_config.settings?.num_teams || teams.length || 0
        }
      })
    } else {
      log('Connection validation failed', {
        platform,
        external_league_id,
        error: result.error,
        lid: leagueId,
        user_id: req.auth.userId
      })

      res.send({
        success: true,
        valid: false,
        message: 'Connection validation failed',
        errors: result.errors || [result.error]
      })
    }
  } catch (err) {
    handle_error(err, logger, res)
  }
})

export default router
