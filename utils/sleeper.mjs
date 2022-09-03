import fetch from 'node-fetch'
import os from 'os'
import fs from 'fs-extra'
import path from 'path'
import debug from 'debug'

import config from '#config'
import { wait } from './wait.mjs'

const cache_path = path.join(os.homedir(), '/sleeper')

const log = debug('sleeper')
debug.enable('sleeper')

export const getLeague = async ({ league_sleeper_id, ignore_cache = false }) => {
  const api_path = `/leagues/${league_sleeper_id}/league.json`
  const full_path = path.join(cache_path, api_path)
  if (!ignore_cache && fs.pathExistsSync(full_path)) {
    return fs.readJsonSync(full_path)
  }

  const url = `${config.sleeper_api_v1_url}/league/${league_sleeper_id}`
  log(`fetching ${url}`)

  const res = await fetch(url)
  const data = await res.json()

  if (res.ok) {
    fs.ensureFileSync(full_path)
    fs.writeJsonSync(full_path, data, { spaces: 2 })
  }

  return data
}

export const getLeagueUsers = async ({ league_sleeper_id, ignore_cache = false }) => {
  const api_path = `/leagues/${league_sleeper_id}/users.json`
  const full_path = path.join(cache_path, api_path)
  if (!ignore_cache && fs.pathExistsSync(full_path)) {
    return fs.readJsonSync(full_path)
  }

  const url = `${config.sleeper_api_v1_url}/league/${league_sleeper_id}/users`
  log(`fetching ${url}`)

  const res = await fetch(url)
  const data = await res.json()

  if (res.ok) {
    fs.ensureFileSync(full_path)
    fs.writeJsonSync(full_path, data, { spaces: 2 })
  }

  return data
}

export const getLeagueRosters = async ({ league_sleeper_id, ignore_cache = false }) => {
  const api_path = `/leagues/${league_sleeper_id}/rosters.json`
  const full_path = path.join(cache_path, api_path)
  if (fs.pathExistsSync(full_path)) {
    return fs.readJsonSync(full_path)
  }

  const url = `${config.sleeper_api_v1_url}/league/${league_sleeper_id}/rosters`
  log(`fetching ${url}`)

  const res = await fetch(url)
  const data = await res.json()

  if (res.ok) {
    fs.ensureFileSync(full_path)
    fs.writeJsonSync(full_path, data, { spaces: 2 })
  }

  return data
}

export const getLeagueMatchups = async ({ league_sleeper_id, week, ignore_cache = false }) => {
  const api_path = `/leagues/${league_sleeper_id}/week-${week}.json`
  const full_path = path.join(cache_path, api_path)
  if (fs.pathExistsSync(full_path)) {
    return fs.readJsonSync(full_path)
  }

  const url = `${config.sleeper_api_v1_url}/league/${league_sleeper_id}/matchups/${week}`
  log(`fetching ${url}`)

  const res = await fetch(url)
  const data = await res.json()

  if (res.ok) {
    fs.ensureFileSync(full_path)
    fs.writeJsonSync(full_path, data, { spaces: 2 })
  }

  return data
}
