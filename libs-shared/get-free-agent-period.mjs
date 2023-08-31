import dayjs from 'dayjs'

import { season } from './constants.mjs'

export default function getFreeAgentPeriod(auction_date) {
  const free_agency_live_auction_start = dayjs.unix(auction_date)
  const start = free_agency_live_auction_start
    .tz('America/New_York')
    .subtract('1', 'day')
    .startOf('day')

  return {
    start,
    free_agency_live_auction_start,
    end: season.start.add('1', 'week').subtract('1', 'minute')
  }
}
