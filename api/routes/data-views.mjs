import express from 'express'
import crypto from 'crypto'
import {
  validators,
  get_data_view_results,
  get_data_view_results_query,
  resolve_table_state_from_short_url,
  format_sql,
  redis_cache
} from '#libs-server'
import get_data_view_hash from '#libs-server/data-views/get-data-view-hash.mjs'
import get_param_option_counts, {
  collect_other_params
} from '#libs-server/data-views/get-param-option-counts.mjs'
import get_stats_column_param_key from '#libs-server/data-views/get-stats-column-param-key.mjs'
import { nfl_plays_column_params } from '#libs-shared'
import convert_to_csv from '#libs-shared/convert-to-csv.mjs'
import { render_participation_null } from '#libs-shared/data-views/participation-cell.mjs'
import load_view_organization from '#libs-server/view-organization/load-view-organization.mjs'
import add_user_tag from '#libs-server/view-organization/add-user-tag.mjs'
import remove_user_tag from '#libs-server/view-organization/remove-user-tag.mjs'
import toggle_favorite from '#libs-server/view-organization/toggle-favorite.mjs'

const router = express.Router()

const PARTICIPATION_STATUS_KEY = 'participation_status'

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
        has_participation && value == null && numeric_fields.has(field)
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
 *       description: 'Maximum number of records to export'
 *       example: 1000
 *
 *     userId:
 *       name: user_id
 *       in: query
 *       required: false
 *       schema:
 *         type: integer
 *       description: 'Filter data views by user ID'
 *       example: 123
 *
 *     username:
 *       name: username
 *       in: query
 *       required: false
 *       schema:
 *         type: string
 *       description: 'Filter data views by username'
 *       example: 'johndoe'
 */

/**
 * @swagger
 * /data-views:
 *   get:
 *     summary: List data views
 *     description: |
 *       Retrieves a list of user data views. Can be filtered by user ID or username.
 *       Data views are custom table configurations that allow users to create, save,
 *       and share specific data queries with custom columns, filters, and sorting.
 *     tags:
 *       - Data Views
 *     parameters:
 *       - $ref: '#/components/parameters/userId'
 *       - $ref: '#/components/parameters/username'
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
    const { user_id, username } = req.query
    const user_ids = []

    if (username) {
      const user = await db('users')
        .where({
          username
        })
        .first()
      if (user) {
        user_ids.push(user.id)
      }
    }

    if (user_id) {
      user_ids.push(user_id)
    }

    const query = db('user_data_views')
      .select('user_data_views.*', 'users.username as view_username')
      .leftJoin('users', 'user_data_views.user_id', 'users.id')

    if (user_ids.length) {
      query.whereIn('user_data_views.user_id', user_ids)
    }

    const views = await query
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
    const { view_id, view_name, table_state, view_description } = req.body

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
          table_state: JSON.stringify(table_state)
        })
      result_view_id = view_id
    } else {
      result_view_id = crypto.randomUUID()

      await db('user_data_views').insert({
        view_id: result_view_id,
        view_name,
        view_description,
        table_state: JSON.stringify(table_state),
        user_id
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
    const { where, columns, sort, offset, prefix_columns, row_axes } = req.body

    const cache_key = `/data-views/${get_data_view_hash({
      where,
      columns,
      sort,
      offset,
      prefix_columns,
      row_axes
    })}`
    const cached_result = await redis_cache.get(cache_key)

    if (cached_result) {
      return res.send(cached_result)
    }

    const { data_view_results, data_view_metadata } =
      await get_data_view_results({
        where,
        columns,
        sort,
        offset,
        prefix_columns,
        row_axes
      })

    if (data_view_results && data_view_results.length) {
      const cache_ttl = data_view_metadata.cache_ttl || 1000 * 60 * 60 * 12 // 12 hours (ms)
      await redis_cache.set(
        cache_key,
        data_view_results,
        Math.round(cache_ttl / 1000) // redis EX is seconds; cache_ttl is ms
      )
      if (data_view_metadata.cache_expire_at) {
        await redis_cache.expire_at(
          cache_key,
          data_view_metadata.cache_expire_at
        )
      }
    }

    res.send(data_view_results)
  } catch (error) {
    logger(error)
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
      const execute_started_at = Date.now()
      const { data_view_results } = await get_data_view_results(table_state)
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
 *       **Performance**: Use the `limit` parameter to control the number of
 *       records exported for large datasets.
 *     tags:
 *       - Data Views
 *     parameters:
 *       - $ref: '#/components/parameters/viewId'
 *       - $ref: '#/components/parameters/exportFormat'
 *       - $ref: '#/components/parameters/ignoreCache'
 *       - $ref: '#/components/parameters/exportLimit'
 *     responses:
 *       '200':
 *         description: Data view exported successfully
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
 *             description: 'HTML page with styled table containing the data'
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
    const limit = req.query.limit ? Number(req.query.limit) || null : null

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

    // Generate cache key
    const cache_key = `/data-views/${get_data_view_hash({
      where: table_state.where,
      columns: table_state.columns,
      sort: table_state.sort,
      offset: table_state.offset,
      prefix_columns: table_state.prefix_columns,
      row_axes: table_state.row_axes
    })}`

    let data_view_results
    let data_view_metadata

    if (!ignore_cache) {
      const cache_value = await redis_cache.get(cache_key)
      if (cache_value && cache_value.data_view_results) {
        data_view_results = cache_value.data_view_results
        data_view_metadata = cache_value.data_view_metadata
      }
    }

    if (!data_view_results) {
      // If not cached or ignore_cache is true, get the results
      const result = await get_data_view_results({
        where: table_state.where,
        columns: table_state.columns,
        sort: table_state.sort,
        offset: table_state.offset,
        prefix_columns: table_state.prefix_columns,
        row_axes: table_state.row_axes,
        limit
      })
      data_view_results = result.data_view_results
      data_view_metadata = result.data_view_metadata

      // Cache the unformatted results
      if (data_view_results && data_view_results.length && !limit) {
        const cache_ttl = data_view_metadata.cache_ttl || 1000 * 60 * 60 * 12 // 12 hours (ms)
        await redis_cache.set(
          cache_key,
          {
            data_view_results,
            data_view_metadata
          },
          Math.round(cache_ttl / 1000) // redis EX is seconds; cache_ttl is ms
        )

        if (data_view_metadata.cache_expire_at) {
          await redis_cache.expire_at(
            cache_key,
            data_view_metadata.cache_expire_at
          )
        }
      }
    }

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
        // Create header object with all fields
        const header = {}
        for (const field of fields) {
          header[field] = field
        }

        const csv_data = [header, ...normalized_results]
        formatted_results = convert_to_csv(csv_data)
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
