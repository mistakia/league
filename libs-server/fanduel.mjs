import fetch from 'node-fetch'
import queryString from 'query-string'
import dayjs from 'dayjs'
import debug from 'debug'

import config from '#config'
import { fixTeam } from '#libs-shared'
import { player_prop_types } from '#libs-shared/bookmaker-constants.mjs'
import { wait } from './wait.mjs'

const log = debug('fanduel')
debug.enable('fanduel')

const nfl_game_compeition_id = 12282733

export const tabs = [
  'passing-props',
  'receiving-props',
  'rushing-props',
  'defensive-props',
  'td-scorer-props'
]

const format_selection_player_name = (str = '') => {
  str = str.split(' - ')[0].replace('Over', '').replace('Under', '')
  str = str.split('(')[0] // remove anything in paranthesis
  return str.trim()
}

const format_market_name_player_name = (str = '') => {
  // Check if the string contains a date or "Regular Season"
  if (str.match(/\d{4}-\d{2}/) || str.includes('Regular Season')) {
    // Match the player name at the start of the string
    const match = str.match(
      /^((?:[A-Z]\.?'?){1,2}\s?(?:[A-Za-z]+[-'.]?\w*\s?){1,3}(?:Jr\.)?)(?=\s(?:\d{4}-\d{2}|Regular Season))/
    )

    // If a match is found, return it trimmed, otherwise return an empty string
    return match ? match[1].trim() : ''
  }

  if (str.includes('-')) {
    str = str.split(' - ')[0]
    return str.trim()
  }

  return ''
}

export const leader_market_names = {
  'Most Passing Yards of Game': player_prop_types.GAME_LEADER_PASSING_YARDS,
  'Most Receiving Yards of Game': player_prop_types.GAME_LEADER_RECEIVING_YARDS,
  'Most Rushing Yards of Game': player_prop_types.GAME_LEADER_RUSHING_YARDS,

  'Most Passing Yards - Sunday Only':
    player_prop_types.SUNDAY_LEADER_PASSING_YARDS,
  'Most Receiving Yards - Sunday Only':
    player_prop_types.SUNDAY_LEADER_RECEIVING_YARDS,
  'Most Rushing Yards - Sunday Only':
    player_prop_types.SUNDAY_LEADER_RUSHING_YARDS
}

export const alt_line_markets = {
  'PLAYER_A_-_ALT_PASSING_YARDS': player_prop_types.GAME_ALT_PASSING_YARDS,
  'PLAYER_B_-_ALT_PASSING_YARDS': player_prop_types.GAME_ALT_PASSING_YARDS,
  'PLAYER_C_-_ALT_PASSING_YARDS': player_prop_types.GAME_ALT_PASSING_YARDS,
  'PLAYER_D_-_ALT_PASSING_YARDS': player_prop_types.GAME_ALT_PASSING_YARDS,

  'PLAYER_A_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_B_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_C_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_D_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_E_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_F_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_G_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_H_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_I_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_J_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_K_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_L_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'PLAYER_M_-_ALT_RUSH_YARDS': player_prop_types.GAME_ALT_RUSHING_YARDS,

  'PLAYER_A_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_B_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_C_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_D_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_E_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_F_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_G_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_H_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_I_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_J_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_K_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_L_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'PLAYER_M_-_ALT_RECEIVING_YARDS': player_prop_types.GAME_ALT_RECEIVING_YARDS,

  'PLAYER_A_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_B_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_C_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_D_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_E_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_F_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_G_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_H_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_I_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_J_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_K_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_L_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS,
  'PLAYER_M_-_ALT_RECEPTIONS': player_prop_types.GAME_ALT_RECEPTIONS
}

export const markets = {
  PLAYER_A_TOTAL_PASSING_YARDS: player_prop_types.GAME_PASSING_YARDS,
  PLAYER_B_TOTAL_PASSING_YARDS: player_prop_types.GAME_PASSING_YARDS,

  PLAYER_A_LONGEST_PASS_COMPLETION:
    player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
  PLAYER_B_LONGEST_PASS_COMPLETION:
    player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
  PLAYER_C_LONGEST_PASS_COMPLETION:
    player_prop_types.GAME_PASSING_LONGEST_COMPLETION,

  PLAYER_A_PASS_ATTEMPTS: player_prop_types.GAME_PASSING_ATTEMPTS,
  PLAYER_B_PASS_ATTEMPTS: player_prop_types.GAME_PASSING_ATTEMPTS,
  PLAYER_C_PASS_ATTEMPTS: player_prop_types.GAME_PASSING_ATTEMPTS,

  PLAYER_A_TOTAL_PASSING_TOUCHDOWNS: player_prop_types.GAME_PASSING_TOUCHDOWNS,
  PLAYER_B_TOTAL_PASSING_TOUCHDOWNS: player_prop_types.GAME_PASSING_TOUCHDOWNS,

  PLAYER_A_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_B_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_C_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_D_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_E_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_F_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_G_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_H_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_I_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_J_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_K_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_L_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,
  PLAYER_M_TOTAL_RECEIVING_YARDS: player_prop_types.GAME_RECEIVING_YARDS,

  PLAYER_A_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_B_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_C_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_D_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_E_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_F_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_G_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_H_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_I_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_J_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_K_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_L_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,
  PLAYER_M_TOTAL_RECEPTIONS: player_prop_types.GAME_RECEPTIONS,

  PLAYER_A_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_B_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_C_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_D_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_E_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_F_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_G_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_H_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_I_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_J_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_K_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_L_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,
  PLAYER_M_LONGEST_RECEPTION: player_prop_types.GAME_LONGEST_RECEPTION,

  PLAYER_A_TOTAL_RUSHING_YARDS: player_prop_types.GAME_RUSHING_YARDS,
  PLAYER_B_TOTAL_RUSHING_YARDS: player_prop_types.GAME_RUSHING_YARDS,
  PLAYER_C_TOTAL_RUSHING_YARDS: player_prop_types.GAME_RUSHING_YARDS,
  PLAYER_D_TOTAL_RUSHING_YARDS: player_prop_types.GAME_RUSHING_YARDS,
  PLAYER_E_TOTAL_RUSHING_YARDS: player_prop_types.GAME_RUSHING_YARDS,
  PLAYER_F_TOTAL_RUSHING_YARDS: player_prop_types.GAME_RUSHING_YARDS,

  PLAYER_A_TOTAL_RUSH_ATTEMPTS: player_prop_types.GAME_RUSHING_ATTEMPTS,
  PLAYER_B_TOTAL_RUSH_ATTEMPTS: player_prop_types.GAME_RUSHING_ATTEMPTS,
  PLAYER_C_TOTAL_RUSH_ATTEMPTS: player_prop_types.GAME_RUSHING_ATTEMPTS,
  PLAYER_D_TOTAL_RUSH_ATTEMPTS: player_prop_types.GAME_RUSHING_ATTEMPTS,
  PLAYER_E_TOTAL_RUSH_ATTEMPTS: player_prop_types.GAME_RUSHING_ATTEMPTS,
  PLAYER_F_TOTAL_RUSH_ATTEMPTS: player_prop_types.GAME_RUSHING_ATTEMPTS,

  PLAYER_A_LONGEST_RUSH: player_prop_types.GAME_LONGEST_RUSH,
  PLAYER_B_LONGEST_RUSH: player_prop_types.GAME_LONGEST_RUSH,
  PLAYER_C_LONGEST_RUSH: player_prop_types.GAME_LONGEST_RUSH,
  PLAYER_D_LONGEST_RUSH: player_prop_types.GAME_LONGEST_RUSH,

  'PLAYER_A_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_B_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_C_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_D_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_E_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_F_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_G_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_H_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_I_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_J_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_K_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_L_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_M_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_N_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_O_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,
  'PLAYER_P_TOTAL_TACKLES_+_ASSISTS': player_prop_types.GAME_TACKLES_ASSISTS,

  ...alt_line_markets,

  ANY_TIME_TOUCHDOWN_SCORER: player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS
}

export const get_market_type_for_quarterback_season_props = ({
  marketName
}) => {
  const market_name_lower = marketName.toLowerCase()

  if (
    market_name_lower.includes('passing tds') ||
    market_name_lower.includes('passing touchdowns')
  ) {
    return player_prop_types.SEASON_PASSING_TOUCHDOWNS
  }

  if (market_name_lower.includes('passing yards')) {
    return player_prop_types.SEASON_PASSING_YARDS
  }

  return null
}

export const get_market_type_for_wide_receiver_season_props = ({
  marketName
}) => {
  const market_name_lower = marketName.toLowerCase()

  if (market_name_lower.includes('receiving yards')) {
    return player_prop_types.SEASON_RECEIVING_YARDS
  }

  if (
    market_name_lower.includes('receiving tds') ||
    market_name_lower.includes('receiving touchdowns')
  ) {
    return player_prop_types.SEASON_RECEIVING_TOUCHDOWNS
  }

  if (market_name_lower.includes('receptions')) {
    return player_prop_types.SEASON_RECEPTIONS
  }

  return null
}

export const get_market_type_for_running_back_season_props = ({
  marketName
}) => {
  const market_name_lower = marketName.toLowerCase()

  if (market_name_lower.includes('rushing yards')) {
    return player_prop_types.SEASON_RUSHING_YARDS
  }

  if (
    market_name_lower.includes('rushing tds') ||
    market_name_lower.includes('rushing touchdowns')
  ) {
    return player_prop_types.SEASON_RUSHING_TOUCHDOWNS
  }

  return null
}

export const get_market_type_for_most_rushing_yards = ({ marketName }) => {
  const market_name_lower = marketName.toLowerCase()

  if (market_name_lower.includes('afc') || market_name_lower.includes('nfc')) {
    return null
  }

  if (market_name_lower.includes('regular season')) {
    return player_prop_types.SEASON_LEADER_RUSHING_YARDS
  }

  return null
}

export const get_market_type = ({ marketName, marketType }) => {
  const market_type_match = markets[marketType]
  if (market_type_match) {
    return market_type_match
  }

  switch (marketType) {
    case 'REGULAR_SEASON_PROPS_-_QUARTERBACKS':
    case 'QUARTERBACK_REGULAR_SEASON_PROPS':
      return get_market_type_for_quarterback_season_props({ marketName })

    case 'REGULAR_SEASON_PROPS_-_WIDE_RECEIVERS':
    case 'WIDE_RECEIVER_REGULAR_SEASON_PROPS':
      return get_market_type_for_wide_receiver_season_props({ marketName })

    case 'REGULAR_SEASON_PROPS_-_RUNNING_BACKS':
    case 'RUNNING_BACK_REGULAR_SEASON_PROPS':
      return get_market_type_for_running_back_season_props({ marketName })

    case 'MOST_RUSHING_YARDS':
      return get_market_type_for_most_rushing_yards({ marketName })
  }

  return null
}

export const get_market_year = ({ marketName, source_event_name }) => {
  if (!source_event_name) {
    // likely not a game, check marketName for year
    const match = marketName.match(/(\d{4})/)
    if (match) {
      return Number(match[1])
    }
    // No year found in marketName
    return null
  }

  // TODO use source_event_name and event start date to match a game
  return null
}

const market_name_market_types = [
  'REGULAR_SEASON_PROPS_-_QUARTERBACKS',
  'QUARTERBACK_REGULAR_SEASON_PROPS',
  'REGULAR_SEASON_PROPS_-_WIDE_RECEIVERS',
  'WIDE_RECEIVER_REGULAR_SEASON_PROPS',
  'REGULAR_SEASON_PROPS_-_RUNNING_BACKS',
  'RUNNING_BACK_REGULAR_SEASON_PROPS'
]

export const get_player_string = ({ marketName, marketType, runnerName }) => {
  let use_market_name = false

  if (marketType.startsWith('PLAYER_')) {
    use_market_name = true
  }

  if (market_name_market_types.includes(marketType)) {
    use_market_name = true
  }

  if (use_market_name) {
    return format_market_name_player_name(marketName)
  }

  return format_selection_player_name(runnerName)
}

export const get_selection_metric_from_selection_name = (selection_name) => {
  const metric_line = selection_name.match(/(\d+(?:\.5+)?)\+?/)
  if (metric_line) {
    return Number(metric_line[1])
  }

  return null
}

export const get_market_details_from_wager = (wager_leg) => {
  if (!wager_leg.eventMarketDescription) {
    console.log(wager_leg)
    throw new Error('missing eventMarketDescription')
  }

  const get_metric_name = (stat_type) => {
    // example `1st Half Bills Total Points`
    if (stat_type.match(/1st Half .* Total Points/)) {
      return 'FIRST_HALF_TEAM_TOTAL_POINTS'
    }

    switch (stat_type) {
      case 'Passing TDs':
      case 'Alt Passing TDs':
        return 'PASSING_TOUCHDOWNS'

      case 'Passing Yds':
      case 'Alt Passing Yds':
        return 'PASSING_YARDS'

      case 'Rushing Yds':
      case 'Alt Rushing Yds':
        return 'RUSHING_YARDS'

      case 'Receiving Yds':
      case 'Alt Receiving Yds':
        return 'RECEIVING_YARDS'

      case 'Rushing + Receiving Yds':
      case 'Alt Rushing + Receiving Yds':
        return 'RUSHING_RECEIVING_YARDS'

      case 'Total Receptions':
      case 'Alt Receptions':
        return 'RECEPTIONS'

      case 'Total Match Points':
      case 'Alternate Total Points':
        return 'TOTAL_POINTS'

      case 'Alternate Spread':
      case 'Spread':
        return 'SPREAD'

      case 'First Half Spread':
        return 'FIRST_HALF_SPREAD'

      case 'Any Time Touchdown Scorer':
        return 'RUSHING_RECEIVING_TOUCHDOWNS'

      case 'Moneyline':
        return 'MONEYLINE'

      default:
        log(wager_leg)
        throw new Error(`Invalid stat type: ${stat_type}`)
    }
  }

  const check_over_under = (over_or_under) => {
    switch (over_or_under) {
      case 'OVER':
        return 'OVER'

      case 'UNDER':
        return 'UNDER'

      default:
        throw new Error(`Invalid over or under: ${over_or_under}`)
    }
  }

  const get_selection_name = ({ metric_name, over_or_under }) => {
    switch (metric_name) {
      case 'MONEYLINE':
      case 'SPREAD': {
        if (wager_leg.selectionName.includes('(')) {
          const team_name = wager_leg.selectionName.split('(')[0].trim()
          return fixTeam(team_name)
        } else {
          return fixTeam(wager_leg.selectionName)
        }
      }

      case 'FIRST_HALF_SPREAD': {
        return fixTeam(wager_leg.selectionName)
      }

      case 'PASSING_TOUCHDOWNS':
      case 'PASSING_YARDS':
      case 'RUSHING_YARDS':
      case 'RECEIVING_YARDS':
      case 'RUSHING_RECEIVING_YARDS':
      case 'RECEPTIONS':
      case 'TOTAL_POINTS':
      case 'FIRST_HALF_TEAM_TOTAL_POINTS':
      case 'RUSHING_RECEIVING_TOUCHDOWNS':
        return check_over_under(over_or_under)

      default:
        throw new Error(`Invalid metric name: ${metric_name}`)
    }
  }

  let player_name = null
  let nfl_team = null
  let market_desc_detail = null
  let metric_line = null

  if (wager_leg.eventMarketDescription.includes(' - ')) {
    player_name = wager_leg.eventMarketDescription.split(' - ')[0]

    market_desc_detail = wager_leg.eventMarketDescription.split(' - ')[1].trim()
  } else {
    market_desc_detail = wager_leg.eventMarketDescription
  }

  const metric_name = get_metric_name(market_desc_detail)
  const selection_name = get_selection_name({
    metric_name,
    over_or_under: wager_leg.overOrUnder
  })

  if (metric_name === 'RUSHING_RECEIVING_TOUCHDOWNS') {
    player_name = wager_leg.selectionName
  }

  if (wager_leg.parsedHandicap) {
    metric_line = Number(wager_leg.parsedHandicap)
  } else if (metric_name === 'TOTAL_POINTS' || metric_name === 'SPREAD') {
    // example 'Over (37.5)', Buffalo Bills (-3.5)
    metric_line = Number(wager_leg.selectionName.match(/\((.*?)\)/)[1])
  }

  if (metric_name === 'FIRST_HALF_TEAM_TOTAL_POINTS') {
    const matched_regex = wager_leg.eventMarketDescription.match(
      /1st Half (.*?) Total Points/
    )
    nfl_team = fixTeam(matched_regex[1])
  }

  let market_type = null

  if (player_name) {
    market_type = 'PLAYER_GAME_PROPS'
  } else if (nfl_team) {
    market_type = 'TEAM_GAME_PROPS'
  } else {
    market_type = 'GAME_PROPS'
  }

  return {
    market_type,
    player_name,
    nfl_team,
    metric_name,
    metric_line,
    selection_name,
    event_description: wager_leg.eventDescription,
    start_time: dayjs(wager_leg.startTime)
  }
}

export const getEvents = async () => {
  const url = `${config.fanduel_api_url}/content-managed-page?betexRegion=GBR&capiJurisdiction=intl&currencyCode=USD&exchangeLocale=en_US&includePrices=true&includeRaceCards=false&includeSeo=true&language=en&regionCode=NAMERICA&timezone=America%2FNew_York&includeMarketBlurbs=true&_ak=FhMFpcPWXMeyZxOx&page=CUSTOM&customPageId=nfl`

  log(`fetching ${url}`)
  const res = await fetch(url, {
    headers: config.fanduel_api_headers
  })
  const data = await res.json()

  const filtered = Object.values(data.attachments.events).filter(
    (e) => e.competitionId === nfl_game_compeition_id
  )
  const markets = Object.values(data.attachments.markets)

  return { nfl_games_events: filtered, markets }
}

export const getEventTab = async ({ eventId, tab }) => {
  const url = `${config.fanduel_api_url}/event-page?betexRegion=GBR&capiJurisdiction=intl&currencyCode=USD&exchangeLocale=en_US&includePrices=true&language=en&priceHistory=1&regionCode=NAMERICA&_ak=FhMFpcPWXMeyZxOx&eventId=${eventId}&tab=${tab}`

  log(`fetching ${url}`)
  const res = await fetch(url, {
    headers: config.fanduel_api_headers
  })
  const data = await res.json()

  return data
}

export const getWeeklySpecials = async () => {
  const url = `${config.fanduel_api_url}/content-managed-page?betexRegion=GBR&capiJurisdiction=intl&currencyCode=USD&exchangeLocale=en_US&includePrices=true&includeRaceCards=false&includeSeo=true&language=en&regionCode=NAMERICA&timezone=America%2FNew_York&includeMarketBlurbs=true&_ak=FhMFpcPWXMeyZxOx&page=CUSTOM&customPageId=nfl`

  log(`fetching ${url}`)
  const res = await fetch(url, {
    headers: config.fanduel_api_headers
  })
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

export const get_wagers = async ({
  fanduel_state,
  is_settled = true,
  authorization,
  start = 0,
  end = 200
} = {}) => {
  if (!fanduel_state) {
    log('missing fanduel state param')
    return null
  }

  if (!authorization) {
    log('missing fanduel authorization param')
    return null
  }

  const params = {
    locale: 'en_US',
    isSettled: is_settled,
    fromRecord: start,
    toRecord: end,
    sortDir: 'DESC',
    sortParam: 'CLOSEST_START_TIME',
    _ak: 'FhMFpcPWXMeyZxOx'
  }

  const headers = {
    'x-authentication': authorization
  }

  const url = `https://sbapi.${fanduel_state}.sportsbook.fanduel.com/api/my-bets?${queryString.stringify(
    params
  )}`

  log(`fetching ${url}`)
  let res = await fetch(url, { headers })
  if (!res.ok) {
    log(
      `Request failed with status ${res.status}: ${res.statusText}. Retrying...`
    )
    res = await fetch(url, { headers })
    if (!res.ok) {
      log(`Second request failed with status ${res.status}: ${res.statusText}`)
    }
  }

  const data = await res.json()

  return data
}

export const get_all_wagers = async ({
  fanduel_state,
  authorization,
  placed_after = null,
  placed_before = null
} = {}) => {
  if (!fanduel_state) {
    log('missing fanduel state param')
    return null
  }

  if (!authorization) {
    log('missing fanduel authorization param')
    return null
  }

  let results = []

  const placed_after_cutoff = placed_after ? dayjs(placed_after) : null
  const placed_before_cutoff = placed_before ? dayjs(placed_before) : null

  // Separate loops for settled and unsettled wagers
  const max_start_amount = 10000
  for (const is_settled of [true, false]) {
    const limit = 100
    let start = 0
    let end = start + limit
    let has_more = false
    let has_entered_range = false

    do {
      const fanduel_res = await get_wagers({
        fanduel_state,
        is_settled,
        authorization,
        start,
        end
      })

      if (fanduel_res && fanduel_res.bets && fanduel_res.bets.length) {
        const filtered_bets = fanduel_res.bets.filter((bet) => {
          const bet_date = dayjs(bet.placedDate)
          return (
            (!placed_after_cutoff || bet_date.isAfter(placed_after_cutoff)) &&
            (!placed_before_cutoff || bet_date.isBefore(placed_before_cutoff))
          )
        })
        results = results.concat(filtered_bets)

        has_entered_range = fanduel_res.bets.some((bet) => {
          const bet_date = dayjs(bet.placedDate)
          return (
            (!placed_after_cutoff || bet_date.isAfter(placed_after_cutoff)) &&
            (!placed_before_cutoff || bet_date.isBefore(placed_before_cutoff))
          )
        })

        // check if the latest wager is before the cutoff
        if (
          !placed_before_cutoff &&
          placed_after_cutoff &&
          !has_entered_range
        ) {
          const last_wager = fanduel_res.bets[fanduel_res.bets.length - 1]
          has_entered_range = dayjs(last_wager.placedDate).isBefore(
            placed_after_cutoff
          )
        }

        if (has_entered_range) {
          const last_wager = fanduel_res.bets[fanduel_res.bets.length - 1]
          if (placed_after_cutoff && placed_before_cutoff) {
            has_more =
              dayjs(last_wager.placedDate).isAfter(placed_after_cutoff) &&
              dayjs(last_wager.placedDate).isBefore(placed_before_cutoff)
          } else if (placed_after_cutoff) {
            has_more = dayjs(last_wager.placedDate).isAfter(placed_after_cutoff)
          } else if (placed_before_cutoff) {
            has_more = dayjs(last_wager.placedDate).isBefore(
              placed_before_cutoff
            )
          } else {
            has_more = fanduel_res.moreAvailable
          }
        } else {
          has_more = fanduel_res.moreAvailable
        }
      } else {
        has_more = false
      }

      start = start + limit
      end = end + limit

      if (start >= max_start_amount) {
        break
      }

      if (has_more) {
        await wait(4000)
      }
    } while (has_more)
  }

  // Sort the results by placedDate in descending order
  results.sort(
    (a, b) => dayjs(b.placedDate).unix() - dayjs(a.placedDate).unix()
  )

  return results
}
