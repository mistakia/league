// @ts-check
import dayjs from 'dayjs'

import { current_season } from '#constants'

/**
 * The free agency period, which IS the auction.
 *
 * There used to be two events inside this window: the period opening, and a
 * scheduled live auction some days later. The redesign has one. Elections and
 * nominations open when the period opens and the auction runs until it closes,
 * so `free_agency_live_auction_start` and `free_agency_live_auction_end` named
 * events that no longer occur and are gone. Anything that used to ask "has the
 * auction started" is asking about `start`.
 *
 * Both fields are `seasons` timestamptz columns as of the 2026-08-07 conformance
 * pass, so they arrive as a Date on the server and as an ISO string in the SPA
 * -- hence `Date | string` rather than the row type's bare `Date`. dayjs()
 * accepts both; dayjs.unix() accepts neither and would have yielded an Invalid
 * Date with nothing raising.
 *
 * @param {object} season
 * @param {Date | string | null} [season.free_agency_period_start]
 * @param {Date | string | null} [season.free_agency_period_end]
 */
export default function get_free_agent_period({
  free_agency_period_start,
  free_agency_period_end
}) {
  return {
    // Required. The old fallback derived the period start from the auction
    // start minus a day, which is unreachable now that there is no auction
    // start; a league with no period start has no free agency period at all,
    // which is what every caller's null check already means.
    start: free_agency_period_start
      ? dayjs(free_agency_period_start).tz('America/New_York')
      : null,
    // Two hours before the Regular Season begins. The code has known the
    // Article XII Section 6 boundary all along -- this fallback previously
    // subtracted one minute, and the operator's two-hour margin makes it two
    // hours. Week 1 begins at the first Tuesday anchor, nine days before the
    // opener, so this is that instant and not opening day.
    end: free_agency_period_end
      ? dayjs(free_agency_period_end).tz('America/New_York')
      : current_season.regular_season_start.add(1, 'week').subtract(2, 'hours')
  }
}
