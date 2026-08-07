import dayjs from 'dayjs'

import { current_season } from '#constants'

// All four fields are `seasons` timestamptz columns as of the 2026-08-07
// conformance pass, so they arrive as a Date on the server and as an ISO string
// in the SPA. dayjs() accepts both; dayjs.unix() accepts neither and would have
// yielded an Invalid Date with nothing raising.
export default function get_free_agent_period({
  free_agency_period_start,
  free_agency_period_end,
  free_agency_live_auction_start,
  free_agency_live_auction_end
}) {
  const free_agency_live_auction_start_dayjs = dayjs(
    free_agency_live_auction_start
  )
  const free_agency_live_auction_end_dayjs = free_agency_live_auction_end
    ? dayjs(free_agency_live_auction_end)
    : null
  const start = free_agency_period_start
    ? dayjs(free_agency_period_start).tz('America/New_York')
    : free_agency_live_auction_start_dayjs
        .tz('America/New_York')
        .subtract('1', 'day')
        .startOf('day')

  return {
    start,
    free_agency_live_auction_start: free_agency_live_auction_start_dayjs,
    free_agency_live_auction_end: free_agency_live_auction_end_dayjs,
    end: free_agency_period_end
      ? dayjs(free_agency_period_end).tz('America/New_York')
      : current_season.regular_season_start
          .add('1', 'week')
          .subtract('1', 'minute')
  }
}
