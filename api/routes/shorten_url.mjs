import express from 'express'
import { blake2b } from 'blakejs'

import config from '#config'
import db from '#db'

const router = express.Router()

const get_url_hash = (url) => {
  return blake2b(url, 16)
}

router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { url } = req.body
    const url_hash = get_url_hash(url)
    await db('urls').insert({ url, url_hash }).onConflict('url').ignore()
    const short_url = `/u/${url_hash}`
    res.json({ short_url, url, url_hash })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.get('/:hash', async (req, res) => {
  const { hash } = req.params
  const url = await db('urls').where('url_hash', hash).first()
  if (url) {
    res.redirect(`${config.url}${url.url}`)
  }
})

export default router
