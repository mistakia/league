import { connect } from 'react-redux'
import dayjs from 'dayjs'
import { createSelector } from 'reselect'

import { get_app, get_current_league, get_auction_state } from '@core/selectors'
import { get_free_agent_period } from '#libs-shared'

import AuctionStatus from './auction-status'

const map_state_to_props = createSelector(
  get_auction_state,
  get_app,
  get_current_league,
  (auction, app, league) => {
    // The page mounts before the league necessarily arrives, and
    // `get_free_agent_period` destructures it -- so an early call THROWS and
    // takes the auction page down for every manager, exactly the failure this
    // panel exists to prevent. Render the not-scheduled line until it lands.
    if (!league) {
      return {
        isPaused: false,
        isComplete: false,
        isStarted: false,
        free_agency_period_start: null
      }
    }

    const faPeriod = get_free_agent_period(league)
    const now = dayjs()
    const isEnded = now.isAfter(faPeriod.end)
    // The period opening IS the auction opening.
    const isStarted = Boolean(faPeriod.start) && faPeriod.start.isBefore(now)

    return {
      auction_mode: auction.auction_mode,
      nominated_pid: auction.nominated_pid,
      nominating_team_id: auction.nominating_team_id,
      my_team_id: app.teamId,
      isPaused: auction.isPaused,
      is_initialized: auction.is_initialized,
      isComplete: auction.isComplete || isEnded,
      isStarted,
      free_agency_period_start: faPeriod.start,
      bidValue: auction.bid,
      block_end_at: auction.block_end_at,
      is_final_block: auction.is_final_block
    }
  }
)

export default connect(map_state_to_props)(AuctionStatus)
