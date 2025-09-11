import debug from 'debug'
import dayjs from 'dayjs'

import {
  player_prop_types,
  team_game_market_types,
  awards_prop_types,
  futures_types,
  team_season_types,
  game_props_types,
  division_specials_types
} from '#libs-shared/bookmaker-constants.mjs'
import { constants, fixTeam } from '#libs-shared'
import { randomUUID as uuidv4 } from 'crypto'
import { wait } from '#libs-server'
import WebSocket from 'ws'
import db from '#db'
import { fetch_with_retry } from '#libs-server/proxy-manager.mjs'

const log = debug('draft-kings')
const api_log = debug('draft-kings:api')
// debug.enable('draft-kings')

export const get_team_from_participant = ({ participant, participantType }) => {
  if (participantType !== 'Team') {
    return null
  }

  if (!participant) {
    return null
  }

  let team

  try {
    team = fixTeam(participant)
  } catch (err) {
    log(err)
  }

  return team
}

export const extract_player_name_from_event = (event_name) => {
  if (!event_name || typeof event_name !== 'string') {
    return null
  }

  // Match pattern: "NFL 20XX/XX - Player Name"
  // Examples: "NFL 2025/26 - Kyler Murray", "NFL 2024/25 - Josh Allen"
  const nfl_futures_pattern = /^NFL\s+20\d{2}\/\d{2}\s+-\s+(.+)$/
  const match = event_name.match(nfl_futures_pattern)

  if (match && match[1]) {
    const player_name = match[1].trim()
    log(`Extracted player name from NFL futures event: ${player_name}`)
    return player_name
  }

  return null
}

const get_draftkings_config = async () => {
  const config_row = await db('config')
    .where({ key: 'draftkings_config' })
    .first()
  return config_row?.value
}

export const format_selection_type = (selection_name) => {
  if (!selection_name) {
    return null
  }

  const words = selection_name.toLowerCase().split(/\s+/)

  if (words.includes('over')) {
    return 'OVER'
  } else if (words.includes('under')) {
    return 'UNDER'
  } else if (words.includes('yes')) {
    return 'YES'
  } else if (words.includes('no')) {
    return 'NO'
  } else if (/^\d+\+$/.test(selection_name)) {
    return 'OVER'
  }

  return null
}

export const extract_year_from_market_name = (source_market_name) => {
  if (!source_market_name || typeof source_market_name !== 'string') {
    return null
  }

  // Match explicit season patterns like "2025/26", "2024/25"
  const season_pattern = /(20\d{2})\/\d{2}/
  const season_match = source_market_name.match(season_pattern)

  if (season_match && season_match[1]) {
    const year = Number(season_match[1])
    log(
      `Extracted year from season pattern: ${year} from "${source_market_name}"`
    )
    return year
  }

  // For markets containing "Regular Season" without explicit year, default to current season year
  if (source_market_name.toLowerCase().includes('regular season')) {
    log(
      `Regular Season market detected, defaulting to ${constants.season.year}: "${source_market_name}"`
    )
    return constants.season.year
  }

  // For game props and futures without explicit years, default to current season year
  // This covers markets like "Game Props - Overtime", "Futures - Champion", etc.
  const game_prop_patterns = [
    /game props/i,
    /overtime/i,
    /safety/i,
    /futures/i,
    /champion/i,
    /winner/i,
    /mvp/i,
    /player futures/i,
    /division specials/i,
    /awards/i
  ]

  for (const pattern of game_prop_patterns) {
    if (pattern.test(source_market_name)) {
      log(
        `Game prop/futures market detected, defaulting to ${constants.season.year}: "${source_market_name}"`
      )
      return constants.season.year
    }
  }

  // If no year can be determined, return null
  log(`Could not extract year from market name: "${source_market_name}"`)
  return null
}

export const get_market_type_offer_634 = (subcategoryId) => {
  switch (subcategoryId) {
    case 7512:
      return player_prop_types.SEASON_LEADER_PASSING_YARDS

    case 7524:
      return player_prop_types.SEASON_LEADER_PASSING_TOUCHDOWNS

    case 7562:
      return player_prop_types.SEASON_LEADER_RUSHING_YARDS

    case 7608:
      return player_prop_types.SEASON_LEADER_RUSHING_TOUCHDOWNS

    case 7725:
      return player_prop_types.SEASON_LEADER_RECEIVING_YARDS

    case 8130:
      return player_prop_types.SEASON_LEADER_RECEIVING_TOUCHDOWNS

    case 8161:
      return player_prop_types.SEASON_LEADER_SACKS

    case 13400:
      return player_prop_types.SEASON_LEADER_INTERCEPTIONS

    default:
      log(`unknown offercategoryId 634 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1000 = (subcategoryId) => {
  switch (subcategoryId) {
    case 9516:
      return player_prop_types.GAME_PASSING_INTERCEPTIONS

    case 9517:
      return player_prop_types.GAME_PASSING_ATTEMPTS

    case 9522:
      return player_prop_types.GAME_PASSING_COMPLETIONS

    case 9524:
      return player_prop_types.GAME_PASSING_YARDS

    case 9525:
      return player_prop_types.GAME_PASSING_TOUCHDOWNS

    case 9526:
      return player_prop_types.GAME_PASSING_LONGEST_COMPLETION

    case 9532:
      return player_prop_types.GAME_PASSING_RUSHING_YARDS

    case 11969:
      return player_prop_types.GAME_LEADER_PASSING_YARDS

    case 12093:
    case 14119:
    case 16569:
      return player_prop_types.GAME_ALT_PASSING_YARDS

    case 15937:
      return player_prop_types.GAME_PASSING_INTERCEPTIONS

    case 16568:
      return player_prop_types.GAME_PASSING_TOUCHDOWNS

    case 16573:
      return player_prop_types.GAME_FIRST_QUARTER_ALT_PASSING_YARDS

    case 16819:
      return player_prop_types.GAME_PASSING_INTERCEPTIONS

    case 16888:
      return player_prop_types.GAME_PASSING_ATTEMPTS

    case 16889:
      return player_prop_types.GAME_PASSING_COMPLETIONS

    case 16896:
      return player_prop_types.GAME_PASSING_RUSHING_YARDS

    case 18487:
    case 18490:
    case 18493:
      return player_prop_types.GAME_PASSING_YARDS

    case 18496:
    case 18500:
      return player_prop_types.GAME_LEADER_PASSING_YARDS

    case 18522:
      return player_prop_types.GAME_PASSING_ATTEMPTS

    case 18523:
      return player_prop_types.GAME_PASSING_COMPLETIONS

    case 18526:
      return player_prop_types.GAME_PASSING_INTERCEPTIONS

    default:
      log(`unknown offercategoryId 1000 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1001 = (subcategoryId) => {
  switch (subcategoryId) {
    case 9512:
      return player_prop_types.GAME_RECEIVING_YARDS

    case 9513:
      return player_prop_types.GAME_RECEIVING_TOUCHDOWNS

    case 9514:
      return player_prop_types.GAME_RUSHING_YARDS

    case 9518:
      return player_prop_types.GAME_RUSHING_ATTEMPTS

    case 9519:
      return player_prop_types.GAME_RECEPTIONS

    case 9520:
      return player_prop_types.GAME_RUSHING_TOUCHDOWNS

    case 9523:
      return player_prop_types.GAME_RUSHING_RECEIVING_YARDS

    case 9527:
      return player_prop_types.GAME_LONGEST_RECEPTION

    case 9533:
      return player_prop_types.GAME_LONGEST_RUSH

    case 12094:
    case 14118:
    case 16571:
      return player_prop_types.GAME_ALT_RUSHING_YARDS

    case 12095:
      return player_prop_types.GAME_ALT_RECEIVING_YARDS

    case 12096:
    case 16572:
      return player_prop_types.GAME_ALT_RUSHING_RECEIVING_YARDS

    case 14126:
      return player_prop_types.GAME_LEADER_RUSHING_YARDS

    case 14880:
      return player_prop_types.GAME_LONGEST_RUSH

    case 16074:
    case 16575:
    case 18488:
    case 18491:
    case 18494:
      return player_prop_types.GAME_RUSHING_YARDS

    case 16820:
    case 18524:
      return player_prop_types.GAME_RUSHING_ATTEMPTS

    default:
      log(`unknown offercategoryId 1001 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1002 = (subcategoryId) => {
  switch (subcategoryId) {
    case 9521:
      return player_prop_types.GAME_TACKLES_ASSISTS

    default:
      log(`unknown offercategoryId 1002 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1003 = (subcategoryId) => {
  switch (subcategoryId) {
    case 11819:
    case 12438:
      return player_prop_types.ANYTIME_TOUCHDOWN

    case 11820:
      return player_prop_types.GAME_FIRST_TEAM_TOUCHDOWN_SCORER

    default:
      log(`unknown offercategoryId 1003 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1163 = (subcategoryId) => {
  switch (subcategoryId) {
    case 11555:
      return player_prop_types.SUNDAY_LEADER_PASSING_YARDS

    case 11556:
      return player_prop_types.GAME_LEADER_RECEIVING_YARDS

    case 11557:
      return player_prop_types.SUNDAY_LEADER_RUSHING_YARDS

    default:
      log(`unknown offercategoryId 1163 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1342 = (subcategoryId) => {
  switch (subcategoryId) {
    case 14113:
    case 14117:
    case 16570:
      return player_prop_types.GAME_ALT_RECEIVING_YARDS

    case 14114:
      return player_prop_types.GAME_RECEIVING_YARDS

    case 14115:
      return player_prop_types.GAME_RECEPTIONS

    case 14116:
      return player_prop_types.GAME_LONGEST_RECEPTION

    case 14124:
      return player_prop_types.GAME_LEADER_RECEIVING_YARDS

    case 16233:
      return player_prop_types.GAME_ALT_LONGEST_RECEPTION

    case 16821:
      return player_prop_types.GAME_ALT_RECEPTIONS

    case 14225:
    case 16574:
    case 18489:
    case 18492:
    case 18495:
      return player_prop_types.GAME_RECEIVING_YARDS

    case 14881:
      return player_prop_types.GAME_LONGEST_RECEPTION

    case 18498:
    case 18502:
      return player_prop_types.GAME_LEADER_RECEIVING_YARDS

    case 18520:
      return player_prop_types.GAME_LEADER_RECEIVING_YARDS

    case 18527:
      return player_prop_types.GAME_RECEPTIONS

    default:
      log(`unknown offercategoryId 1342 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1759 = (subcategoryId) => {
  switch (subcategoryId) {
    case 17147:
      return player_prop_types.SEASON_PASSING_YARDS

    case 17148:
      return player_prop_types.SEASON_PASSING_TOUCHDOWNS

    case 17223:
      return player_prop_types.SEASON_RUSHING_YARDS

    case 17314:
      return player_prop_types.SEASON_RECEIVING_YARDS

    case 17315:
      return player_prop_types.SEASON_RECEIVING_TOUCHDOWNS

    default:
      log(`unknown offercategoryId 1759 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1595 = (subcategoryId) => {
  switch (subcategoryId) {
    case 15379:
      return player_prop_types.SEASON_LEADER_PASSING_YARDS

    case 18156:
      return player_prop_types.SEASON_LEADER_PASSING_TOUCHDOWNS

    case 15380:
      return player_prop_types.SEASON_LEADER_RUSHING_YARDS

    case 15670:
      return player_prop_types.SEASON_LEADER_RUSHING_TOUCHDOWNS

    case 15381:
      return player_prop_types.SEASON_LEADER_RECEIVING_YARDS

    case 15651:
      return player_prop_types.SEASON_LEADER_RECEIVING_TOUCHDOWNS

    case 15885:
      return player_prop_types.SEASON_LEADER_RECEPTIONS

    case 15661:
      return player_prop_types.SEASON_LEADER_SACKS

    case 15820:
      return player_prop_types.SEASON_LEADER_INTERCEPTIONS

    default:
      log(`unknown offercategoryId 1595 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_787 = (subcategoryId) => {
  switch (subcategoryId) {
    case 13339:
      return awards_prop_types.SEASON_MVP

    case 13340:
      return awards_prop_types.OFFENSIVE_PLAYER_OF_THE_YEAR

    case 13341:
      return awards_prop_types.DEFENSIVE_PLAYER_OF_THE_YEAR

    case 13342:
      return awards_prop_types.OFFENSIVE_ROOKIE_OF_THE_YEAR

    case 13343:
      return awards_prop_types.DEFENSIVE_ROOKIE_OF_THE_YEAR

    case 13344:
      return awards_prop_types.COACH_OF_THE_YEAR

    case 13345:
      return awards_prop_types.COMEBACK_PLAYER_OF_THE_YEAR

    case 18166:
      return awards_prop_types.PROTECTOR_OF_THE_YEAR

    case 15907:
      return awards_prop_types.MVP_AND_SUPER_BOWL_WINNER

    default:
      log(`unknown offercategoryId 787 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_529 = (subcategoryId) => {
  switch (subcategoryId) {
    case 10500:
      return futures_types.SUPER_BOWL_WINNER

    case 4651:
      return futures_types.CONFERENCE_WINNER

    case 5629:
      return futures_types.DIVISION_WINNER

    case 9159:
      return futures_types.STAGE_OF_ELIMINATION

    case 10249:
      return futures_types.EXACT_RESULT

    case 7302:
      return futures_types.NAME_THE_FINALISTS

    case 10107:
      return futures_types.NUMBER_1_SEED

    case 15901:
      return futures_types.WINNING_CONFERENCE

    case 6447:
      return futures_types.CHAMPION_SPECIALS

    default:
      log(`unknown offercategoryId 529 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1286 = (subcategoryId) => {
  switch (subcategoryId) {
    case 17455:
      return team_season_types.TEAM_REGULAR_SEASON_WINS

    case 13356:
      return team_season_types.TEAM_EXACT_REGULAR_SEASON_WINS

    case 13365:
      return team_season_types.TEAM_MOST_REGULAR_SEASON_WINS

    case 13367:
      return team_season_types.TEAM_FEWEST_REGULAR_SEASON_WINS

    case 13364:
      return team_season_types.TEAM_LONGEST_WINNING_STREAK

    case 13360:
      return team_season_types.TEAM_PERFECT_SEASON

    case 13368:
      return team_season_types.TEAM_WINLESS_SEASON

    default:
      log(`unknown offercategoryId 1286 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1076 = (subcategoryId) => {
  switch (subcategoryId) {
    case 15399:
      return team_season_types.TEAM_TO_MAKE_PLAYOFFS

    case 15398:
      return team_season_types.TEAM_TO_MISS_PLAYOFFS

    default:
      log(`unknown offercategoryId 1076 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_528 = (subcategoryId) => {
  switch (subcategoryId) {
    case 4659:
      return game_props_types.GAME_TOTAL_POINTS_ODD_EVEN

    case 5873:
      return game_props_types.GAME_WINNING_MARGIN

    case 9313:
      return game_props_types.GAME_FIRST_SCORING_PLAY_TYPE

    case 9315:
      return game_props_types.GAME_FIRST_TO_SCORE

    case 9316:
      return game_props_types.GAME_SAFETY_SCORED

    case 9319:
      return game_props_types.GAME_BOTH_TEAMS_TO_SCORE

    case 9325:
      return game_props_types.GAME_LAST_TO_SCORE

    case 9567:
      return game_props_types.GAME_RACE_TO_POINTS

    case 9590:
      return game_props_types.GAME_TWO_POINT_CONVERSION

    case 13459:
      return game_props_types.GAME_OVERTIME

    default:
      log(`unknown subcategory for offer category 528: ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_820 = (subcategoryId) => {
  switch (subcategoryId) {
    case 7624:
      return division_specials_types.DIVISION_WINS

    case 13041:
      return division_specials_types.DIVISION_FINISHING_POSITION

    case 13206:
      return division_specials_types.DIVISION_LEADER_PASSING_YARDS

    case 13297:
      return division_specials_types.DIVISION_LEADER_RUSHING_YARDS

    default:
      log(`unknown subcategory for offer category 820: ${subcategoryId}`)
      return null
  }
}

const get_market_type_offer_492 = ({ subcategoryId, betOfferTypeId }) => {
  if (subcategoryId === 4518 && betOfferTypeId) {
    switch (betOfferTypeId) {
      case 1:
        return team_game_market_types.GAME_SPREAD

      case 2:
        return team_game_market_types.GAME_MONEYLINE

      case 6:
        return team_game_market_types.GAME_TOTAL

      case 13195:
        return team_game_market_types.GAME_ALT_SPREAD

      case 13196:
        return team_game_market_types.GAME_ALT_TOTAL

      default:
        log(`unknown betOfferTypeId ${betOfferTypeId}`)
        return null
    }
  }

  if (subcategoryId === 8411) {
    return team_game_market_types.GAME_MONEYLINE
  }

  if (subcategoryId === 9712) {
    return game_props_types.GAME_HALF_TIME_FULL_TIME
  }

  if (subcategoryId === 10398) {
    return game_props_types.GAME_HALF_TIME_FULL_TIME
  }

  if (subcategoryId === 13195 && betOfferTypeId === 1) {
    return team_game_market_types.GAME_ALT_SPREAD
  }

  if (subcategoryId === 13196 && betOfferTypeId === 6) {
    return team_game_market_types.GAME_ALT_TOTAL
  }

  return null
}

const get_market_type_offer_530 = (subcategoryId) => {
  switch (subcategoryId) {
    case 4653:
      return team_game_market_types.GAME_ALT_TEAM_TOTAL

    default:
      log(`unknown offercategoryId 530 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type = ({
  offerCategoryId,
  subcategoryId,
  betOfferTypeId
}) => {
  offerCategoryId = Number(offerCategoryId) || null
  subcategoryId = Number(subcategoryId) || null
  betOfferTypeId = Number(betOfferTypeId) || null

  switch (offerCategoryId) {
    case 492:
      return get_market_type_offer_492({ subcategoryId, betOfferTypeId })

    case 529:
      return get_market_type_offer_529(subcategoryId)

    case 530:
      return get_market_type_offer_530(subcategoryId)

    case 634:
      return get_market_type_offer_634(subcategoryId)

    case 787:
      return get_market_type_offer_787(subcategoryId)

    case 1000:
      return get_market_type_offer_1000(subcategoryId)

    case 1001:
      return get_market_type_offer_1001(subcategoryId)

    case 1002:
      return get_market_type_offer_1002(subcategoryId)

    case 1003:
      return get_market_type_offer_1003(subcategoryId)

    case 1076:
      return get_market_type_offer_1076(subcategoryId)

    case 1163:
      return get_market_type_offer_1163(subcategoryId)

    case 1286:
      return get_market_type_offer_1286(subcategoryId)

    case 1342:
      return get_market_type_offer_1342(subcategoryId)

    case 1595:
      return get_market_type_offer_1595(subcategoryId)

    case 1759:
      return get_market_type_offer_1759(subcategoryId)

    case 528:
      return get_market_type_offer_528(subcategoryId)

    case 820:
      return get_market_type_offer_820(subcategoryId)

    default:
      log(`unknown offerCategoryId ${offerCategoryId}`)
      return null
  }
}

// V1 API functions
const get_draftkings_v1_config = async () => {
  const draftkings_config = await get_draftkings_config()
  return {
    headers: draftkings_config?.headers || {},
    sportsbook_api_url: draftkings_config?.draftkings_sportsbook_api_url
  }
}

const draftkings_fetch_with_retry = async (url, options) => {
  api_log(`DK API REQUEST: ${url}`)
  const response = await fetch_with_retry(url, options, {
    max_retries: 3,
    use_proxy: true,
    exponential_backoff: true,
    initial_delay: 1000,
    max_delay: 10000
  })

  return await response.json()
}

export const get_league_data_v1 = async ({ leagueId = 88808 } = {}) => {
  const { headers, sportsbook_api_url } = await get_draftkings_v1_config()
  const url = `${sportsbook_api_url}/sportscontent/dkusdc/v1/leagues/${leagueId}`

  return await draftkings_fetch_with_retry(url, { headers })
}

export const get_category_data_v1 = async ({
  leagueId = 88808,
  categoryId
}) => {
  const { headers, sportsbook_api_url } = await get_draftkings_v1_config()
  const url = `${sportsbook_api_url}/sportscontent/dkusdc/v1/leagues/${leagueId}/categories/${categoryId}`

  return await draftkings_fetch_with_retry(url, { headers })
}

export const get_subcategory_data_v1 = async ({
  categoryId,
  subcategoryId
}) => {
  const { headers, sportsbook_api_url } = await get_draftkings_v1_config()
  const url = `${sportsbook_api_url}/sportscontent/dkusdc/v1/leagues/88808/categories/${categoryId}/subcategories/${subcategoryId}`

  return await draftkings_fetch_with_retry(url, { headers })
}

// Event-specific API functions
export const get_event_categories = async ({ eventId }) => {
  const { headers, sportsbook_api_url } = await get_draftkings_v1_config()
  const url = `${sportsbook_api_url}/sportscontent/dkusdc/v1/events/${eventId}/categories`

  const data = await draftkings_fetch_with_retry(url, { headers })

  // The API returns data with events[0].categories structure
  return data.events?.[0]?.categories || []
}

export const get_event_category_data = async ({ eventId, categoryId }) => {
  const { headers, sportsbook_api_url } = await get_draftkings_v1_config()
  const url = `${sportsbook_api_url}/sportscontent/dkusdc/v1/events/${eventId}/categories/${categoryId}`

  return await draftkings_fetch_with_retry(url, { headers })
}

export const get_websocket_connection = ({ authorization } = {}) =>
  new Promise((resolve, reject) => {
    if (!authorization) {
      return reject(new Error('missing authorization'))
    }

    get_draftkings_config()
      .then((draftkings_config) => {
        const wss = new WebSocket(
          `${draftkings_config.draftkings_wss_url}?jwt=${authorization}`,
          {
            headers: {
              origin: 'https://sportsbook.draftkings.com',
              user_agent: draftkings_config.user_agent
            }
          }
        )

        log(wss)

        wss.on('open', () => {
          log('wss connection opened')
          resolve(wss)
        })

        wss.on('error', (error) => {
          reject(error)
        })
      })
      .catch((error) => {
        reject(error)
      })
  })

export const get_wagers = ({
  wss,
  placed_after = null,
  placed_before = null
}) =>
  new Promise((resolve, reject) => {
    if (!wss) {
      return reject(new Error('missing wss'))
    }

    const placed_after_cutoff = placed_after ? dayjs(placed_after) : null
    const placed_before_cutoff = placed_before ? dayjs(placed_before) : null
    const limit = 100
    let start = 0
    let has_more = false
    let has_entered_range = false
    let results = []

    wss.send(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'InitializeBetsPageRequest',
        id: uuidv4(),
        params: {
          betsRequest: {
            filter: { status: 'All' },
            pagination: {
              count: limit,
              skip: 0
            }
          }
        }
      })
    )

    const request_LEADER_wagers = () => {
      log(`requesting ${limit} more wagers`)
      wss.send(
        JSON.stringify({
          id: uuidv4(),
          jsonrpc: '2.0',
          method: 'BetsRequest',
          params: {
            filter: { status: 'All' },
            pagination: {
              count: limit,
              skip: start
            }
          }
        })
      )
    }

    const handle_bet_message = async (bets) => {
      log(`received ${bets.length} wagers`)
      const filtered_bets = bets.filter((bet) => {
        const bet_date = dayjs(bet.placementDate)
        return (
          (!placed_after_cutoff || bet_date.isAfter(placed_after_cutoff)) &&
          (!placed_before_cutoff || bet_date.isBefore(placed_before_cutoff))
        )
      })
      results = results.concat(filtered_bets)

      has_entered_range = bets.some((bet) => {
        const bet_date = dayjs(bet.placementDate)
        return (
          (!placed_after_cutoff || bet_date.isAfter(placed_after_cutoff)) &&
          (!placed_before_cutoff || bet_date.isBefore(placed_before_cutoff))
        )
      })

      if (bets.length) {
        if (has_entered_range) {
          const last_wager = bets[bets.length - 1]
          log({
            last_wager,
            placed_after_cutoff,
            placed_before_cutoff
          })
          if (bets.length < limit) {
            has_more = false
          } else if (placed_after_cutoff && placed_before_cutoff) {
            has_more =
              dayjs(last_wager.placementDate).isAfter(placed_after_cutoff) &&
              dayjs(last_wager.placementDate).isBefore(placed_before_cutoff)
          } else if (placed_after_cutoff) {
            has_more = dayjs(last_wager.placementDate).isAfter(
              placed_after_cutoff
            )
          } else if (placed_before_cutoff) {
            has_more = dayjs(last_wager.placementDate).isBefore(
              placed_before_cutoff
            )
          } else {
            has_more = true
          }
        } else if (bets.length < limit) {
          has_more = false
        } else {
          has_more = true
        }
      } else {
        has_more = false
      }

      if (has_more) {
        start = start + limit
        await wait(5000)
        request_LEADER_wagers()
      } else {
        resolve(results)
      }
    }

    wss.on('message', async (data) => {
      const json = JSON.parse(data)
      log(json)
      if (
        json.result &&
        json.result.initial &&
        json.result.initial.bets &&
        json.result.initial.bets.length
      ) {
        await handle_bet_message(json.result.initial.bets)
      } else if (json.result && json.result.bets && json.result.bets.length) {
        await handle_bet_message(json.result.bets)
      }
    })
  })

export const get_all_wagers = async ({
  authorization,
  placed_after = null,
  placed_before = null
} = {}) => {
  if (!authorization) {
    throw new Error('missing authorization')
  }

  const wss = await get_websocket_connection({ authorization })
  wss.on('error', (error) => {
    log(error)
  })
  const wagers = await get_wagers({ wss, placed_after, placed_before })

  wss.terminate()

  return wagers
}

const get_draftkings_contests = async () => {
  const draftkings_config = await get_draftkings_config()
  const url = draftkings_config.draftkings_contests_url
  api_log(`DK API REQUEST: ${url}`)
  const data = await fetch_with_retry(url).then((res) => res.json())
  return data
}

export const get_draftkings_draft_groups = async () => {
  const data = await get_draftkings_contests()
  return data.DraftGroups
}

export const get_draftkings_nfl_draft_groups = async () => {
  const draft_groups = await get_draftkings_draft_groups()
  return draft_groups.filter(
    (draft_group) => draft_group.Sport === 'NFL' && draft_group.GameTypeId === 1
  )
}

export const get_draftkings_draft_group_draftables = async ({
  draft_group_id
}) => {
  const draftkings_config = await get_draftkings_config()
  const url = `${draftkings_config.draftkings_salary_url}/${draft_group_id}/draftables`
  api_log(`DK API REQUEST: ${url}`)
  const data = await fetch_with_retry(url).then((res) => res.json())
  return data
}
