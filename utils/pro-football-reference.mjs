import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'
import debug from 'debug'

import * as cache from './cache.mjs'
import config from '#config'

const log = debug('pro-football-reference')

const extract_position_start_end = (string) => {
  const regex = /\(([^)]*)\).+(\d{4})-(\d{4})$/
  const match = string.match(regex)

  if (!match) {
    log(`no match for ${string}`)
    return {
      positions: [],
      start: null,
      end: null
    }
  }

  const positions = match[1].split('-')
  const startYear = parseInt(match[2])
  const endYear = parseInt(match[3])

  return {
    positions,
    start: startYear,
    end: endYear
  }
}

const get_players_from_page = async ({ url, ignore_cache = false }) => {
  if (!url) {
    throw new Error('url is required')
  }

  log(`getting players from ${url} (ignore_cache: ${ignore_cache})`)

  const cache_key = `/pro-football-reference/players/${
    url.split('/').slice(-2)[0]
  }.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      return cache_value
    }
  }

  const response = await fetch(url)
  const text = await response.text()
  const dom = new JSDOM(text)
  const doc = dom.window.document
  const player_paragraph_divs = doc.querySelectorAll('#div_players p')
  const players = Array.from(player_paragraph_divs).map((div) => {
    const link = div.querySelector('a')
    const position_start_string = div.innerHTML.split('</a>')[1]
    const is_active = position_start_string.includes('</b>')

    return {
      name: link.textContent,
      url: link.href,
      is_active,
      pfr_id: link.href.split('/').slice(-1)[0].split('.')[0],
      ...extract_position_start_end(position_start_string)
    }
  })

  if (players.length) {
    await cache.set({ key: cache_key, value: players })
  }

  return players
}

const get_players_page_links = async ({ ignore_cache = false } = {}) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const cache_key = '/pro-football-reference/players-links.json'
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      return cache_value
    }
  }

  const url = `${config.pro_football_reference_url}/players/`
  const response = await fetch(url)
  const text = await response.text()
  const dom = new JSDOM(text)
  const doc = dom.window.document
  const links = doc.querySelectorAll('ul.page_index li > a')
  const hrefs = Array.from(links).map(
    (link) => `${config.pro_football_reference_url}${link.href}`
  )

  if (hrefs.length) {
    await cache.set({ key: cache_key, value: hrefs })
  }

  return hrefs
}

export const get_players = async ({ ignore_cache = false } = {}) => {
  const cache_key = '/pro-football-reference/players.json'
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      return cache_value
    }
  }

  const links = await get_players_page_links({ ignore_cache })

  const players = []
  for (const url of links) {
    const players_from_page = await get_players_from_page({ url, ignore_cache })
    players.push(...players_from_page)
  }

  if (players.length) {
    await cache.set({ key: cache_key, value: players })
  }

  return players
}
