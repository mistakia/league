import fetch from 'node-fetch'
import debug from 'debug'
import dayjs from 'dayjs'

import config from '#config'
import { player_prop_types } from '#libs-shared/bookmaker-constants.mjs'
import { randomUUID as uuidv4 } from 'crypto'
import { wait } from '#libs-server'
import WebSocket from 'ws'

const log = debug('draft-kings')
// debug.enable('draft-kings')

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
      return player_prop_types.GAME_ALT_RUSHING_YARDS

    case 12095:
      return player_prop_types.GAME_ALT_RECEIVING_YARDS

    case 12096:
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
      return player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS

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

export const get_market_type = ({ offerCategoryId, subcategoryId }) => {
  switch (offerCategoryId) {
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

export const get_offers = async ({ offerCategoryId, subcategoryId }) => {
  const url = `${config.draftkings_api_v6_url}/eventgroups/88808/categories/${offerCategoryId}/subcategories/${subcategoryId}?format=json`

  // log(`fetching ${url}`)
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()

  if (data && data.eventGroup && data.eventGroup.offerCategories) {
    const events = data.eventGroup.events || []
    const category = data.eventGroup.offerCategories.find(
      (c) => c.offerCategoryId === offerCategoryId
    )

    if (category) {
      const sub_category = category.offerSubcategoryDescriptors.find(
        (c) => c.subcategoryId === subcategoryId
      )

      if (
        sub_category &&
        sub_category.offerSubcategory &&
        sub_category.offerSubcategory.offers.length
      ) {
        return {
          offers: sub_category.offerSubcategory.offers.flat(),
          events
        }
      }
    }
  }

  return { offers: null, events: [] }
}

export const get_eventgroup_offer_categories = async () => {
  const url = `${config.draftkings_api_v6_url}/eventgroups/88808?format=json`

  // log(`fetching ${url}`)
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()

  if (data && data.eventGroup && data.eventGroup.offerCategories) {
    return data.eventGroup.offerCategories
  }

  return []
}

export const get_eventgroup_offer_subcategories = async ({
  offerCategoryId
}) => {
  const url = `${config.draftkings_api_v6_url}/eventgroups/88808/categories/${offerCategoryId}?format=json`

  // log(`fetching ${url}`)
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()

  if (data && data.eventGroup && data.eventGroup.offerCategories) {
    const category = data.eventGroup.offerCategories.find(
      (c) => c.offerCategoryId === offerCategoryId
    )

    if (category) {
      return category.offerSubcategoryDescriptors
    }
  }

  return []
}

export const get_websocket_connection = ({ authorization } = {}) =>
  new Promise((resolve, reject) => {
    if (!authorization) {
      return reject(new Error('missing authorization'))
    }

    const wss = new WebSocket(
      `${config.draftkings_wss_url}?jwt=${authorization}`,
      {
        headers: {
          Origin: 'https://sportsbook.draftkings.com',
          'User-Agent': config.user_agent
        }
      }
    )

    log(wss)

    wss.on('open', () => {
      log('wss connection opened')
      resolve(wss)
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
          if (placed_after_cutoff && placed_before_cutoff) {
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
          } else if (bets.length < limit) {
            has_more = false
          } else {
            has_more = true
          }
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
