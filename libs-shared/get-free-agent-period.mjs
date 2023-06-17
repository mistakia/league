import dayjs from 'dayjs'

import { season } from './constants.mjs'

export default function getFreeAgentPeriod(auction_date) {
  const adate = dayjs.unix(auction_date)
  const start = adate.tz('America/New_York').subtract('1', 'day').startOf('day')

  return {
    start,
    adate,
    end: season.start.add('1', 'week').subtract('1', 'minute')
  }
}
