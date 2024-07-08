import express from 'express'
import { blake2b } from 'blakejs'

import { validators } from '#libs-server'
import db from '#db'

const router = express.Router()

const get_url_hash = (url) => {
  const hash = Array.from(blake2b(url, null, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hash
}

router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { url } = req.body
    const validation_result = validators.short_url_validator(url)
    if (validation_result !== true) {
      return res.status(400).json({ error: 'Invalid URL' })
    }

    const valid_domains = ['xo.football', 'localhost']
    const url_object = new URL(url)
    if (!valid_domains.includes(url_object.hostname)) {
      return res.status(400).json({ error: 'Invalid domain' })
    }

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
    res.redirect(url.url)
  }
})

export default router
