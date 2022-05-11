import express from 'express'

import sources from './sources.mjs'

const router = express.Router()
router.use('/sources', sources)

export default router
