const express = require('express')
const router = express.Router()

const sources = require('./sources')
router.use('/sources', sources)

module.exports = router
