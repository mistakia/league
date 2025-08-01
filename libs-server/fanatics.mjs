import { fetch as fetch_http2 } from 'fetch-h2'
import debug from 'debug'

import {
  player_prop_types,
  team_game_market_types
} from '#libs-shared/bookmaker-constants.mjs'
import db from '#db'
import * as cache from './cache.mjs'

const log = debug('fanatics')
debug.enable('fanatics')

const get_fanatics_config = async () => {
  const config_row = await db('config')
    .where({ key: 'fanatics_config' })
    .first()
  return config_row.value
}

export const format_wager_payout = (payout) => {
  const amount = Number(payout.replace(/[$,]/g, ''))
  if (isNaN(amount)) {
    throw new Error(`invalid payout amount ${payout}, formmated ${amount}`)
  }
  return amount
}

export const format_market_type = ({ market_type }) => {
  switch (market_type) {
    case 'AMERICAN_FOOTBALL:FT:PROPPSYDSTG':
      return player_prop_types.GAME_ALT_PASSING_YARDS
    case 'AMERICAN_FOOTBALL:FT:PROPPSTDTG':
      return player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS
    case 'AMERICAN_FOOTBALL:FT:PROPPSYDS':
      return player_prop_types.GAME_PASSING_YARDS
    case 'AMERICAN_FOOTBALL:FT:PROPPSTD':
      return player_prop_types.GAME_PASSING_TOUCHDOWNS

    case 'AMERICAN_FOOTBALL:FT:PROPRCYDSTG':
      return player_prop_types.GAME_ALT_RECEIVING_YARDS
    case 'AMERICAN_FOOTBALL:FT:PROPRECTG':
      return player_prop_types.GAME_ALT_RECEPTIONS
    case 'AMERICAN_FOOTBALL:FT:PROPRCYDS':
      return player_prop_types.GAME_RECEIVING_YARDS
    case 'AMERICAN_FOOTBALL:FT:PROPREC':
      return player_prop_types.GAME_RECEPTIONS

    case 'AMERICAN_FOOTBALL:FT:PROPRSYDSTG':
      return player_prop_types.GAME_ALT_RUSHING_YARDS
    case 'AMERICAN_FOOTBALL:FT:PROPRSYDS':
      return player_prop_types.GAME_RUSHING_YARDS

    case 'AMERICAN_FOOTBALL:FTOT:WS1STTD':
      return player_prop_types.GAME_FIRST_TOUCHDOWN_SCORER
    case 'AMERICAN_FOOTBALL:FTOT:WSLSTTD':
      return player_prop_types.GAME_LAST_TOUCHDOWN_SCORER
    case 'AMERICAN_FOOTBALL:FTOT:WSATD':
      return player_prop_types.ANYTIME_TOUCHDOWN

    case 'AMERICAN_FOOTBALL:FT:C:MOSTPASSINGYARDS':
      return player_prop_types.GAME_LEADER_PASSING_YARDS

    case 'AMERICAN_FOOTBALL:FT:C:MOSTRUSHYARDS':
      return player_prop_types.GAME_LEADER_RUSHING_YARDS

    case 'AMERICAN_FOOTBALL:FTOT:OU':
      return team_game_market_types.GAME_TOTAL

    case 'AMERICAN_FOOTBALL:FTOT:ML':
      return team_game_market_types.GAME_MONEYLINE

    case 'AMERICAN_FOOTBALL:FTOT:SPRD':
      return team_game_market_types.GAME_SPREAD

    default:
      log(`unknown market type: ${market_type}`)
      return null
  }
}

export const get_league_info = async ({ ignore_cache = false } = {}) => {
  const cache_key = `/fanatics/nfl/league_info.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log('cache hit for nfl league info')
      return cache_value
    }
  }

  const fanatics_config = await get_fanatics_config()
  const url = `${fanatics_config.api_url}/page/league/364899?channel=AMELCO_DC_MASTER&segment=AMELCO_DC&stateCode=DC&tab=schedule&dma=511`
  const res = await fetch_http2(url)
  const data = await res.json()

  if (data) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const get_event_info = async ({
  event_id,
  ignore_cache = false
} = {}) => {
  if (!event_id) {
    throw new Error('event_id is required')
  }

  const cache_key = `/fanatics/event/${event_id}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for event with id: ${event_id}`)
      return cache_value
    }
  }

  const fanatics_config = await get_fanatics_config()
  const url = `${fanatics_config.api_url}/page/event/${event_id}?channel=AMELCO_DC_MASTER&segment=AMELCO_DC&stateCode=DC&isTournament=false&dma=511`
  const res = await fetch_http2(url)
  const data = await res.json()

  if (data) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

const get_wagers_info = async ({
  session_token,
  channel = 'AMELCO_DC_MASTER',
  segment = 'AMELCO_DC',
  stateCode = 'DC',
  dma = '511'
}) => {
  const fanatics_config = await get_fanatics_config()
  const url = `${fanatics_config.api_url}/page/mybets?channel=${channel}&segment=${segment}&stateCode=${stateCode}&dma=${dma}`
  const res = await fetch_http2(url, {
    headers: {
      sessionToken: session_token
    }
  })
  const data = await res.json()
  return data
}

export const get_open_wagers = async ({
  session_token,
  channel = 'AMELCO_DC_MASTER',
  segment = 'AMELCO_DC',
  stateCode = 'DC',
  dma = '511'
}) => {
  const wagers_info = await get_wagers_info({
    session_token,
    channel,
    segment,
    stateCode,
    dma
  })

  if (!wagers_info || !wagers_info.tabs) {
    log(`no open wagers card pack found`)
    return []
  }

  const open_wagers_card_pack_id = wagers_info.tabs.find(
    (tab) => tab.title === 'Open'
  ).cardPackId
  const open_wagers_card_pack = wagers_info.cardPack

  if (!open_wagers_card_pack) {
    log(`no open wagers card pack found`)
    return []
  }

  if (open_wagers_card_pack.id !== open_wagers_card_pack_id) {
    log(
      `open wagers card pack id mismatch: ${open_wagers_card_pack.id} !== ${open_wagers_card_pack_id}`
    )
    return []
  }

  return open_wagers_card_pack.cards
}

export const get_settled_wagers = async ({
  session_token,
  channel = 'AMELCO_DC_MASTER',
  segment = 'AMELCO_DC',
  stateCode = 'DC',
  dma = '511'
}) => {
  const wagers_info = await get_wagers_info({
    session_token,
    channel,
    segment,
    stateCode,
    dma
  })

  const settled_wagers_card_pack_id = wagers_info.tabs.find(
    (tab) => tab.title === 'All'
  ).cardPackId

  if (!settled_wagers_card_pack_id) {
    log(`no settled wagers card pack found`)
    return []
  }

  const fanatics_config = await get_fanatics_config()
  const url = `${fanatics_config.api_url}/cardpack/${settled_wagers_card_pack_id}?channel=${channel}&segment=${segment}&stateCode=${stateCode}`
  const res = await fetch_http2(url, {
    headers: {
      sessionToken: session_token
    }
  })
  const card_pack_data = await res.json()
  if (!card_pack_data) {
    log(`no card pack data found`)
    return []
  }

  return card_pack_data.cards
}
