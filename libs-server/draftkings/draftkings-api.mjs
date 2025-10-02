import debug from 'debug'
import dayjs from 'dayjs'
import WebSocket from 'ws'
import { randomUUID as uuidv4 } from 'crypto'

import { wait } from '#libs-server'
import { fetch_with_retry } from '#libs-server/proxy-manager.mjs'
import { get_draftkings_config } from './draftkings-config.mjs'

const log = debug('draft-kings:api')
const api_log = debug('draft-kings:api:request')

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
  const draftkings_config = await get_draftkings_config()
  const { headers = {}, draftkings_sportsbook_api_url: sportsbook_api_url } =
    draftkings_config
  const url = `${sportsbook_api_url}/sportscontent/dkusdc/v1/leagues/${leagueId}`

  return await draftkings_fetch_with_retry(url, { headers })
}

export const get_category_data_v1 = async ({
  leagueId = 88808,
  categoryId
}) => {
  const draftkings_config = await get_draftkings_config()
  const { headers = {}, draftkings_sportsbook_api_url: sportsbook_api_url } =
    draftkings_config
  const url = `${sportsbook_api_url}/sportscontent/dkusdc/v1/leagues/${leagueId}/categories/${categoryId}`

  return await draftkings_fetch_with_retry(url, { headers })
}

export const get_subcategory_data_v1 = async ({
  categoryId,
  subcategoryId
}) => {
  const draftkings_config = await get_draftkings_config()
  const { headers = {}, draftkings_sportsbook_api_url: sportsbook_api_url } =
    draftkings_config
  const url = `${sportsbook_api_url}/sportscontent/dkusdc/v1/leagues/88808/categories/${categoryId}/subcategories/${subcategoryId}`

  return await draftkings_fetch_with_retry(url, { headers })
}

// Event-specific API functions
export const get_event_categories = async ({ eventId }) => {
  const draftkings_config = await get_draftkings_config()
  const { headers = {}, draftkings_sportsbook_api_url: sportsbook_api_url } =
    draftkings_config
  const url = `${sportsbook_api_url}/sportscontent/dkusdc/v1/events/${eventId}/categories`

  const data = await draftkings_fetch_with_retry(url, { headers })

  // The API returns data with events[0].categories structure
  return data.events?.[0]?.categories || []
}

export const get_event_category_data = async ({ eventId, categoryId }) => {
  const draftkings_config = await get_draftkings_config()
  const { headers = {}, draftkings_sportsbook_api_url: sportsbook_api_url } =
    draftkings_config
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
