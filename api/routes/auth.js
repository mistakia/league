const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

router.post('/login', async (req, res) => {
  try {
    const { db, config } = req.app.locals
    const { email, password } = req.body
    if (!email) {
      return res.status(400).send({ error: 'missing email param' })
    }

    if (!password) {
      return res.status(400).send({ error: 'missing password param' })
    }

    const users = await db('users').where({ email })
    if (!users.length) {
      return res.status(400).send({ error: 'invalid params' })
    }

    const user = users[0]
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return res.status(400).send({ error: 'invalid params' })
    }

    const token = jwt.sign({ userId: user.id }, config.jwt.secret)
    res.json({ token })
  } catch (err) {
    res.status(500).send({ error: err.toString() })
  }
})

router.post('/register', async (req, res) => {
  try {
    const { db, config } = req.app.locals
    const { email, password } = req.body
    if (!email) {
      return res.status(400).send({ error: 'missing email param' })
    }

    if (!password) {
      return res.status(400).send({ error: 'missing password param' })
    }

    if (email.length > 60) {
      return res.status(400).send({ error: 'email too long' })
    }

    const emailExists = await db('users').where({ email })
    if (emailExists.length) {
      return res.status(400).send({ error: 'email exists' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)
    const users = await db('users').insert({ email, password: hashedPassword })
    const token = jwt.sign({ userId: users[0].id }, config.jwt.secret)
    res.json({ token })
  } catch (err) {
    res.status(500).send({ error: err.toString() })
  }
})

module.exports = router
