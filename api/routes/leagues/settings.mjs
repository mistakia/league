import express from 'express'
const router = express.Router()

router.get('/?', async (req, res) => {
  // TODO return list of league settings
})

router.post('/?', async (req, res) => {
  // TODO set league settings
})

export default router
