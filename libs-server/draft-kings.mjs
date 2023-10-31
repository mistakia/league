import fetch from 'node-fetch'
import debug from 'debug'
import dayjs from 'dayjs'

import config from '#config'
import { constants } from '#libs-shared'
import { randomUUID as uuidv4 } from 'crypto'
import { wait } from '#libs-server'
import WebSocket from 'ws'

const log = debug('draft-kings')
// debug.enable('draft-kings')

export const categories = [
  {
    subcategoryId: 9524,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_YARDS
  },
  {
    subcategoryId: 9525,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_TOUCHDOWNS
  },
  {
    subcategoryId: 9522,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_COMPLETIONS
  },
  {
    subcategoryId: 9517,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_ATTEMPTS
  },
  {
    subcategoryId: 9526,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION
  },
  {
    subcategoryId: 9516,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_INTERCEPTIONS
  },
  {
    subcategoryId: 9512,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_RECEIVING_YARDS
  },
  {
    subcategoryId: 9514,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_RUSHING_YARDS
  },
  {
    subcategoryId: 9519,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_RECEPTIONS
  },
  {
    subcategoryId: 9523,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS
  },
  {
    subcategoryId: 9518,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_RUSHING_ATTEMPTS
  },
  {
    subcategoryId: 9527,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_LONGEST_RECEPTION
  },
  {
    subcategoryId: 9533,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_LONGEST_RUSH
  },
  {
    subcategoryId: 9521,
    offerCategoryId: 1002,
    type: constants.player_prop_types.GAME_TACKLES_ASSISTS
  },
  {
    subcategoryId: 11555,
    offerCategoryId: 1163,
    type: constants.player_prop_types.SUNDAY_MOST_PASSING_YARDS
  },
  {
    subcategoryId: 11557,
    offerCategoryId: 1163,
    type: constants.player_prop_types.SUNDAY_MOST_RUSHING_YARDS
  },
  {
    subcategoryId: 11556,
    offerCategoryId: 1163,
    type: constants.player_prop_types.GAME_MOST_RECEIVING_YARDS
  },
  {
    subcategoryId: 11819,
    offerCategoryId: 1003,
    type: constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS
  }
]

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

    const request_most_wagers = () => {
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
        request_most_wagers()
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
