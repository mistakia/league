import fetch from 'node-fetch'
import os from 'os'
import fs from 'fs-extra'
import path from 'path'
import debug from 'debug'

import config from '#config'

const cache_path = path.join(os.homedir(), '/ngs')
const log = debug('ngs')
debug.enable('ngs')

export const getPlayer = async ({ ignore_cache = false, nflId } = {}) => {
  if (!nflId) {
    return
  }

  const api_path = `/player/${nflId}.json`
  const full_path = path.join(cache_path, api_path)
  if (!ignore_cache && fs.pathExistsSync(full_path)) {
    return fs.readJsonSync(full_path)
  }

  const url = `${config.ngs_api_url}/league/player?nflId=${nflId}`
  log(`fetching ngs player with nflId: ${nflId}`)
  const res = await fetch(url, {
    headers: { referer: 'https://nextgenstats.nfl.com/' }
  })
  const data = await res.json()

  if (data && data.gsisItId) {
    fs.ensureFileSync(full_path)
    fs.writeJsonSync(full_path, data, { spaces: 2 })
  }

  return data
}
