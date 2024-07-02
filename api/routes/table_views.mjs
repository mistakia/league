import express from 'express'

import { validators } from '#libs-server'

const router = express.Router()

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const views = await db('user_table_views')
    return res.status(200).send(views)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/?', async (req, res) => {
  const { log, db } = req.app.locals
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

      await db('database_table_views')
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
      await db('user_table_views')
        .insert({
          view_name,
          view_description,
          table_state: JSON.stringify(table_state),
          user_id
        })
        .onConflict(['view_name', 'user_id'])
        .merge()
    }

    const view = await db('user_table_views')
      .where({
        view_name,
        user_id
      })
      .first()

    res.status(200).send(view)
  } catch (err) {
    log(err)
    res.status(500).send({ error: err.toString() })
  }
})

router.delete('/:view_id', async (req, res) => {
  const { log, db } = req.app.locals
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
    log(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
