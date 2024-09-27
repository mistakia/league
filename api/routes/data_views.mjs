import express from 'express'
import crypto from 'crypto'
import { validators, get_data_view_results, redis_cache } from '#libs-server'
import get_data_view_hash from '#libs-server/data-views/get-data-view-hash.mjs'
import convert_to_csv from '#libs-shared/convert-to-csv.mjs'

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

router.get('/export/:view_id/:export_format', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const { view_id, export_format } = req.params

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
    const valid_formats = ['csv', 'json']
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

    let data_view_results = await redis_cache.get(cache_key)
    let data_view_metadata

    if (!data_view_results) {
      // If not cached, get the results
      const result = await get_data_view_results({
        where: table_state.where,
        columns: table_state.columns,
        sort: table_state.sort,
        offset: table_state.offset,
        prefix_columns: table_state.prefix_columns,
        splits: table_state.splits
      })
      data_view_results = result.data_view_results
      data_view_metadata = result.data_view_metadata

      // Cache the unformatted results
      if (data_view_results && data_view_results.length) {
        const cache_ttl = data_view_metadata.cache_ttl || 1000 * 60 * 60 * 12 // 12 hours
        await redis_cache.set(
          cache_key,
          JSON.stringify(data_view_results),
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
      case 'csv':
        formatted_results = convert_to_csv(data_view_results)
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader(
          'Content-Disposition',
          `attachment filename=${file_name}.csv`
        )
        break
      case 'json':
        formatted_results = JSON.stringify(data_view_results)
        res.setHeader('Content-Type', 'application/json')
        res.setHeader(
          'Content-Disposition',
          `attachment filename=${file_name}.json`
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
