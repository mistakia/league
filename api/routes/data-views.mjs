import express from 'express'
import crypto from 'crypto'
import { validators, get_data_view_results, redis_cache } from '#libs-server'
import get_data_view_hash from '#libs-server/data-views/get-data-view-hash.mjs'
import convert_to_csv from '#libs-shared/convert-to-csv.mjs'

const router = express.Router()

function convert_to_markdown_table(objArray) {
  const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray

  if (!array.length) {
    return ''
  }

  // Get column headers from first object
  const headers = Object.keys(array[0])

  // Build markdown table header
  let markdown = '| ' + headers.join(' | ') + ' |\n'

  // Add separator row
  markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n'

  // Add data rows
  for (const row of array) {
    const values = headers.map((header) => {
      const value = row[header]
      // Escape pipe characters in cell values
      return String(value ?? '').replace(/\|/g, '\\|')
    })
    markdown += '| ' + values.join(' | ') + ' |\n'
  }

  return markdown
}

function convert_to_html_table(objArray, view_name) {
  const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray

  if (!array.length) {
    return '<html><body><h1>No data available</h1></body></html>'
  }

  const headers = Object.keys(array[0])
  const title = view_name || 'Data Export'
  
  return `<!DOCTYPE html>
<html><head><title>${title}</title></head><body>
<h1>${title}</h1>
<table border="1">
<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
${array.map(row => `<tr>${headers.map(h => `<td>${String(row[h] ?? '')}</td>`).join('')}</tr>`).join('')}
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
 *         splits:
 *           type: array
 *           items:
 *             type: string
 *           description: 'Split configurations for data grouping'
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
 *         splits:
 *           type: array
 *           items:
 *             type: string
 *           description: 'Split configurations for data grouping'
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

    if (view_id) {
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
    } else {
      const view_id = crypto.randomUUID()

      await db('user_data_views').insert({
        view_id,
        view_name,
        view_description,
        table_state: JSON.stringify(table_state),
        user_id
      })
    }

    const view = await db('user_data_views')
      .where({
        view_name,
        user_id
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

    await db('user_data_views')
      .where({
        view_id,
        user_id
      })
      .del()

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
 *                 splits: ['team']
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
    const { where, columns, sort, offset, prefix_columns, splits } = req.body

    const cache_key = `/data-views/${get_data_view_hash({
      where,
      columns,
      sort,
      offset,
      prefix_columns,
      splits
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
        splits
      })

    if (data_view_results && data_view_results.length) {
      const cache_ttl = data_view_metadata.cache_ttl || 1000 * 60 * 60 * 12 // 12 hours
      await redis_cache.set(cache_key, data_view_results, cache_ttl)
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
      splits: table_state.splits
    })}`

    let data_view_results
    let data_view_metadata

    if (!ignore_cache) {
      const cache_value = await redis_cache.get(cache_key)
      data_view_results = cache_value.data_view_results
      data_view_metadata = cache_value.data_view_metadata
    }

    if (!data_view_results) {
      // If not cached or ignore_cache is true, get the results
      const result = await get_data_view_results({
        where: table_state.where,
        columns: table_state.columns,
        sort: table_state.sort,
        offset: table_state.offset,
        prefix_columns: table_state.prefix_columns,
        splits: table_state.splits,
        limit
      })
      data_view_results = result.data_view_results
      data_view_metadata = result.data_view_metadata

      // Cache the unformatted results
      if (data_view_results && data_view_results.length && !limit) {
        const cache_ttl = data_view_metadata.cache_ttl || 1000 * 60 * 60 * 12 // 12 hours
        await redis_cache.set(
          cache_key,
          {
            data_view_results,
            data_view_metadata
          },
          cache_ttl
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

    switch (export_format) {
      case 'csv': {
        const header = {}
        for (const field of Object.keys(data_view_results[0])) {
          header[field] = field
        }
        const csv_data = [header, ...data_view_results]
        formatted_results = convert_to_csv(csv_data)
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${file_name}.csv"`
        )
        break
      }
      case 'json':
        formatted_results = JSON.stringify(data_view_results)
        res.setHeader('Content-Type', 'application/json')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${file_name}.json"`
        )
        break
      case 'md':
        formatted_results = convert_to_markdown_table(data_view_results)
        res.setHeader('Content-Type', 'text/markdown')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${file_name}.md"`
        )
        break
      case 'html':
        formatted_results = convert_to_html_table(data_view_results, view.view_name)
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

export default router
