import express from 'express'
const router = express.Router()

router.put('/:sourceId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { sourceId } = req.params
    let { weight } = req.body

    const { userId } = req.auth

    if (!sourceId) {
      return res.status(400).send({ error: 'missing sourceId' })
    }

    if (!weight) {
      return res.status(400).send({ error: 'missing weight' })
    }

    if (isNaN(weight)) {
      return res.status(400).send({ error: 'invalid weight' })
    }

    weight = parseFloat(weight)

    if (weight === 1) {
      await db('users_sources')
        .del()
        .where({ userid: userId, sourceid: sourceId })
    } else {
      const rows = await db('users_sources').where({
        userid: userId,
        sourceid: sourceId
      })
      if (!rows.length) {
        await db('users_sources').insert({
          userid: userId,
          sourceid: sourceId,
          weight
        })
      } else {
        await db('users_sources')
          .update({
            weight
          })
          .where({ userid: userId, sourceid: sourceId })
      }
    }

    res.send({ weight })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
