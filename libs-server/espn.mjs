import fetch from 'node-fetch'
import debug from 'debug'
import { fetch as fetch_http2 } from 'fetch-h2'

import db from '#db'
import * as cache from './cache.mjs'
import { wait } from './wait.mjs'
import { current_season } from '#constants'

const log = debug('espn')
debug.enable('espn')

const slot_nums = { QB: 0, RB: 2, WR: 4, TE: 6, K: 17, DST: 16 }

export const stats = (d) => ({
  // passing
  ints: d['20'],
  tdp: d['4'],
  py: d['3'],
  pa: d['0'],
  pc: d['1'],

  // rushing
  ra: d['23'],
  ry: d['24'],
  tdr: d['25'],
  fuml: d['72'],

  // receiving
  trg: d['58'],
  rec: d['53'],
  recy: d['42'],
  tdrec: d['43'],

  // kicker
  fg39: d['80'],
  fg49: d['77'],
  fg50: d['74'],
  xpm: d['86'],

  // return
  // prtd: d['102'],
  // krtd: d['101'],

  // defense
  dint: d['95'],
  drf: d['96'],
  dblk: d['97'],
  dsf: d['98'],
  dsk: d['99'],
  dtd: (d['103'] || 0) + (d['104'] || 0) + (d['93'] || 0)
})

export const positionId = {
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  16: 'DST'
}

export const teamId = {
  [-1]: 'Bye',
  1: 'ATL',
  2: 'BUF',
  3: 'CHI',
  4: 'CIN',
  5: 'CLE',
  6: 'DAL',
  7: 'DEN',
  8: 'DET',
  9: 'GB',
  10: 'TEN',
  11: 'IND',
  12: 'KC',
  13: 'OAK',
  14: 'LA',
  15: 'MIA',
  16: 'MIN',
  17: 'NE',
  18: 'NO',
  19: 'NYG',
  20: 'NYJ',
  21: 'PHI',
  22: 'ARI',
  23: 'PIT',
  24: 'LAC',
  25: 'SF',
  26: 'SEA',
  27: 'TB',
  28: 'WSH',
  29: 'CAR',
  30: 'JAX',
  33: 'BAL',
  34: 'HOU'
}

export const get_espn_config = async () => {
  const config_row = await db('config').where('key', 'espn_config').first()
  return config_row.value
}

export const getPlayer = async ({ espn_id }) => {
  const cache_key = `/espn/players/${espn_id}.json`
  const cache_value = await cache.get({ key: cache_key })
  if (cache_value) {
    return cache_value
  }

  const espn_config = await get_espn_config()

  const url = `${espn_config.api_v3_url}/athletes/${espn_id}`
  log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  await wait(4000)

  if (res.ok) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const getPlayers = async ({ page = 1 }) => {
  const espn_config = await get_espn_config()
  const url = `${espn_config.api_v2_url}/athletes?limit=1000&page=${page}`
  log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()
  return data
}

export const search_players = async ({
  query,
  limit = 10,
  ignore_cache = false
} = {}) => {
  if (!query) {
    throw new Error('query is required')
  }

  const cache_key = `/espn/search/${encodeURIComponent(query)}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for espn search: ${query}`)
      return cache_value
    }
  }

  const url = new URL('https://site.web.api.espn.com/apis/search/v2')
  url.searchParams.set('region', 'us')
  url.searchParams.set('lang', 'en')
  url.searchParams.set('section', 'nfl')
  url.searchParams.set('type', 'player')
  url.searchParams.set('query', query)
  url.searchParams.set('limit', limit)

  log(`fetching espn search: ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  await wait(2000)

  const results = []
  // ESPN search API returns results in results[0].contents for player type
  const player_results = data?.results?.find((r) => r.type === 'player')
  const players = player_results?.contents || data?.athletes?.items || []
  const espn_id_regex = /\/nfl\/player\/_\/id\/(\d+)/

  for (const item of players) {
    // Handle both link object format and string format
    const link_url =
      typeof item.link === 'object' ? item.link?.web : item.link || ''
    const espn_id_match = link_url.match(espn_id_regex)
    const espn_id = espn_id_match ? Number(espn_id_match[1]) : null

    if (!espn_id) continue

    // Extract team from subtitle (e.g., "Kansas City Chiefs")
    const team_from_subtitle = item.subtitle || ''

    results.push({
      espn_id,
      name: item.displayName || item.name || '',
      position: item.position || '',
      team: teamId[item.teamId] || team_from_subtitle || '',
      link: link_url
    })
  }

  if (results.length > 0) {
    await cache.set({ key: cache_key, value: results })
  }

  return results
}

// format: PPR, STANDARD
export const get_espn_adp = async ({
  year = current_season.year,
  format = 'PPR'
}) => {
  const espn_config = await get_espn_config()
  const base_url = `${espn_config.adp_api_url}/games/ffl/seasons/${year}/segments/0/leaguedefaults/3?scoringPeriodId=0&view=kona_player_info`

  const fantasy_filter = JSON.stringify({
    players: {
      filterSlotIds: { value: Object.values(slot_nums) },
      filterStatsForSourceIds: { value: [1] },
      filterStatsForSplitTypeIds: { value: [0] },
      sortAppliedStatTotal: {
        sortAsc: false,
        sortPriority: 3,
        value: `11${year}0`
      },
      sortDraftRanks: { sortPriority: 2, sortAsc: true, value: 'PPR' },
      sortPercOwned: { sortAsc: false, sortPriority: 4 },
      limit: 500,
      offset: 0,
      filterRanksForScoringPeriodIds: { value: [2] },
      filterRanksForRankTypes: { value: [format] },
      filterRanksForSlotIds: { value: Object.values(slot_nums) },
      filterStatsForTopScoringPeriodIds: {
        value: 2,
        additionalValue: [`00${year}`, `10${year}`, `11${year}0`, `02${year}`]
      }
    }
  })

  log(`fetching ${base_url}`)
  log(fantasy_filter)
  const response = await fetch_http2(base_url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Fantasy-Source': 'kona',
      'X-Fantasy-Filter': fantasy_filter
    }
  })

  const data = await response.json()

  return data
}
