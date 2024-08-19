import express from 'express'

import { validators } from '#libs-server'

const router = express.Router()

function generate_view_id() {
  const timestamp = Date.now().toString(36)
  const random_part = Math.random().toString(36).substr(2, 9)
  return `${timestamp}-${random_part}-${Math.random().toString(36).substr(2, 9)}-${random_part}`
}

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

    const query = db('user_table_views')

    if (user_ids.length) {
      query.whereIn('user_id', user_ids)
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
      const view = await db('user_table_views')
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

      await db('user_table_views')
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
      const view_id = generate_view_id()

      await db('user_table_views').insert({
        view_id,
        view_name,
        view_description,
        table_state: JSON.stringify(table_state),
        user_id
      })
    }

    const view = await db('user_table_views')
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

    const view = await db('user_table_views')
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

    await db('user_table_views')
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

export default router
