import { connect } from 'react-redux'
import dayjs from 'dayjs'
import { createSelector } from 'reselect'

import { auctionActions, getAuction } from '@core/auction'
import { getApp } from '@core/app'
import { isPlayerEligible, getCurrentTeamRoster } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { notificationActions } from '@core/notifications'
import { getFreeAgentPeriod } from '@common'

import AuctionMainBid from './auction-main-bid'

const mapStateToProps = createSelector(
  getAuction,
  getApp,
  getCurrentTeamRoster,
  isPlayerEligible,
  getCurrentLeague,
  (auction, app, roster, isEligible, league) => {
    const faPeriod = getFreeAgentPeriod(league.adate)
    const now = dayjs()
    const isEnded = now.isAfter(faPeriod.end)
    const adate = dayjs.unix(league.adate)
    const isStarted = adate.isBefore(now)

    return {
      isPaused: auction.isPaused,
      isComplete: auction.isComplete || isEnded,
      isCommish: app.userId === league.commishid,
      isLocked: auction.isLocked,
      isWinningBid: auction.transactions.first()
        ? auction.transactions.first().tid === app.teamId
        : false,
      selected: auction.selected,
      bidValue: auction.bid,
      isNominating: auction.nominatingTeamId === app.teamId,
      nominatingTeamId: auction.nominatingTeamId,
      timer: auction.timer,
      availableCap: roster.availableCap,
      isAboveCap: auction.bid >= roster.availableCap,
      isEligible,
      isStarted,
      adate,
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
