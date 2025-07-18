import express from 'express'
import Validator from 'fastest-validator'

const router = express.Router()
const v = new Validator({ haltOnFirstError: true })

const user_id_schema = { type: 'number', positive: true, integer: true }
const limit_schema = {
  type: 'number',
  positive: true,
  integer: true,
  min: 1,
  max: 1000,
  optional: true
}
const offset_schema = {
  type: 'number',
  integer: true,
  min: 0,
  optional: true
}
const placed_before_schema = {
  type: 'number',
  positive: true,
  integer: true,
  optional: true
}
const placed_after_schema = {
  type: 'number',
  positive: true,
  integer: true,
  optional: true
}
const wager_type_schema = {
  type: 'array',
  items: { type: 'enum', values: ['SINGLE', 'PARLAY', 'ROUND_ROBIN'] },
  optional: true
}
const min_selection_count_schema = {
  type: 'number',
  positive: true,
  integer: true,
  min: 1,
  max: 12,
  optional: true
}
const max_selection_count_schema = {
  type: 'number',
  positive: true,
  integer: true,
  min: 1,
  max: 12,
  optional: true
}
const min_selection_lost_count_schema = {
  type: 'number',
  positive: true,
  integer: true,
  min: 1,
  max: 12,
  optional: true
}
const max_selection_lost_count_schema = {
  type: 'number',
  positive: true,
  integer: true,
  min: 1,
  max: 12,
  optional: true
}
const wager_status_schema = {
  type: 'array',
  items: { type: 'enum', values: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'] },
  optional: true
}

const query_params_validator = v.compile({
  user_id: user_id_schema,
  limit: limit_schema,
  offset: offset_schema,
  placed_before: placed_before_schema,
  placed_after: placed_after_schema,
  wager_type: wager_type_schema,
  min_selection_count: min_selection_count_schema,
  max_selection_count: max_selection_count_schema,
  min_selection_lost_count: min_selection_lost_count_schema,
  max_selection_lost_count: max_selection_lost_count_schema,
  wager_status: wager_status_schema
})

/**
 * @swagger
 * /api/wagers/{user_id}:
 *   get:
 *     tags:
 *       - Wagers
 *     summary: Get user betting wagers
 *     description: |
 *       Retrieves betting wagers for a specific user with comprehensive filtering options.
 *       Supports filtering by date range, wager type, selection counts, and status.
 *
 *       **Privacy**: When accessing another user's wagers, only public wagers are returned.
 *       Users can see all their own wagers (public and private).
 *
 *       **Pagination**: Results are paginated with configurable limit and offset.
 *
 *       **Filtering**: Multiple filters can be combined for precise results.
 *     parameters:
 *       - name: user_id
 *         in: path
 *         required: true
 *         description: User ID to retrieve wagers for
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 123
 *       - name: limit
 *         in: query
 *         description: Maximum number of wagers to return
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 1000
 *         example: 100
 *       - name: offset
 *         in: query
 *         description: Number of wagers to skip (for pagination)
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         example: 0
 *       - name: placed_before
 *         in: query
 *         description: Only return wagers placed before this Unix timestamp
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 1640995200
 *       - name: placed_after
 *         in: query
 *         description: Only return wagers placed after this Unix timestamp
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 1640908800
 *       - name: wager_type
 *         in: query
 *         description: Filter by wager type (can be array for multiple types)
 *         schema:
 *           oneOf:
 *             - type: string
 *               enum: [SINGLE, PARLAY, ROUND_ROBIN]
 *             - type: array
 *               items:
 *                 type: string
 *                 enum: [SINGLE, PARLAY, ROUND_ROBIN]
 *         style: form
 *         explode: true
 *         example: PARLAY
 *       - name: min_selection_count
 *         in: query
 *         description: Minimum number of selections in the wager
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         example: 2
 *       - name: max_selection_count
 *         in: query
 *         description: Maximum number of selections in the wager
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         example: 6
 *       - name: min_selection_lost_count
 *         in: query
 *         description: Minimum number of lost selections in the wager
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         example: 1
 *       - name: max_selection_lost_count
 *         in: query
 *         description: Maximum number of lost selections in the wager
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         example: 3
 *       - name: wager_status
 *         in: query
 *         description: Filter by wager status (can be array for multiple statuses)
 *         schema:
 *           oneOf:
 *             - type: string
 *               enum: [OPEN, WON, LOST, PUSH, CANCELLED]
 *             - type: array
 *               items:
 *                 type: string
 *                 enum: [OPEN, WON, LOST, PUSH, CANCELLED]
 *         style: form
 *         explode: true
 *         example: WON
 *     responses:
 *       200:
 *         description: List of user wagers matching the filter criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlacedWager'
 *             examples:
 *               successful_parlay:
 *                 summary: Successful parlay wager
 *                 value:
 *                   - id: 12345
 *                     userid: 123
 *                     wager_type: PARLAY
 *                     placed_at: 1640995200
 *                     bet_count: 1
 *                     selection_count: 3
 *                     selection_lost: 0
 *                     status: WON
 *                     bet_wager_amount: 50.00
 *                     total_wager_amount: 50.00
 *                     wager_returned_amount: 175.50
 *                     book_id: DRAFTKINGS
 *                     book_wager_id: "DK_12345_ABC"
 *                     public: true
 *                     selection_1_id: "sel_123"
 *                     selection_1_odds: -110
 *                     selection_1_status: WON
 *                     selection_2_id: "sel_456"
 *                     selection_2_odds: 120
 *                     selection_2_status: WON
 *                     selection_3_id: "sel_789"
 *                     selection_3_odds: -105
 *                     selection_3_status: WON
 *               open_single:
 *                 summary: Open single bet
 *                 value:
 *                   - id: 12346
 *                     userid: 123
 *                     wager_type: SINGLE
 *                     placed_at: 1641081600
 *                     bet_count: 1
 *                     selection_count: 1
 *                     selection_lost: 0
 *                     status: OPEN
 *                     bet_wager_amount: 25.00
 *                     total_wager_amount: 25.00
 *                     wager_returned_amount: 0.00
 *                     book_id: FANDUEL
 *                     book_wager_id: "FD_67890_XYZ"
 *                     public: false
 *                     selection_1_id: "sel_abc"
 *                     selection_1_odds: -115
 *                     selection_1_status: OPEN
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *     security:
 *       - bearerAuth: []
 */
router.get('/:user_id', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const user_id = Number(req.params.user_id)
    const limit = Number(req.query.limit) || 1000
    const offset = Number(req.query.offset) || 0
    const placed_before = Number(req.query.placed_before) || null
    const placed_after = Number(req.query.placed_after) || null
    let wager_type = req.query.wager_type
    if (typeof wager_type === 'string') {
      wager_type = [wager_type]
    }
    const min_selection_count = Number(req.query.min_selection_count) || null
    const max_selection_count = Number(req.query.max_selection_count) || null
    const min_selection_lost_count =
      Number(req.query.min_selection_lost_count) || null
    const max_selection_lost_count =
      Number(req.query.max_selection_lost_count) || null
    let wager_status = req.query.wager_status
    if (typeof wager_status === 'string') {
      wager_status = [wager_status]
    }

    const public_only =
      req.auth && req.auth.userId && req.auth.userId !== user_id

    const validation_response = query_params_validator({
      user_id,
      limit,
      offset,
      placed_before,
      placed_after,
      wager_type,
      min_selection_count,
      max_selection_count,
      min_selection_lost_count,
      max_selection_lost_count,
      wager_status
    })

    if (validation_response !== true) {
      return res.status(400).send({ error: validation_response[0].message })
    }

    const wagers_query = db('placed_wagers').where('userid', user_id)

    if (placed_before) {
      wagers_query.where('placed_at', '<', placed_before)
    }

    if (placed_after) {
      wagers_query.where('placed_at', '>', placed_after)
    }

    if (wager_type) {
      wagers_query.whereIn('wager_type', wager_type)
    }

    if (min_selection_count) {
      wagers_query.where('selection_count', '>=', min_selection_count)
    }

    if (max_selection_count) {
      wagers_query.where('selection_count', '<=', max_selection_count)
    }

    if (min_selection_lost_count) {
      wagers_query.where('selection_lost', '>=', min_selection_lost_count)
    }

    if (max_selection_lost_count) {
      wagers_query.where('selection_lost', '<=', max_selection_lost_count)
    }

    if (wager_status) {
      wagers_query.whereIn('status', wager_status)
    }

    if (public_only) {
      wagers_query.where('public', true)
    }

    if (limit) {
      wagers_query.limit(limit)
    }

    if (offset) {
      wagers_query.offset(offset)
    }

    const wagers = await wagers_query

    res.send(wagers)
  } catch (error) {
    logger(error)
    res.status(400).send({ error: error.message })
  }
})

export default router
