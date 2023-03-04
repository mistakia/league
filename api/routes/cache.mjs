import express from 'express'
import os from 'os'
import fs from 'fs-extra'
import path from 'path'

const router = express.Router()
const cache_path = path.join(os.homedir())

router.get('/:cache_key(*)', async (req, res) => {
  const { logger } = req.app.locals
  const { cache_key } = req.params
  try {
    // Sanitize the cache_key by removing any '..' or '.' characters to prevent accessing files outside of the cache_path
    const sanitized_cache_key = cache_key.replace(/(\.\.\/|\.\/)/g, '')

    const full_path = path.join(cache_path, sanitized_cache_key)
    const path_exists = await fs.pathExists(full_path)

    // Check if the full_path is within the cache_path directory to prevent accessing files outside of it
    const relative_path = path.relative(cache_path, full_path)
    const is_subpath =
      !!relative_path &&
      !relative_path.startsWith('..') &&
      !path.isAbsolute(relative_path)

    if (path_exists && is_subpath) {
      const value = await fs.readJson(full_path)
      return res.status(200).send({ key: cache_key, value })
    }

    return res.status(200).send({ key: cache_key, value: null })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/:cache_key(*)', async (req, res) => {
  const { logger } = req.app.locals
  const { cache_key } = req.params
  const { body } = req
  try {
    if (!req.auth || req.auth.userId !== 1) {
      return res.status(401).send({ error: 'invalid token' })
    }

    const full_path = path.join(cache_path, cache_key)
    await fs.ensureFile(full_path)
    await fs.writeJson(full_path, body, { spaces: 2 })

    return res.status(200).send({ key: cache_key, value: body })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
