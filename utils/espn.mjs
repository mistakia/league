import fetch from 'node-fetch'
import os from 'os'
import fs from 'fs-extra'
import path from 'path'
import debug from 'debug'

import config from '#config'

const cache_path = path.join(os.homedir(), '/espn')
const log = debug('espn')
debug.enable('espn')

export const getPlayer = async ({ espn_id }) => {
  const api_path = `/players/${espn_id}.json`
  const full_path = path.join(cache_path, api_path)
  if (fs.pathExistsSync(full_path)) {
    return fs.readJsonSync(full_path)
  }

  const url = `${config.espn_api_v3_url}/athletes/${espn_id}`
  log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  if (res.ok) {
    fs.ensureFileSync(full_path)
    fs.writeJsonSync(full_path, data, { spaces: 2 })
  }

  return data
}

export const getPlayers = async ({ page = 1 }) => {
  const url = `${config.espn_api_v2_url}/athletes?limit=1000&page=${page}`
  log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()
  return data
}
