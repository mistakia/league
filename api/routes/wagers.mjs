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
