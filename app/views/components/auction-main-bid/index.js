import { connect } from 'react-redux'
import dayjs from 'dayjs'
import { createSelector } from 'reselect'

import { auction_actions } from '@core/auction'
import {
  get_app,
  getCurrentTeamRoster,
  get_current_league,
  get_auction_state,
  is_nominated_player_eligible
} from '@core/selectors'
import { notification_actions } from '@core/notifications'
import { get_free_agent_period } from '@libs-shared'

import AuctionMainBid from './auction-main-bid'

const map_state_to_props = createSelector(
  get_auction_state,
  get_app,
  getCurrentTeamRoster,
  is_nominated_player_eligible,
  get_current_league,
  (auction, app, roster, isEligible, league) => {
    const faPeriod = get_free_agent_period(league)
    const now = dayjs()
    const isEnded = now.isAfter(faPeriod.end)
    const isStarted = faPeriod.free_agency_live_auction_start.isBefore(now)

    return {
      isPaused: auction.isPaused,
      isComplete: auction.isComplete || isEnded,
      isCommish: app.userId === league.commishid,
      isLocked: auction.isLocked,
      isWinningBid: auction.transactions.first()
        ? auction.transactions.first().tid === app.teamId
        : false,
      selected_pid: auction.selected_pid,
      bidValue: auction.bid,
      isNominating: auction.nominatingTeamId === app.teamId,
      nominatingTeamId: auction.nominatingTeamId,
      timer: auction.timer,
      availableCap: roster.availableCap,
      isAboveCap: auction.bid >= roster.availableCap,
      nominated_pid: auction.nominated_pid,
      isEligible,
      isStarted,
      free_agency_live_auction_start: faPeriod.free_agency_live_auction_start,
      league
    }
  }
)

const map_dispatch_to_props = {
  nominate: auction_actions.nominate,
  bid: auction_actions.bid,
  showNotification: notification_actions.show
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(AuctionMainBid)
