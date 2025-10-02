import fetch from 'node-fetch'
import queryString from 'query-string'
import dayjs from 'dayjs'
import debug from 'debug'

import { wait } from '../wait.mjs'

const log = debug('fanduel:api')

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
