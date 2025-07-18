import debug from 'debug'
import dayjs from 'dayjs'

import {
  player_prop_types,
  team_game_market_types
} from '#libs-shared/bookmaker-constants.mjs'
import { randomUUID as uuidv4 } from 'crypto'
import { wait } from '#libs-server'
import WebSocket from 'ws'
import db from '#db'
import { fixTeam } from '#libs-shared'
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

    case 12093:
    case 14119:
    case 16569:
      return player_prop_types.GAME_ALT_PASSING_YARDS

    default:
      log(`unknown offercategoryId 1000 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1001 = (subcategoryId) => {
  switch (subcategoryId) {
    case 9512:
      return player_prop_types.GAME_RECEIVING_YARDS

    case 9514:
      return player_prop_types.GAME_RUSHING_YARDS

    case 9518:
      return player_prop_types.GAME_RUSHING_ATTEMPTS

    case 9519:
      return player_prop_types.GAME_RECEPTIONS

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
      // TD Scorers - anytime touchdown scorer (uses rushing+receiving touchdowns)
      return player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS

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

    default:
      log(`unknown offercategoryId 1342 subcategoryId ${subcategoryId}`)
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

    case 530:
      return get_market_type_offer_530(subcategoryId)

    case 634:
      return get_market_type_offer_634(subcategoryId)

    case 1000:
      return get_market_type_offer_1000(subcategoryId)

    case 1001:
      return get_market_type_offer_1001(subcategoryId)

    case 1002:
      return get_market_type_offer_1002(subcategoryId)

    case 1003:
      return get_market_type_offer_1003(subcategoryId)

    case 1163:
      return get_market_type_offer_1163(subcategoryId)

    case 1342:
      return get_market_type_offer_1342(subcategoryId)

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
