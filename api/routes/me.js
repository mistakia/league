const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  try {
    const { db } = req.app.locals
    const users = await db('users').where({ id: req.user.userId })
    const user = users[0]
    delete user.password
    res.send(user)
  } catch (err) {
    res.status(500).send({ error: err.toString() })
  }
})

module.exports = router
