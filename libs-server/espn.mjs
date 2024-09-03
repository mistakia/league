import fetch from 'node-fetch'
import debug from 'debug'
import { fetch as fetch_http2 } from 'fetch-h2'

import db from '#db'
import { wait } from './wait.mjs'
import * as cache from './cache.mjs'
import { constants } from '#libs-shared'

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

// format: PPR, STANDARD
export const get_espn_adp = async ({
  year = constants.season.year,
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
