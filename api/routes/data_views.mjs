import express from 'express'
import crypto from 'crypto'
import {
  validators,
  get_data_view_results,
  data_view_cache
} from '#libs-server'
import get_table_hash from '#libs-server/get-table-hash.mjs'

const router = express.Router()

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

router.post('/search/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { where, columns, sort, offset, prefix_columns, splits } = req.body

    const generate_cache_key = (obj) => {
      if (Array.isArray(obj)) {
        return JSON.stringify(obj.map(generate_cache_key).sort())
      } else if (typeof obj === 'object' && obj !== null) {
        return JSON.stringify(
          Object.keys(obj)
            .sort()
            .reduce((result, key) => {
              result[key] = generate_cache_key(obj[key])
              return result
            }, {})
        )
      } else {
        return JSON.stringify(obj)
      }
    }

    const stringified_key = generate_cache_key({
      where,
      columns,
      sort,
      offset,
      prefix_columns,
      splits
    })
    const cache_key = get_table_hash(stringified_key)
    const cached_result = await data_view_cache.get(cache_key)

    if (cached_result) {
      return res.send(cached_result)
    }

    const query = get_data_view_results({
      where,
      columns,
      sort,
      offset,
      prefix_columns,
      splits
    })

    const result = await query

    if (result && result.length) {
      const cache_ttl = 1000 * 60 * 60 * 12 // 12 hours
      await data_view_cache.set(cache_key, result, cache_ttl)
    }

    res.send(result)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
