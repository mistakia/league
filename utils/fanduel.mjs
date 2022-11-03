import fetch from 'node-fetch'
import debug from 'debug'

import config from '#config'
import { constants } from '#common'

const log = debug('fanduel')
debug.enable('fanduel')

const nfl_game_compeition_id = 12282733

export const tabs = [
  'passing-props',
  'receiving-props',
  'rushing-props',
  'defensive-props'
]

export const leader_market_names = {
  'Most Passing Yards of Game':
    constants.player_prop_types.GAME_MOST_PASSING_YARDS,
  'Most Receiving Yards of Game':
    constants.player_prop_types.GAME_MOST_RECEIVING_YARDS,
  'Most Rushing Yards of Game':
    constants.player_prop_types.GAME_MOST_RUSHING_YARDS,

  'Most Passing Yards - Sunday Only':
    constants.player_prop_types.SUNDAY_MOST_PASSING_YARDS,
  'Most Receiving Yards - Sunday Only':
    constants.player_prop_types.SUNDAY_MOST_RECEIVING_YARDS,
  'Most Rushing Yards - Sunday Only':
    constants.player_prop_types.SUNDAY_MOST_RUSHING_YARDS
}

export const alt_line_markets = {
  'PLAYER_A_-_ALT_PASSING_YARDS':
    constants.player_prop_types.GAME_ALT_PASSING_YARDS,
  'PLAYER_B_-_ALT_PASSING_YARDS':
    constants.player_prop_types.GAME_ALT_PASSING_YARDS,
  'PLAYER_C_-_ALT_PASSING_YARDS':
    constants.player_prop_types.GAME_ALT_PASSING_YARDS,
  'PLAYER_D_-_ALT_PASSING_YARDS':
    constants.player_prop_types.GAME_ALT_PASSING_YARDS,

  'PLAYER_A_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_B_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_C_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_D_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_E_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_F_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_G_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_H_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_I_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_J_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_K_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_L_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_M_-_ALT_RUSH_YARDS':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,

  'PLAYER_A_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_B_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_C_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_D_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_E_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_F_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_G_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_H_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_I_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_J_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_K_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_L_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_M_-_ALT_RECEIVING_YARDS':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS
}

export const leader_markets = {
  MOST_PASSING_YARDS: constants.player_prop_types.GAME_MOST_PASSING_YARDS,
  MOST_RECEIVING_YARDS: constants.player_prop_types.GAME_MOST_RECEIVING_YARDS,
  MOST_RUSHING_YARDS: constants.player_prop_types.GAME_MOST_RUSHING_YARDS
}

export const markets = {
  PLAYER_A_TOTAL_PASSING_YARDS: constants.player_prop_types.GAME_PASSING_YARDS,
  PLAYER_B_TOTAL_PASSING_YARDS: constants.player_prop_types.GAME_PASSING_YARDS,

  PLAYER_A_LONGEST_PASS_COMPLETION:
    constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
  PLAYER_B_LONGEST_PASS_COMPLETION:
    constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
  PLAYER_C_LONGEST_PASS_COMPLETION:
    constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION,

  PLAYER_A_PASS_ATTEMPTS: constants.player_prop_types.GAME_PASSING_ATTEMPTS,
  PLAYER_B_PASS_ATTEMPTS: constants.player_prop_types.GAME_PASSING_ATTEMPTS,
  PLAYER_C_PASS_ATTEMPTS: constants.player_prop_types.GAME_PASSING_ATTEMPTS,

  PLAYER_A_TOTAL_PASSING_TOUCHDOWNS:
    constants.player_prop_types.GAME_PASSING_TOUCHDOWNS,
  PLAYER_B_TOTAL_PASSING_TOUCHDOWNS:
    constants.player_prop_types.GAME_PASSING_TOUCHDOWNS,

  PLAYER_A_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_B_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_C_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_D_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_E_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_F_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_G_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_H_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_I_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_J_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_K_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_L_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_M_TOTAL_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RECEIVING_YARDS,

  PLAYER_A_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_B_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_C_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_D_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_E_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_F_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_G_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_H_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_I_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_J_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_K_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_L_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  PLAYER_M_TOTAL_RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,

  PLAYER_A_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_B_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_C_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_D_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_E_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_F_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_G_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_H_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_I_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_J_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_K_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_L_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_M_LONGEST_RECEPTION:
    constants.player_prop_types.GAME_LONGEST_RECEPTION,

  PLAYER_A_TOTAL_RUSHING_YARDS: constants.player_prop_types.GAME_RUSHING_YARDS,
  PLAYER_B_TOTAL_RUSHING_YARDS: constants.player_prop_types.GAME_RUSHING_YARDS,
  PLAYER_C_TOTAL_RUSHING_YARDS: constants.player_prop_types.GAME_RUSHING_YARDS,
  PLAYER_D_TOTAL_RUSHING_YARDS: constants.player_prop_types.GAME_RUSHING_YARDS,
  PLAYER_E_TOTAL_RUSHING_YARDS: constants.player_prop_types.GAME_RUSHING_YARDS,
  PLAYER_F_TOTAL_RUSHING_YARDS: constants.player_prop_types.GAME_RUSHING_YARDS,

  PLAYER_A_TOTAL_RUSH_ATTEMPTS:
    constants.player_prop_types.GAME_RUSHING_ATTEMPTS,
  PLAYER_B_TOTAL_RUSH_ATTEMPTS:
    constants.player_prop_types.GAME_RUSHING_ATTEMPTS,
  PLAYER_C_TOTAL_RUSH_ATTEMPTS:
    constants.player_prop_types.GAME_RUSHING_ATTEMPTS,
  PLAYER_D_TOTAL_RUSH_ATTEMPTS:
    constants.player_prop_types.GAME_RUSHING_ATTEMPTS,
  PLAYER_E_TOTAL_RUSH_ATTEMPTS:
    constants.player_prop_types.GAME_RUSHING_ATTEMPTS,
  PLAYER_F_TOTAL_RUSH_ATTEMPTS:
    constants.player_prop_types.GAME_RUSHING_ATTEMPTS,

  PLAYER_A_LONGEST_RUSH: constants.player_prop_types.GAME_LONGEST_RUSH,
  PLAYER_B_LONGEST_RUSH: constants.player_prop_types.GAME_LONGEST_RUSH,
  PLAYER_C_LONGEST_RUSH: constants.player_prop_types.GAME_LONGEST_RUSH,
  PLAYER_D_LONGEST_RUSH: constants.player_prop_types.GAME_LONGEST_RUSH,

  'PLAYER_A_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_B_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_C_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_D_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_E_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_F_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_G_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_H_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_I_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_J_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_K_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_L_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_M_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_N_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_O_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_P_TOTAL_TACKLES_+_ASSISTS':
    constants.player_prop_types.GAME_TACKLES_ASSISTS,

  ...leader_markets,
  ...alt_line_markets
}

export const getEvents = async () => {
  const url = `${config.fanduel_api_url}/content-managed-page?betexRegion=GBR&capiJurisdiction=intl&currencyCode=USD&exchangeLocale=en_US&includePrices=true&includeRaceCards=false&includeSeo=true&language=en&regionCode=NAMERICA&timezone=America%2FNew_York&includeMarketBlurbs=true&_ak=FhMFpcPWXMeyZxOx&page=CUSTOM&customPageId=nfl`

  log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  const filtered = Object.values(data.attachments.events).filter(
    (e) => e.competitionId === nfl_game_compeition_id
  )

  return filtered
}

export const getEventTab = async ({ eventId, tab }) => {
  const url = `${config.fanduel_api_url}/event-page?betexRegion=GBR&capiJurisdiction=intl&currencyCode=USD&exchangeLocale=en_US&includePrices=true&language=en&priceHistory=1&regionCode=NAMERICA&_ak=FhMFpcPWXMeyZxOx&eventId=${eventId}&tab=${tab}`

  log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  return data
}

export const getWeeklySpecials = async () => {
  const url = `${config.fanduel_api_url}/content-managed-page?betexRegion=GBR&capiJurisdiction=intl&currencyCode=USD&exchangeLocale=en_US&includePrices=true&includeRaceCards=false&includeSeo=true&language=en&regionCode=NAMERICA&timezone=America%2FNew_York&includeMarketBlurbs=true&_ak=FhMFpcPWXMeyZxOx&page=CUSTOM&customPageId=nfl`

  log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  const market_names = [
    'Most Passing Yards - Sunday Only',
    'Most Receiving Yards - Sunday Only',
    'Most Rushing Yards - Sunday Only'
  ]
  const filtered = Object.values(data.attachments.markets).filter((m) =>
    market_names.includes(m.marketName)
  )

  return filtered
}
