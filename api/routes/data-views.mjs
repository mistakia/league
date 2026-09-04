import express from 'express'
import crypto from 'crypto'
import {
  validators,
  get_data_view_results_query,
  resolve_table_state_from_short_url,
  format_sql,
  redis_cache
} from '#libs-server'
import betting_market_column_definitions from '#libs-server/data-views-column-definitions/player-betting-market-column-definitions.mjs'
import get_data_view_hash from '#libs-server/data-views/get-data-view-hash.mjs'
import { execute_data_view_request } from '#libs-server/data-views/execute-data-view-request.mjs'
import { load_data_view_query } from '#libs-server/data-views/run-query-backed-view.mjs'
import get_param_option_counts, {
  collect_other_params
} from '#libs-server/data-views/get-param-option-counts.mjs'
import get_stats_column_param_key from '#libs-server/data-views/get-stats-column-param-key.mjs'
import {
  resolve_export_api_key,
  resolve_export_max_limit,
  EXPORT_CACHE_MAX_ROWS
} from '#libs-server/data-views/export-api-keys.mjs'
import { nfl_plays_column_params } from '#libs-shared'
import convert_to_csv from '#libs-shared/convert-to-csv.mjs'
import { render_participation_null } from '#libs-shared/data-views/participation-cell.mjs'
import load_view_organization from '#libs-server/view-organization/load-view-organization.mjs'
import add_user_tag from '#libs-server/view-organization/add-user-tag.mjs'
import remove_user_tag from '#libs-server/view-organization/remove-user-tag.mjs'
import toggle_favorite from '#libs-server/view-organization/toggle-favorite.mjs'
import validate_emission from '#libs-server/data-views/generation/validate-emission.mjs'
import {
  get_generation_job_by_thread_id,
  complete_generation_job,
  LIVE_STATUSES
} from '#libs-server/data-views/generation/generation-job-queue.mjs'
import { record_generation_progress } from '#libs-server/data-views/generation/generation-progress.mjs'

const router = express.Router()

const PARTICIPATION_STATUS_KEY = 'participation_status'

// A key holder's export runs long by design, so it gets its own deadline rather
// than the 40s an anonymous viewer gets or the 5 minutes a signed-in one does.
const EXPORT_API_KEY_TIMEOUT_MS = 30 * 60 * 1000

// Distinct from null, which means the parameter was absent. `Number('abc')` is
// NaN and `Number('')` is 0, so a bare `Number(...) || null` reads a typo as
// "no limit" -- which, with the ceiling in play, is the most permissive reading
// of the most malformed input.
const INVALID_PARAM = Symbol('invalid_param')

const parse_integer_param = (raw_value, { minimum }) => {
  if (raw_value === undefined || raw_value === '') return null
  const parsed = Number(raw_value)
  if (!Number.isInteger(parsed) || parsed < minimum) return INVALID_PARAM
  return parsed
}

const parse_positive_integer_param = (raw_value) =>
  parse_integer_param(raw_value, { minimum: 1 })

const parse_non_negative_integer_param = (raw_value) =>
  parse_integer_param(raw_value, { minimum: 0 })

const read_total_count = (data_view_metadata) =>
  data_view_metadata && data_view_metadata.total_count != null
    ? data_view_metadata.total_count
    : null

// The result aliases of every betting-market column.
//
// A null in one of these means the bookmaker posted NO market for that player
// and week, which is a different claim from "the market settled at zero" -- so
// the week-grain participation marker must not turn it into a 0. The
// participation signal reports whether the PLAYER took the field, and that says
// nothing about whether a book put up a line. FanDuel has never posted
// GAME_RUSHING_TOUCHDOWNS at all, and an export of that column read as a
// column of zeroes rather than as absent.
//
// Derived from the betting-market module's own exports rather than a
// hand-maintained list, so a column added there is covered without touching
// this file, and derived at MODULE level because it cannot change at runtime.
const NO_SOURCE_NULL_ALIASES = new Set(
  Object.values(betting_market_column_definitions)
    .filter((definition) => typeof definition?.select_as === 'function')
    .map((definition) => definition.select_as())
)

// `select-string.mjs` emits `<select_as>_<column_index>`, so stripping the
// trailing index recovers the alias.
const is_no_source_null_field = (field) =>
  NO_SOURCE_NULL_ALIASES.has(field.replace(/_\d+$/, ''))

// Apply the hidden week-grain participation signal to an export, then drop it.
// For week-grain views the query injects one `participation_status` per row; a
// null numeric stat cell should export as 0 (active-but-zero) / BYE / blank
// rather than an ambiguous blank. The server has no column data_type, so
// numeric-ness is inferred from the data: a field is numeric if any row holds a
// number in it (identity/text fields hold strings and are left untouched). The
// reserved participation_status column is always stripped from the output.
// Non-week-grain results carry no participation_status, so this is a no-op
// beyond being absent (nothing to strip, nothing to substitute).
function apply_participation_to_export(data_view_results) {
  if (!data_view_results || !data_view_results.length) return data_view_results

  const has_participation = data_view_results.some(
    (row) => row[PARTICIPATION_STATUS_KEY] != null
  )

  // Infer which fields are numeric (carry at least one number, never a
  // non-empty non-number). Only these get the participation marker for nulls.
  const numeric_fields = new Set()
  const disqualified_fields = new Set()
  for (const row of data_view_results) {
    for (const [field, value] of Object.entries(row)) {
      if (field === PARTICIPATION_STATUS_KEY) continue
      if (typeof value === 'number') numeric_fields.add(field)
      else if (value != null && value !== '') disqualified_fields.add(field)
    }
  }
  for (const field of disqualified_fields) numeric_fields.delete(field)

  return data_view_results.map((row) => {
    const participation_status = row[PARTICIPATION_STATUS_KEY]
    const next = {}
    for (const [field, value] of Object.entries(row)) {
      if (field === PARTICIPATION_STATUS_KEY) continue
      next[field] =
        has_participation &&
        value == null &&
        numeric_fields.has(field) &&
        !is_no_source_null_field(field)
          ? render_participation_null({ participation_status })
          : value
    }
    return next
  })
}

// Normalize data to ensure all rows have all columns
function normalize_data_view_results(data_view_results) {
  if (!data_view_results || !data_view_results.length) {
    return { fields: [], normalized_results: [] }
  }

  // Collect all unique fields from all rows while preserving order
  const fields = []
  const field_set = new Set()

  // First pass: collect fields in the order they appear
  for (const row of data_view_results) {
    for (const field of Object.keys(row)) {
      if (!field_set.has(field)) {
        field_set.add(field)
        fields.push(field)
      }
    }
  }

  // Ensure all rows have all fields (with empty string for missing values)
  const normalized_results = data_view_results.map((row) => {
    const normalized_row = {}
    for (const field of fields) {
      normalized_row[field] = row[field] !== undefined ? row[field] : ''
    }
    return normalized_row
  })

  return { fields, normalized_results }
}

function convert_to_markdown_table(normalized_results, fields) {
  if (!normalized_results.length) {
    return ''
  }

  // Build markdown table header
  let markdown = '| ' + fields.join(' | ') + ' |\n'

  // Add separator row
  markdown += '| ' + fields.map(() => '---').join(' | ') + ' |\n'

  // Add data rows
  for (const row of normalized_results) {
    const values = fields.map((field) => {
      const value = row[field]
      // Escape pipe characters in cell values
      return String(value ?? '').replace(/\|/g, '\\|')
    })
    markdown += '| ' + values.join(' | ') + ' |\n'
  }

  return markdown
}

function convert_to_html_table(normalized_results, fields, view_name) {
  if (!normalized_results.length) {
    return '<html><body><h1>No data available</h1></body></html>'
  }

  const title = view_name || 'Data Export'

  // Escape HTML special characters
  const escape_html = (str) => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  return `<!DOCTYPE html>
<html><head><title>${escape_html(title)}</title></head><body>
<h1>${escape_html(title)}</h1>
<table border="1">
<tr>${fields.map((h) => `<th>${escape_html(h)}</th>`).join('')}</tr>
${normalized_results.map((row) => `<tr>${fields.map((h) => `<td>${escape_html(row[h] ?? '')}</td>`).join('')}</tr>`).join('')}
</table>
</body></html>`
}

/**
 * @swagger
 * components:
 *   schemas:
 *     DataView:
 *       type: object
 *       properties:
 *         view_id:
 *           type: string
 *           format: uuid
 *           description: 'Unique identifier for the data view'
 *           example: 'a1b2c3d4-5678-90ab-cdef-123456789012'
 *         view_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           description: 'Name of the data view'
 *           example: 'Weekly QB Rankings'
 *         view_description:
 *           type: string
 *           minLength: 1
 *           maxLength: 1000
 *           nullable: true
 *           description: 'Description of the data view'
 *           example: 'Top quarterback rankings for the current week'
 *         table_state:
 *           $ref: '#/components/schemas/TableState'
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 'When the data view was created'
 *           example: '2024-01-15T10:30:00Z'
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 'When the data view was last updated'
 *           example: '2024-01-15T14:22:00Z'
 *         user_id:
 *           type: integer
 *           description: 'ID of the user who created the data view'
 *           example: 123
 *         view_username:
 *           type: string
 *           nullable: true
 *           description: 'Username of the user who created the data view'
 *           example: 'johndoe'
 *       required:
 *         - view_id
 *         - view_name
 *         - table_state
 *         - user_id
 *
 *     TableState:
 *       type: object
 *       properties:
 *         offset:
 *           type: integer
 *           minimum: 0
 *           description: 'Number of rows to skip for pagination'
 *           example: 0
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 2000
 *           description: 'Maximum number of rows to return'
 *           example: 100
 *         sort:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SortColumn'
 *           description: 'Sort configuration for the data view'
 *         columns:
 *           type: array
 *           items:
 *             oneOf:
 *               - type: string
 *                 description: 'Column ID as string'
 *                 example: 'player_name'
 *               - $ref: '#/components/schemas/ColumnConfig'
 *           description: 'Columns to include in the data view'
 *         where:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/WhereClause'
 *           description: 'Filter conditions for the data view'
 *         row_axes:
 *           type: array
 *           items:
 *             type: string
 *           description: 'Row axis configurations for data grouping'
 *           example: ['week', 'team']
 *         prefix_columns:
 *           type: array
 *           items:
 *             type: string
 *           description: 'Columns to prefix in the output'
 *           example: ['player_', 'team_']
 *
 *     SortColumn:
 *       type: object
 *       properties:
 *         column_id:
 *           type: string
 *           description: 'ID of the column to sort by'
 *           example: 'fantasy_points'
 *         desc:
 *           type: boolean
 *           description: 'Whether to sort in descending order'
 *           example: true
 *       required:
 *         - column_id
 *         - desc
 *
 *     ColumnConfig:
 *       type: object
 *       properties:
 *         column_id:
 *           type: string
 *           description: 'ID of the column'
 *           example: 'player_projected_points'
 *         params:
 *           type: object
 *           description: 'Additional parameters for the column'
 *           example: { "week": 4, "year": 2024 }
 *       required:
 *         - column_id
 *
 *     WhereClause:
 *       type: object
 *       properties:
 *         column_id:
 *           type: string
 *           description: 'ID of the column to filter'
 *           example: 'position'
 *         operator:
 *           type: string
 *           enum: ['=', '!=', '>', '>=', '<', '<=', 'ILIKE', 'NOT ILIKE', 'LIKE', 'NOT LIKE', 'IS NULL', 'IS NOT NULL', 'IN', 'NOT IN']
 *           description: 'Comparison operator'
 *           example: '='
 *         value:
 *           oneOf:
 *             - type: string
 *             - type: number
 *             - type: array
 *               items:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *           description: 'Value to compare against (not required for NULL operators)'
 *           example: 'QB'
 *         params:
 *           type: object
 *           description: 'Additional parameters for the filter'
 *           example: { "case_sensitive": false }
 *       required:
 *         - column_id
 *         - operator
 *
 *     DataViewCreateRequest:
 *       type: object
 *       properties:
 *         view_id:
 *           type: string
 *           format: uuid
 *           description: 'Optional view ID for updating existing view'
 *           example: 'a1b2c3d4-5678-90ab-cdef-123456789012'
 *         view_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           description: 'Name of the data view'
 *           example: 'My QB Rankings'
 *         view_description:
 *           type: string
 *           minLength: 1
 *           maxLength: 1000
 *           description: 'Description of the data view'
 *           example: 'Custom quarterback rankings for week 4'
 *         table_state:
 *           $ref: '#/components/schemas/TableState'
 *       required:
 *         - view_name
 *         - view_description
 *         - table_state
 *
 *     DataViewSearchRequest:
 *       type: object
 *       properties:
 *         where:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/WhereClause'
 *           description: 'Filter conditions for the search'
 *         columns:
 *           type: array
 *           items:
 *             oneOf:
 *               - type: string
 *               - $ref: '#/components/schemas/ColumnConfig'
 *           description: 'Columns to include in the results'
 *         sort:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SortColumn'
 *           description: 'Sort configuration for the results'
 *         offset:
 *           type: integer
 *           minimum: 0
 *           description: 'Number of rows to skip for pagination'
 *           example: 0
 *         prefix_columns:
 *           type: array
 *           items:
 *             type: string
 *           description: 'Columns to prefix in the output'
 *         row_axes:
 *           type: array
 *           items:
 *             type: string
 *           description: 'Row axis configurations for data grouping'
 *       required:
 *         - columns
 *
 *     DataViewResults:
 *       type: array
 *       items:
 *         type: object
 *         additionalProperties: true
 *         description: 'Dynamic object containing the requested data columns'
 *       description: 'Array of data results matching the search criteria'
 *       example:
 *         - player_name: 'Patrick Mahomes'
 *           position: 'QB'
 *           team: 'KC'
 *           fantasy_points: 24.5
 *         - player_name: 'Josh Allen'
 *           position: 'QB'
 *           team: 'BUF'
 *           fantasy_points: 22.1
 *
 *     DeleteResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: 'Whether the deletion was successful'
 *           example: true
 *       required:
 *         - success
 *
 *   parameters:
 *     dataViewId:
 *       name: data_view_id
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 *       description: 'Unique identifier for the data view'
 *       example: 'a1b2c3d4-5678-90ab-cdef-123456789012'
 *
 *     viewId:
 *       name: view_id
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 *       description: 'Unique identifier for the data view'
 *       example: 'a1b2c3d4-5678-90ab-cdef-123456789012'
 *
 *     exportFormat:
 *       name: export_format
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         enum: [csv, json, md, html]
 *       description: 'Format for exporting the data view'
 *       example: 'csv'
 *
 *     ignoreCache:
 *       name: ignore_cache
 *       in: query
 *       required: false
 *       schema:
 *         type: boolean
 *       description: 'Whether to ignore cached results and fetch fresh data'
 *       example: false
 *
 *     exportLimit:
 *       name: limit
 *       in: query
 *       required: false
 *       schema:
 *         type: integer
 *         minimum: 1
 *       description: >
 *         Maximum number of records to export. The cap is the caller's
 *         users.data_view_export_max_rows — 100000 for an anonymous caller,
 *         and whatever the user carries otherwise, up to no cap at all. A
 *         limit above the cap is rejected with 400 rather than clamped.
 *         Defaults to the cap.
 *       example: 1000
 *
 *     exportOffset:
 *       name: offset
 *       in: query
 *       required: false
 *       schema:
 *         type: integer
 *         minimum: 0
 *       description: >
 *         Row offset for pagination. Overrides the saved view's own offset.
 *         Pair with limit and read x-total-count to walk a large result set.
 *       example: 0
 *
 *     exportApiKey:
 *       name: x-api-key
 *       in: header
 *       required: false
 *       schema:
 *         type: string
 *       description: >
 *         Export API key, generated under user settings. It authenticates its
 *         owner for this route, so the export runs as that user and carries
 *         that user's row cap. A JWT, when both are presented, wins.
 */

/**
 * @swagger
 * /data-views:
 *   get:
 *     summary: List the authenticated user's data views
 *     description: |
 *       Retrieves the data views owned by the authenticated user. Data views are custom
 *       table configurations that allow users to create, save, and share specific data
 *       queries with custom columns, filters, and sorting.
 *
 *       **Authentication required**: This endpoint requires a valid JWT token. There is no
 *       way to list another user's views except for the admin account (`userId === 1`),
 *       which may list every saved view for audit and triage — otherwise a view is shared
 *       by its `view_id` (or a short URL), both of which resolve without authentication.
 *     tags:
 *       - Data Views
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of data views retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DataView'
 *             example:
 *               - view_id: 'a1b2c3d4-5678-90ab-cdef-123456789012'
 *                 view_name: 'Weekly QB Rankings'
 *                 view_description: 'Top quarterback rankings for the current week'
 *                 table_state:
 *                   columns: ['player_name', 'position', 'fantasy_points']
 *                   sort: [{ column_id: 'fantasy_points', desc: true }]
 *                   where: [{ column_id: 'position', operator: '=', value: 'QB' }]
 *                 created_at: '2024-01-15T10:30:00Z'
 *                 updated_at: '2024-01-15T14:22:00Z'
 *                 user_id: 123
 *                 view_username: 'johndoe'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    // This route is mounted before the blanket auth guard in api/index.mjs, so
    // it must self-enforce. It is owner-scoped with no filter parameters: a
    // caller can only ever list their own views. Sharing goes through the
    // view_id (or a short URL), both of which resolve unauthenticated.
    if (!req.auth || !req.auth.userId) {
      return res.status(401).send({ error: 'invalid userId' })
    }

    // userId 1 is the admin account (the same check /data-views/debug and the
    // cache routes use). The admin lists every saved view on the platform so
    // the operator can audit, triage, and open any user's shared view.
    // Non-admin callers stay owner-scoped: no filter parameter can widen the
    // list, so enumeration stays closed to everyone else.
    const views_query = db('user_data_views')
      .select('user_data_views.*', 'users.username as view_username')
      .leftJoin('users', 'user_data_views.user_id', 'users.id')

    if (req.auth.userId !== 1) {
      views_query.where('user_data_views.user_id', req.auth.userId)
    }

    const views = await views_query

    return res.status(200).send(views)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * GET /data-views/organization
 * Returns the authenticated user's favorites and tags for all their data views.
 * Orphaned rows (from deleted views) are filtered server-side.
 * NOTE: must be registered before GET /:data_view_id to avoid path collision.
 */
router.get('/organization', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).send({ error: 'invalid userId' })
    }
    const user_id = req.auth.userId
    const result = await load_view_organization({ user_id, db })
    res.status(200).send(result)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /data-views/{data_view_id}:
 *   get:
 *     summary: Get a specific data view
 *     description: |
 *       Retrieves a specific data view by its unique identifier.
 *       Returns the complete data view configuration including table state,
 *       metadata, and the username of the creator.
 *     tags:
 *       - Data Views
 *     parameters:
 *       - $ref: '#/components/parameters/dataViewId'
 *     responses:
 *       '200':
 *         description: Data view retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DataView'
 *             example:
 *               view_id: 'a1b2c3d4-5678-90ab-cdef-123456789012'
 *               view_name: 'Weekly QB Rankings'
 *               view_description: 'Top quarterback rankings for the current week'
 *               table_state:
 *                 columns: ['player_name', 'position', 'fantasy_points']
 *                 sort: [{ column_id: 'fantasy_points', desc: true }]
 *                 where: [{ column_id: 'position', operator: '=', value: 'QB' }]
 *                 offset: 0
 *                 limit: 100
 *               created_at: '2024-01-15T10:30:00Z'
 *               updated_at: '2024-01-15T14:22:00Z'
 *               user_id: 123
 *               view_username: 'johndoe'
 *       '400':
 *         description: Invalid data view ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: 'invalid data_view_id'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:data_view_id', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const { data_view_id } = req.params
    const view = await db('user_data_views')
      .select('user_data_views.*', 'users.username as view_username')
      .leftJoin('users', 'user_data_views.user_id', 'users.id')
      .where({
        view_id: data_view_id
      })
      .first()

    if (!view) {
      return res.status(400).send({ error: 'invalid data_view_id' })
    }

    res.status(200).send(view)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /data-views:
 *   post:
 *     summary: Create or update a data view
 *     description: |
 *       Creates a new data view or updates an existing one if view_id is provided.
 *       Data views allow users to save custom table configurations with specific
 *       columns, filters, sorting, and other display preferences.
 *
 *       **Authentication required**: This endpoint requires a valid JWT token.
 *
 *       **Create vs Update**:
 *       - If `view_id` is not provided, creates a new data view
 *       - If `view_id` is provided, updates the existing data view (must be owned by authenticated user)
 *     tags:
 *       - Data Views
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DataViewCreateRequest'
 *           examples:
 *             createNew:
 *               summary: Create new data view
 *               value:
 *                 view_name: 'Top RB Rankings'
 *                 view_description: 'Running back rankings for current week'
 *                 table_state:
 *                   columns: ['player_name', 'position', 'fantasy_points', 'rush_yards']
 *                   sort: [{ column_id: 'fantasy_points', desc: true }]
 *                   where: [{ column_id: 'position', operator: '=', value: 'RB' }]
 *                   offset: 0
 *                   limit: 50
 *             updateExisting:
 *               summary: Update existing data view
 *               value:
 *                 view_id: 'a1b2c3d4-5678-90ab-cdef-123456789012'
 *                 view_name: 'Updated QB Rankings'
 *                 view_description: 'Updated quarterback rankings with new filters'
 *                 table_state:
 *                   columns: ['player_name', 'position', 'fantasy_points', 'passing_yards']
 *                   sort: [{ column_id: 'passing_yards', desc: true }]
 *                   where: [
 *                     { column_id: 'position', operator: '=', value: 'QB' },
 *                     { column_id: 'fantasy_points', operator: '>', value: 15 }
 *                   ]
 *                   offset: 0
 *                   limit: 25
 *     responses:
 *       '200':
 *         description: Data view created or updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DataView'
 *             example:
 *               view_id: 'a1b2c3d4-5678-90ab-cdef-123456789012'
 *               view_name: 'Top RB Rankings'
 *               view_description: 'Running back rankings for current week'
 *               table_state:
 *                 columns: ['player_name', 'position', 'fantasy_points', 'rush_yards']
 *                 sort: [{ column_id: 'fantasy_points', desc: true }]
 *                 where: [{ column_id: 'position', operator: '=', value: 'RB' }]
 *                 offset: 0
 *                 limit: 50
 *               created_at: '2024-01-15T10:30:00Z'
 *               updated_at: '2024-01-15T10:30:00Z'
 *               user_id: 123
 *       '400':
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidViewName:
 *                 summary: Invalid view name
 *                 value:
 *                   error: 'invalid view_name'
 *               invalidViewDescription:
 *                 summary: Invalid view description
 *                 value:
 *                   error: 'invalid view_description'
 *               invalidTableState:
 *                 summary: Invalid table state
 *                 value:
 *                   error: 'invalid table_state'
 *               invalidViewId:
 *                 summary: Invalid view ID (when updating)
 *                 value:
 *                   error: 'invalid view_id'
 *       '401':
 *         description: Authentication required or unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               noAuth:
 *                 summary: No authentication provided
 *                 value:
 *                   error: 'invalid userId'
 *               notOwner:
 *                 summary: User does not own the data view
 *                 value:
 *                   error: 'invalid userId'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const { view_id, view_name, table_state, view_description, generation_id } =
      req.body

    if (!req.auth || !req.auth.userId) {
      return res.status(401).send({ error: 'invalid userId' })
    }

    const user_id = req.auth ? req.auth.userId : null

    if (validators.view_name_validator(view_name) !== true) {
      return res.status(400).send({ error: 'invalid view_name' })
    }

    if (validators.view_description_validator(view_description) !== true) {
      return res.status(400).send({ error: 'invalid view_description' })
    }

    if (validators.table_state_validator(table_state) !== true) {
      return res.status(400).send({ error: 'invalid table_state' })
    }

    // Resolve to an in-place update of the requester's own saved view, or a
    // "save as new" (fork). A view_id that does not resolve to a row owned by
    // the requester -- a never-persisted client-generated id carried by a
    // shared /u/<hash> short URL, or another user's shared view -- is forked
    // into a new view owned by the requester rather than rejected with
    // "invalid view_id". Saving an opened share link always yields a view the
    // requester owns.
    const existing_view = view_id
      ? await db('user_data_views').where({ view_id }).first()
      : null

    // query_id is taken from the EXISTING ROW, never from the request body. A
    // saved view's backing statement is not a display property the save route
    // may re-point: accepting a client-supplied query_id would let any caller
    // aim any view at any statement, and the fork branch below would then carry
    // that anywhere. It is set exactly once, by the authoring path that also
    // wrote the data_view_queries row.
    //
    // The fork branch carries it FORWARD deliberately. A shared query-backed
    // view saved by a second user must still render, and data_view_queries is
    // ownerless precisely so that reference can be shared -- the statement runs
    // under the sandbox role over allowlisted relations, so a second reader
    // gains nothing they could not already read through the original view.
    const source_query_id = existing_view ? existing_view.query_id : null

    // On a query-backed view, every persisted column id must be an alias the
    // statement projects. The client blocks the picker, but the client is not
    // the control: a saved view mixing an ad-hoc alias with a registry column
    // has no join key between the two, and it fails by rendering an empty
    // table with no error anywhere -- the silent-degradation shape this whole
    // representation exists to avoid. Refuse it by name, here.
    if (source_query_id) {
      const { column_annotations } = await load_data_view_query({
        query_id: source_query_id,
        query_runner: db
      })
      const projected = new Set(Object.keys(column_annotations))
      const foreign = [
        ...(table_state.columns || []),
        ...(table_state.prefix_columns || [])
      ]
        .map((column) =>
          typeof column === 'string' ? column : column && column.column_id
        )
        .filter((column_id) => column_id && !projected.has(column_id))

      if (foreign.length) {
        return res.status(400).send({
          error: `this view is backed by a query, so it cannot carry registry columns: ${foreign.join(', ')}`
        })
      }
    }

    // PROVENANCE IS RESOLVED, NEVER ASSERTED. The client names the generation
    // it is saving; the timestamp and the provider come off that job row. A
    // client-supplied llm_generated_at would be a claim nothing could check,
    // and the field exists precisely so a reader can tell a generated view from
    // a hand-built one.
    //
    // Scoped to the caller's OWN completed job, so naming someone else's
    // generation stamps nothing. An unresolvable id is silently no provenance
    // rather than a 400: a save must not fail because a generation expired
    // while the user was still editing what it produced.
    const generation_provenance = { llm_generated_at: null }
    if (generation_id) {
      const job = await db('data_view_generation_jobs')
        .where({ generation_id, user_id, status: 'completed' })
        .first()
      if (job) {
        generation_provenance.llm_generated_at = job.completed_at
        generation_provenance.llm_inference_provider = job.inference_provider
      }
    }
    // Absent provenance leaves the existing columns ALONE rather than writing
    // NULL over them. Provenance records where a view came from, and a later
    // hand-edit does not make it stop having been generated.
    if (!generation_provenance.llm_generated_at) {
      delete generation_provenance.llm_generated_at
    }

    let result_view_id
    if (existing_view && existing_view.user_id === user_id) {
      await db('user_data_views')
        .where({
          view_id,
          user_id
        })
        .update({
          view_name,
          view_description,
          table_state: JSON.stringify(table_state),
          ...generation_provenance
        })
      result_view_id = view_id
    } else {
      result_view_id = crypto.randomUUID()

      await db('user_data_views').insert({
        view_id: result_view_id,
        view_name,
        view_description,
        table_state: JSON.stringify(table_state),
        query_id: source_query_id,
        user_id,
        ...generation_provenance
      })
    }

    const view = await db('user_data_views')
      .where({
        view_id: result_view_id
      })
      .first()

    res.status(200).send(view)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /data-views/{view_id}:
 *   delete:
 *     summary: Delete a data view
 *     description: |
 *       Deletes a specific data view by its unique identifier.
 *       Only the owner of the data view can delete it.
 *
 *       **Authentication required**: This endpoint requires a valid JWT token.
 *       **Authorization**: User must be the owner of the data view.
 *     tags:
 *       - Data Views
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/viewId'
 *     responses:
 *       '200':
 *         description: Data view deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteResponse'
 *             example:
 *               success: true
 *       '400':
 *         description: Invalid view ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: 'invalid view_id'
 *       '401':
 *         description: Authentication required or unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               noAuth:
 *                 summary: No authentication provided
 *                 value:
 *                   error: 'invalid userId'
 *               notOwner:
 *                 summary: User does not own the data view
 *                 value:
 *                   error: 'invalid userId'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:view_id', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const { view_id } = req.params

    if (!req.auth || !req.auth.userId) {
      return res.status(401).send({ error: 'invalid userId' })
    }

    const user_id = req.auth ? req.auth.userId : null

    const view = await db('user_data_views')
      .where({
        view_id
      })
      .first()

    if (!view) {
      return res.status(400).send({ error: 'invalid view_id' })
    }

    if (view.user_id !== user_id) {
      return res.status(401).send({ error: 'invalid userId' })
    }

    await db.transaction(async (trx) => {
      await trx('user_data_view_favorites').where({ view_id }).del()
      await trx('user_data_view_tags').where({ view_id }).del()
      await trx('user_data_views').where({ view_id, user_id }).del()
    })

    res.status(200).send({ success: true })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /data-views/search:
 *   post:
 *     summary: Search and retrieve data view results
 *     description: |
 *       Executes a data view search query and returns the matching results.
 *       This endpoint is used to retrieve actual data based on the specified
 *       columns, filters, sorting, and other parameters.
 *
 *       **Caching**: Results are cached using Redis for performance. The cache
 *       key is generated based on the query parameters hash.
 *
 *       **Performance**: For large datasets, consider using pagination with
 *       offset and appropriate limits.
 *     tags:
 *       - Data Views
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DataViewSearchRequest'
 *           examples:
 *             basicSearch:
 *               summary: Basic player search
 *               value:
 *                 columns: ['player_name', 'position', 'fantasy_points']
 *                 where: [{ column_id: 'position', operator: '=', value: 'QB' }]
 *                 sort: [{ column_id: 'fantasy_points', desc: true }]
 *                 offset: 0
 *             advancedSearch:
 *               summary: Advanced search with multiple filters
 *               value:
 *                 columns: [
 *                   { column_id: 'player_name' },
 *                   { column_id: 'fantasy_points', params: { week: 4 } },
 *                   { column_id: 'projected_points', params: { week: 5 } }
 *                 ]
 *                 where: [
 *                   { column_id: 'position', operator: 'IN', value: ['QB', 'RB'] },
 *                   { column_id: 'fantasy_points', operator: '>', value: 15 }
 *                 ]
 *                 sort: [
 *                   { column_id: 'fantasy_points', desc: true },
 *                   { column_id: 'player_name', desc: false }
 *                 ]
 *                 offset: 0
 *                 row_axes: ['team']
 *                 prefix_columns: ['player_']
 *     responses:
 *       '200':
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DataViewResults'
 *             examples:
 *               playerResults:
 *                 summary: Player search results
 *                 value:
 *                   - player_name: 'Patrick Mahomes'
 *                     position: 'QB'
 *                     fantasy_points: 24.5
 *                     team: 'KC'
 *                   - player_name: 'Josh Allen'
 *                     position: 'QB'
 *                     fantasy_points: 22.1
 *                     team: 'BUF'
 *                   - player_name: 'Lamar Jackson'
 *                     position: 'QB'
 *                     fantasy_points: 21.8
 *                     team: 'BAL'
 *               emptyResults:
 *                 summary: No matching results
 *                 value: []
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/search/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    // Every key the client sends has to be named here AND forwarded to
    // `get_data_view_results` below -- an omitted one silently takes that
    // function's default rather than failing. `row_grain` was missing from both
    // lists, so a team-grain request was answered at player grain.
    const {
      where,
      columns,
      sort,
      offset,
      prefix_columns,
      row_axes,
      row_grain
    } = req.body

    // This route sits ahead of the blanket auth guard and stays open to
    // anonymous callers; the viewer is read only so a viewer-scoped column can
    // tell whose private roster state it may disclose.
    const user_id = req.auth ? req.auth.userId : null

    const cache_key = `/data-views/${get_data_view_hash({
      where,
      columns,
      sort,
      offset,
      prefix_columns,
      row_axes,
      row_grain,
      user_id
    })}`
    const cached_result = await redis_cache.get(cache_key)

    if (cached_result) {
      // The cache holds the canonical { data_view_results, data_view_metadata,
      // data_view_fields } shape shared with the websocket socket and the export
      // route.
      return res.send(cached_result.data_view_results)
    }

    // Shared executor: one admission and timeout policy across every path. The
    // executor owns the cache write (warm keys return above); the timeout is
    // derived from auth here too, so a signed-in /search gets the same 5-minute
    // budget the socket gives it instead of the global 40s default.
    const { data_view_results } = await execute_data_view_request({
      request_id: null,
      params: {
        where,
        columns,
        sort,
        offset,
        prefix_columns,
        row_axes,
        row_grain
      },
      user_id,
      path: 'search',
      cache_key
    })

    res.send(data_view_results)
  } catch (error) {
    logger(error)
    if (error.is_invalid_request) {
      return res.status(400).send({ error: error.message })
    }
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /data-views/debug:
 *   post:
 *     tags:
 *       - Data Views
 *     summary: Generate and optionally execute a data view query for debugging
 *     description: |
 *       Returns the generated SQL, executed results, and metadata for a data view request.
 *       Bypasses the redis cache. Accepts either an explicit `table_state` body or a `short_url`
 *       (full URL, `/u/{hash}`, or a bare 32-character hash) which is resolved against the `urls`
 *       table. Requires admin authentication (`userId === 1`) because the response exposes raw SQL
 *       and schema details.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               table_state:
 *                 type: object
 *                 description: Explicit table state. Mutually exclusive with `short_url`.
 *               short_url:
 *                 type: string
 *                 description: Short URL, `/u/{hash}` path, or bare 32-character hash.
 *               execute:
 *                 type: boolean
 *                 default: true
 *                 description: When false, return the generated SQL without executing it.
 *               beautify:
 *                 type: boolean
 *                 default: true
 *                 description: Format SQL output via prettier-sql.
 *               limit_override:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 2000
 *                 description: Override the table state's limit (useful for capping execution).
 *     responses:
 *       '200':
 *         description: Generated query and (optionally) executed results.
 *       '400':
 *         description: Invalid request body or unresolvable short URL.
 *       '401':
 *         description: Admin authentication required.
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/debug/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    if (!req.auth || req.auth.userId !== 1) {
      return res.status(401).send({ error: 'Admin authentication required' })
    }

    const {
      table_state: explicit_table_state,
      short_url,
      execute = true,
      beautify = true,
      limit_override
    } = req.body || {}

    if (!explicit_table_state && !short_url) {
      return res
        .status(400)
        .send({ error: 'table_state or short_url required' })
    }

    let table_state
    let source
    if (explicit_table_state) {
      table_state = explicit_table_state
      source = { type: 'table_state' }
    } else {
      const resolved = await resolve_table_state_from_short_url(short_url)
      table_state = resolved.table_state
      source = { type: 'short_url', hash: resolved.hash, url: resolved.url }
    }

    if (limit_override) {
      table_state = { ...table_state, limit: limit_override }
    }

    // Admin-only route, but the viewer still has to travel with the request or
    // the generated SQL would not be the SQL this admin's own search produces.
    table_state = { ...table_state, user_id: req.auth.userId }

    const generate_started_at = Date.now()
    const { query, data_view_metadata } =
      await get_data_view_results_query(table_state)
    let sql = query.toString()
    const query_bindings =
      typeof query.toSQL === 'function' ? query.toSQL().bindings : null
    if (beautify) {
      sql = await format_sql(sql, { parser: 'sql', language: 'postgresql' })
    }
    const generate_ms = Date.now() - generate_started_at

    let results = null
    let execute_ms = null
    if (execute) {
      // Through the shared executor for admission + instrumentation, but with
      // skip_cache -- this route deliberately bypasses redis, and the executor's
      // admission re-check and write must not defeat that contract.
      const execute_started_at = Date.now()
      const { data_view_results } = await execute_data_view_request({
        request_id: null,
        params: table_state,
        user_id: table_state.user_id,
        path: 'debug',
        cache_key: `/data-views/debug/${get_data_view_hash({
          ...table_state,
          user_id: table_state.user_id
        })}`,
        skip_cache: true
      })
      execute_ms = Date.now() - execute_started_at
      results = data_view_results
    }

    return res.send({
      source,
      table_state,
      query: sql,
      query_bindings,
      metadata: data_view_metadata,
      results,
      timing: { generate_ms, execute_ms }
    })
  } catch (error) {
    logger(error)
    if (error.is_invalid_request) {
      return res.status(400).send({ error: error.message })
    }
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /data-views/export/{view_id}/{export_format}:
 *   get:
 *     summary: Export data view results
 *     description: |
 *       Exports the results of a specific data view in the requested format.
 *       The data view configuration (table state) is used to generate the results,
 *       which are then formatted and returned as a downloadable file.
 *
 *       **Supported formats**: CSV, JSON, Markdown, HTML
 *
 *       **Caching**: Results are cached for performance unless `ignore_cache=true`
 *       is specified. Cache expiration is handled automatically.
 *
 *       **File naming**: Exported files are named using the pattern:
 *       `{view_name}-{timestamp}.{format}`
 *
 *       **Pagination**: `limit` and `offset` page the result set, and the
 *       response headers carry what a client needs to walk it —
 *       `x-total-count` (rows before LIMIT), `x-data-view-offset`,
 *       `x-data-view-limit` and `x-data-view-returned-rows`.
 *
 *       **Row cap**: a property of the caller — 100000 rows anonymously, and
 *       `users.data_view_export_max_rows` for a signed-in caller or one
 *       presenting an `x-api-key` header, which may be uncapped. A `limit`
 *       above the caller's cap is a 400, never a silent truncation. Results
 *       above the interactive ceiling are not cached in either direction.
 *     tags:
 *       - Data Views
 *     parameters:
 *       - $ref: '#/components/parameters/viewId'
 *       - $ref: '#/components/parameters/exportFormat'
 *       - $ref: '#/components/parameters/ignoreCache'
 *       - $ref: '#/components/parameters/exportLimit'
 *       - $ref: '#/components/parameters/exportOffset'
 *       - $ref: '#/components/parameters/exportApiKey'
 *     responses:
 *       '200':
 *         description: Data view exported successfully
 *         headers:
 *           x-total-count:
 *             schema:
 *               type: integer
 *             description: 'Total rows matching the view before LIMIT is applied'
 *           x-data-view-offset:
 *             schema:
 *               type: integer
 *             description: 'Offset this response starts at'
 *           x-data-view-limit:
 *             schema:
 *               type: integer
 *             description: 'Row limit applied; absent when the export was unbounded'
 *           x-data-view-returned-rows:
 *             schema:
 *               type: integer
 *             description: 'Rows in this response'
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *             example: |
 *               player_name,position,fantasy_points,team
 *               Patrick Mahomes,QB,24.5,KC
 *               Josh Allen,QB,22.1,BUF
 *               Lamar Jackson,QB,21.8,BAL
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DataViewResults'
 *             example:
 *               - player_name: 'Patrick Mahomes'
 *                 position: 'QB'
 *                 fantasy_points: 24.5
 *                 team: 'KC'
 *               - player_name: 'Josh Allen'
 *                 position: 'QB'
 *                 fantasy_points: 22.1
 *                 team: 'BUF'
 *           text/markdown:
 *             schema:
 *               type: string
 *               format: binary
 *             example: |
 *               | player_name | position | fantasy_points | team |
 *               | --- | --- | --- | --- |
 *               | Patrick Mahomes | QB | 24.5 | KC |
 *               | Josh Allen | QB | 22.1 | BUF |
 *               | Lamar Jackson | QB | 21.8 | BAL |
 *           text/html:
 *             schema:
 *               type: string
 *               format: binary
 *               description: 'HTML page with styled table containing the data'
 *       '400':
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidViewId:
 *                 summary: Invalid view ID
 *                 value:
 *                   error: 'invalid view_id'
 *               invalidFormat:
 *                 summary: Invalid export format
 *                 value:
 *                   error: 'invalid export_format'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/export/:view_id/:export_format', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const { view_id, export_format } = req.params
    const ignore_cache = req.query.ignore_cache === 'true'

    // An API key authenticates its owner for this route, so a script exporting
    // with a key sees exactly what its owner sees in the browser. The JWT wins
    // when both are presented: a header must not be able to switch a signed-in
    // caller onto another identity.
    const api_key = await resolve_export_api_key({ headers: req.headers })
    const user_id = req.auth
      ? req.auth.userId
      : api_key
        ? api_key.user_id
        : null

    // The row ceiling belongs to the USER (users.data_view_export_max_rows,
    // where NULL means no ceiling), so a whitelisted user gets it from the
    // browser as well as from a script. Anonymous callers get the platform
    // default.
    const max_limit = await resolve_export_max_limit({ user_id })

    const parsed_limit = parse_positive_integer_param(req.query.limit)
    if (parsed_limit === INVALID_PARAM) {
      return res.status(400).send({ error: 'invalid limit' })
    }
    const parsed_offset = parse_non_negative_integer_param(req.query.offset)
    if (parsed_offset === INVALID_PARAM) {
      return res.status(400).send({ error: 'invalid offset' })
    }

    // Refuse a limit above the ceiling rather than silently clamping to it: a
    // clamped page looks like a complete one to a paginating client, which then
    // walks the result set with a stride larger than the pages it receives and
    // skips rows without any error to notice.
    if (
      max_limit !== null &&
      parsed_limit !== null &&
      parsed_limit > max_limit
    ) {
      return res.status(400).send({
        error: `limit exceeds the maximum of ${max_limit} for this caller`
      })
    }

    // An absent limit means "the ceiling", not "unbounded". Only a key with no
    // max_export_rows produces a null limit and therefore a query with no LIMIT
    // clause.
    const limit = parsed_limit === null ? max_limit : parsed_limit

    // Validate view_id exists
    const view = await db('user_data_views')
      .where({
        view_id
      })
      .first()

    if (!view) {
      return res.status(400).send({ error: 'invalid view_id' })
    }

    // Validate export_format
    const valid_formats = ['csv', 'json', 'md', 'html']
    if (!valid_formats.includes(export_format)) {
      return res.status(400).send({ error: 'invalid export_format' })
    }

    const { table_state } = view

    // An explicit offset wins over the saved view's own; without one the view's
    // offset stands, which is what the route did before pagination existed.
    const offset = parsed_offset === null ? table_state.offset : parsed_offset

    // The params the query actually runs with, and the ones the cache key
    // hashes. `limit` and `offset` were omitted from the key until pagination
    // landed, so every export of a view shared ONE entry regardless of how many
    // rows it asked for or where it started -- a 5,000-row page returned the
    // 500-row body some other caller had written, and page 2 returned page 1.
    const query_params = {
      where: table_state.where,
      columns: table_state.columns,
      sort: table_state.sort,
      offset,
      prefix_columns: table_state.prefix_columns,
      row_axes: table_state.row_axes,
      row_grain: table_state.row_grain,
      limit,
      // The export route is the ONE path that loads a persisted table_state
      // server-side, which makes it the one path that would otherwise index the
      // registry resolver with an ad-hoc column_id and raise a TypeError as a
      // 500 rather than render. Carrying query_id here is what routes it to the
      // query executor instead -- and it also separates its cache key, which the
      // registry key cannot do for two statements projecting the same aliases.
      ...(view.query_id ? { query_id: view.query_id } : {})
    }

    // Generate cache key
    const cache_key = `/data-views/${get_data_view_hash({
      ...query_params,
      user_id
    })}`

    // A bulk export is not cached in either direction. The value is serialized
    // whole on every read and write of a redis instance shared with the
    // interactive paths, so a six-figure export would evict the working set to
    // serve a request that is not going to repeat. Everything a browser table
    // could have asked for still caches exactly as before.
    const use_cache =
      !ignore_cache && limit !== null && limit <= EXPORT_CACHE_MAX_ROWS

    let data_view_results
    let total_count = null

    if (use_cache) {
      const cache_value = await redis_cache.get(cache_key)
      if (cache_value && cache_value.data_view_results) {
        data_view_results = cache_value.data_view_results
        total_count = read_total_count(cache_value.data_view_metadata)
      }
    }

    if (!data_view_results) {
      // If not cached or ignore_cache is true, run through the shared executor.
      // The executor owns the cache write; ignore_cache is carried through as
      // skip_cache so the executor's admission re-check does not defeat it.
      const result = await execute_data_view_request({
        request_id: null,
        params: query_params,
        user_id,
        path: 'export',
        cache_key,
        max_limit,
        // A bulk export outruns the viewer-derived statement_timeout -- an
        // anonymous caller gets 40s, which a six-figure page will not finish in.
        // Only a key holder can reach this, and only for the rows the key allows.
        timeout_ms: api_key ? EXPORT_API_KEY_TIMEOUT_MS : null,
        skip_cache: !use_cache
      })
      data_view_results = result.data_view_results
      total_count = read_total_count(result.data_view_metadata)
    }

    // Pagination metadata as headers, so every format carries it and no format's
    // body shape changes. A client pages by walking offset until the rows
    // returned run out or offset + returned reaches x-total-count.
    res.setHeader('x-data-view-offset', String(offset || 0))
    res.setHeader(
      'x-data-view-returned-rows',
      String((data_view_results || []).length)
    )
    if (limit !== null) {
      res.setHeader('x-data-view-limit', String(limit))
    }
    if (total_count !== null) {
      res.setHeader('x-total-count', String(total_count))
    }
    res.setHeader(
      'Access-Control-Expose-Headers',
      'x-data-view-offset, x-data-view-limit, x-data-view-returned-rows, x-total-count'
    )

    // Format the results based on export_format
    let formatted_results
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '')
    const file_name = `${view.view_name}-${timestamp}`

    // Resolve the hidden week-grain participation signal into the exported cells
    // (0 / BYE / blank) and strip the reserved participation_status column before
    // any format is produced (csv/md/html via normalize, json from the raw rows).
    data_view_results = apply_participation_to_export(data_view_results)

    // Normalize data once for all export formats
    const { fields, normalized_results } =
      normalize_data_view_results(data_view_results)

    switch (export_format) {
      case 'csv': {
        formatted_results = convert_to_csv({
          rows: normalized_results,
          columns: fields
        })
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${file_name}.csv"`
        )
        break
      }
      case 'json':
        // For JSON, we can return the original data as-is
        formatted_results = JSON.stringify(data_view_results)
        res.setHeader('Content-Type', 'application/json')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${file_name}.json"`
        )
        break
      case 'md':
        formatted_results = convert_to_markdown_table(
          normalized_results,
          fields
        )
        res.setHeader('Content-Type', 'text/markdown')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${file_name}.md"`
        )
        break
      case 'html':
        formatted_results = convert_to_html_table(
          normalized_results,
          fields,
          view.view_name
        )
        res.setHeader('Content-Type', 'text/html')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${file_name}.html"`
        )
        break
    }

    res.send(formatted_results)
  } catch (error) {
    logger(error)
    if (error.is_invalid_request) {
      return res.status(400).send({ error: error.message })
    }
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/param-option-counts', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { table_state, target_param_name } = req.body || {}

    if (!target_param_name || typeof target_param_name !== 'string') {
      return res.status(400).send({ error: 'target_param_name is required' })
    }
    if (
      !Object.prototype.hasOwnProperty.call(
        nfl_plays_column_params,
        target_param_name
      )
    ) {
      return res
        .status(400)
        .send({ error: `unknown target_param_name: ${target_param_name}` })
    }

    const other_params = collect_other_params({
      table_state,
      target_param_name
    })

    const cache_key = `param-option-counts:${target_param_name}:${get_stats_column_param_key(
      { params: other_params }
    )}`
    const cached_result = await redis_cache.get(cache_key)
    if (cached_result) {
      return res.send(cached_result)
    }

    const result = await get_param_option_counts({
      table_state,
      target_param_name
    })

    if (result && result.counts && Object.keys(result.counts).length > 0) {
      await redis_cache.set(cache_key, result, 600) // 10 minutes (redis EX is seconds)
    }

    res.send(result)
  } catch (error) {
    logger(error)
    if (error.is_invalid_request) {
      return res.status(400).send({ error: error.message })
    }
    res.status(500).send({ error: error.toString() })
  }
})

// The generation agent's delivery door, and the ONLY write league accepts from
// a tenant container.
//
// UNAUTHENTICATED BY JWT, ON PURPOSE. The container holds no league session and
// must not: its whole design is that it carries a read-only database role and
// nothing else. What admits a caller here is the pairing of a `thread_id` base
// minted and league recorded, with a job still in a live state. The client
// never learns a thread_id (project_generation_job withholds it), so only the
// session base dispatched for this job can satisfy it, and only once.
//
// EVERYTHING IN THE BODY IS AGENT-CONTROLLED, so the emission is re-validated
// here rather than trusted. `emit` inside the container validates too; that
// check is for the agent's benefit, this one is the contract.
router.post('/generation-emission', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { thread_id, emission, tool_calls = [] } = req.body || {}

    if (!thread_id || typeof thread_id !== 'string') {
      return res.status(400).send({ error: 'thread_id is required' })
    }

    const job = await get_generation_job_by_thread_id(thread_id)

    // ONE refusal for "no such thread", "not a generation thread" and "that job
    // already finished". Distinguishing them would make this an oracle for
    // which thread ids exist, and the caller can do nothing different with the
    // three answers.
    if (!job || !LIVE_STATUSES.includes(job.status)) {
      return res
        .status(404)
        .send({ error: 'no live generation is accepting an emission' })
    }

    const { ok, branch, errors } = validate_emission({
      emission,
      tool_calls
    })

    if (!ok) {
      // 400 with the errors, because the agent is the caller and the errors are
      // the only thing that lets it emit something better. The job is left
      // RUNNING rather than failed: a rejected emission is a failed claim, not
      // a dead run, and the agent still has its deadline to fix it.
      return res.status(400).send({ error: 'emission rejected', errors })
    }

    await complete_generation_job({
      generation_id: job.generation_id,
      result: emission,
      generation_branch: branch
    })

    res.send({ generation_id: job.generation_id, branch })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

// The generation agent's progress beacon.
//
// AUTHENTICATED EXACTLY AS THE EMISSION IS, by a thread_id base minted and
// league recorded against a job still in a live state. See the emission route
// above; the pairing is unguessable for the same reason and the client never
// learns a thread_id.
//
// WHAT IT DELIBERATELY DOES NOT DO. It writes no job-row column, completes
// nothing, and cannot change a run's outcome -- it moves a Redis key with a
// twenty-minute expiry and answers. So the worst a caller who somehow forged a
// thread_id could do is make a status line count wrong, which is why this needs
// none of the re-validation the emission route carries.
//
// 200 EVEN WHEN THE JOB IS GONE. The beacon fires before every tool call and
// the container swallows every failure, so a 404 for a finished run would be a
// refusal nobody reads, logged on both ends, for a condition that is ordinary
// -- an agent still working through a tool when the deadline sweep closed its
// row. `recorded` says which happened for anyone who does look.
router.post('/generation-progress', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { thread_id, tool } = req.body || {}

    if (!thread_id || typeof thread_id !== 'string') {
      return res.status(400).send({ error: 'thread_id is required' })
    }
    if (!tool || typeof tool !== 'string') {
      return res.status(400).send({ error: 'tool is required' })
    }

    const job = await get_generation_job_by_thread_id(thread_id)
    if (!job || !LIVE_STATUSES.includes(job.status)) {
      return res.send({ recorded: false })
    }

    const progress = await record_generation_progress({
      generation_id: job.generation_id,
      tool
    })

    res.send({ recorded: true, step_count: progress.step_count })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

// ======================================
// View Organization endpoints (continued — favorites and tags mutation)
// ======================================

/**
 * POST /data-views/:view_id/favorite
 * Idempotently add a view to the user's favorites. Returns 200 even if already favorited.
 */
router.post('/:view_id/favorite', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).send({ error: 'invalid userId' })
    }
    const user_id = req.auth.userId
    const { view_id } = req.params
    await toggle_favorite({ user_id, view_id, action: 'insert', db })
    res.status(200).send({ success: true })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * DELETE /data-views/:view_id/favorite
 * Remove a view from the user's favorites. Idempotent (200 if not favorited).
 */
router.delete('/:view_id/favorite', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).send({ error: 'invalid userId' })
    }
    const user_id = req.auth.userId
    const { view_id } = req.params
    await toggle_favorite({ user_id, view_id, action: 'delete', db })
    res.status(200).send({ success: true })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * POST /data-views/:view_id/tags
 * Add a user-authored tag to a view. Idempotent. Body: { tag_name }
 * Sanitizes tag_name and promotes existing source='llm' rows to source='user'.
 */
router.post('/:view_id/tags', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).send({ error: 'invalid userId' })
    }
    const user_id = req.auth.userId
    const { view_id } = req.params
    const { tag_name } = req.body || {}
    const result = await add_user_tag({ user_id, view_id, tag_name, db })
    res.status(200).send({ success: true, tag_name: result.tag_name })
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).send({ error: err.message })
    }
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * DELETE /data-views/:view_id/tags/:tag_name
 * Remove a user-authored tag from a view. Only removes source='user' rows.
 * LLM-generated tags (source='llm') are unaffected.
 */
router.delete('/:view_id/tags/:tag_name', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).send({ error: 'invalid userId' })
    }
    const user_id = req.auth.userId
    const { view_id, tag_name } = req.params
    await remove_user_tag({ user_id, view_id, tag_name, db })
    res.status(200).send({ success: true })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
