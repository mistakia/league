import express from 'express'
import dayjs from 'dayjs'

import { job_title_by_id } from '#libs-shared/job-constants.mjs'
import { getJobs } from '#libs-server'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     BackgroundJob:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique job identifier
 *           example: "1640995200_DATA_IMPORT"
 *         type:
 *           type: integer
 *           description: Job type ID corresponding to job_types constants
 *           example: 1
 *           enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87]
 *         succ:
 *           type: boolean
 *           description: Whether the job execution was successful
 *           example: true
 *         timestamp:
 *           type: integer
 *           description: Unix timestamp of when the job was executed
 *           example: 1640995200
 *         reason:
 *           type: string
 *           nullable: true
 *           description: Failure reason or error message (only present when succ is false)
 *           example: "Database connection timeout"
 *       required:
 *         - id
 *         - type
 *         - succ
 *         - timestamp
 *
 *     SystemHealthError:
 *       type: object
 *       properties:
 *         job:
 *           type: string
 *           description: Human-readable job title that failed
 *           example: "Active Roster Free Agency Waivers"
 *         reason:
 *           type: string
 *           description: Reason for the job failure
 *           example: "Database connection timeout"
 *         timestamp:
 *           type: string
 *           description: Formatted timestamp of when the failure occurred
 *           example: "2025/01/17 10:30"
 *       required:
 *         - job
 *         - reason
 *         - timestamp
 *
 *     SystemHealthStatus:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [operational]
 *           description: System operational status
 *           example: "operational"
 *       required:
 *         - status
 *
 *     SystemHealthErrors:
 *       type: object
 *       properties:
 *         errors:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SystemHealthError'
 *           description: List of system errors from failed background jobs
 *       required:
 *         - errors
 *
 * /status:
 *   get:
 *     tags:
 *       - Utilities
 *     summary: Get system status and background job information
 *     description: |
 *       Retrieve detailed information about all background jobs and their execution status.
 *       This endpoint provides comprehensive system monitoring data including job success/failure
 *       status, execution timestamps, and error details for failed jobs.
 *
 *       **Background Jobs Include:**
 *       - Waiver processing (Free Agency, Poaching, Practice Squad)
 *       - Data imports (Players, Games, Plays, Projections)
 *       - Betting odds collection (DraftKings, FanDuel, Caesars, etc.)
 *       - League management (Rosters, Draft Picks, Schedules)
 *       - Analytics processing (Stats, Projections, Market Analysis)
 *     operationId: getSystemStatus
 *     responses:
 *       200:
 *         description: Successfully retrieved system status and background job information
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BackgroundJob'
 *             examples:
 *               successful_jobs:
 *                 summary: Example with successful jobs
 *                 value:
 *                   - id: "1640995200_WAIVERS"
 *                     type: 1
 *                     succ: true
 *                     timestamp: 1640995200
 *                   - id: "1640995300_PROJECTIONS"
 *                     type: 8
 *                     succ: true
 *                     timestamp: 1640995300
 *               mixed_jobs:
 *                 summary: Example with successful and failed jobs
 *                 value:
 *                   - id: "1640995200_WAIVERS"
 *                     type: 1
 *                     succ: true
 *                     timestamp: 1640995200
 *                   - id: "1640995300_DATA_IMPORT"
 *                     type: 5
 *                     succ: false
 *                     timestamp: 1640995300
 *                     reason: "Database connection timeout"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const jobs = await getJobs()
    return res.send(jobs)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /status/overall:
 *   get:
 *     tags:
 *       - Utilities
 *     summary: Get overall system health status
 *     description: |
 *       Get a high-level overview of system health status. This endpoint provides a simplified
 *       view of system operational status, returning either "operational" when all background
 *       jobs are successful, or a list of errors when any jobs have failed.
 *
 *       **Use Cases:**
 *       - System monitoring and alerting
 *       - Health check integrations
 *       - Quick operational status assessment
 *       - Uptime monitoring dashboards
 *
 *       **Status Determination:**
 *       - Returns 200 with "operational" status when all background jobs are successful
 *       - Returns 500 with error details when any background job has failed
 *       - Error details include human-readable job names and formatted timestamps
 *     operationId: getOverallSystemHealth
 *     responses:
 *       200:
 *         description: System is fully operational - all background jobs are successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemHealthStatus'
 *             examples:
 *               operational:
 *                 summary: System is operational
 *                 value:
 *                   status: "operational"
 *       500:
 *         description: System has errors - one or more background jobs have failed
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SystemHealthErrors'
 *                 - $ref: '#/components/schemas/Error'
 *             examples:
 *               system_errors:
 *                 summary: System has failed background jobs
 *                 value:
 *                   errors:
 *                     - job: "Active Roster Free Agency Waivers"
 *                       reason: "Database connection timeout"
 *                       timestamp: "2025/01/17 10:30"
 *                     - job: "Projections (PFF)"
 *                       reason: "API rate limit exceeded"
 *                       timestamp: "2025/01/17 09:45"
 *               internal_error:
 *                 summary: Internal server error
 *                 value:
 *                   error: "Failed to retrieve system status"
 */
router.get('/overall', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const jobs = await getJobs()
    const failed_jobs = jobs.filter((job) => !job.succ)

    if (failed_jobs.length === 0) {
      return res.send({ status: 'operational' })
    }

    const errors = failed_jobs.map((job) => {
      const timestamp = dayjs.unix(job.timestamp).format('YYYY/MM/DD HH:mm')
      return {
        job: job_title_by_id[job.type],
        reason: job.reason,
        timestamp
      }
    })

    return res.status(500).send({ errors })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
