import fetch from 'node-fetch'
import debug from 'debug'

import config from '#config'
import * as cache from './cache.mjs'
import { constants } from '#libs-shared'

const log = debug('ngs')

export const getCurrentPlayers = async ({
  ignore_cache = false,
  season = constants.season.year
}) => {
  const cache_key = `/ngs/current_players/${season}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for ngs current players for season: ${season}`)
      return cache_value
    }
  }

  const url = `${config.ngs_api_url}/league/roster/current?teamId=ALL`
  log(`fetching ngs current players for season: ${season}`)
  const res = await fetch(url, {
    headers: { referer: 'https://nextgenstats.nfl.com/' }
  })
  const data = await res.json()

  if (data && data.teamPlayers.length) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const getPlayer = async ({ ignore_cache = false, gsis_it_id } = {}) => {
  if (!gsis_it_id) {
    return
  }

  const cache_key = `/ngs/player/${gsis_it_id}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for ngs player with gsis_it_id: ${gsis_it_id}`)
      return cache_value
    }
  }

  const url = `${config.ngs_api_url}/league/player?nflId=${gsis_it_id}`
  log(`fetching ngs player with gsis_it_id: ${gsis_it_id}`)
  const res = await fetch(url, {
    headers: { referer: 'https://nextgenstats.nfl.com/' }
  })
  const data = await res.json()

  if (data && data.displayName) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const getPlays = async ({ ignore_cache = false, esbid } = {}) => {
  if (!esbid) {
    return
  }

  const cache_key = `/ngs/plays/${esbid}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for ngs game with esbid: ${esbid}`)
      return cache_value
    }
  }

  log(`fetching ngs game with esbid: ${esbid}`)
  const url = `${config.ngs_api_url}/live/plays/playlist/game?gameId=${esbid}`
  const res = await fetch(url, {
    headers: {
      origin: 'https://nextgenstats.nfl.com',
      referer: 'https://nextgenstats.nfl.com/stats/game-center'
    }
  })
  const data = await res.json()

  if (data && data.gameId) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const get_highlight_players = async ({ ignore_cache = false }) => {
  const cache_key = `/ngs/highlight_players.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for ngs highlight players`)
      return cache_value
    }
  }

  const url = `${config.ngs_api_url}/plays/highlight/players`
  log(`fetching ngs highlight players`)
  const res = await fetch(url, {
    headers: {
      origin: 'https://nextgenstats.nfl.com',
      referer: 'https://nextgenstats.nfl.com/stats/game-center'
    }
  })
  const data = await res.json()

  if (data && data.players && data.players.length) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
