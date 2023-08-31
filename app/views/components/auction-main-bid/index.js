import { connect } from 'react-redux'
import dayjs from 'dayjs'
import { createSelector } from 'reselect'

import { auctionActions } from '@core/auction'
import {
  get_app,
  getCurrentTeamRoster,
  getCurrentLeague,
  getAuction,
  isNominatedPlayerEligible
} from '@core/selectors'
import { notificationActions } from '@core/notifications'
import { getFreeAgentPeriod } from '@libs-shared'

import AuctionMainBid from './auction-main-bid'

const mapStateToProps = createSelector(
  getAuction,
  get_app,
  getCurrentTeamRoster,
  isNominatedPlayerEligible,
  getCurrentLeague,
  (auction, app, roster, isEligible, league) => {
    const faPeriod = getFreeAgentPeriod(league.free_agency_live_auction_start)
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

const mapDispatchToProps = {
  nominate: auctionActions.nominate,
  bid: auctionActions.bid,
  showNotification: notificationActions.show
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionMainBid)
