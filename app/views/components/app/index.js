import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import dayjs from 'dayjs'

import { appActions } from '@core/app'
import { get_app, getCurrentLeague, getAuction } from '@core/selectors'
import { getFreeAgentPeriod } from '@libs-shared'

import App from './app'

App.propTypes = {
  children: PropTypes.element
}

const mapStateToProps = createSelector(
  get_app,
  getCurrentLeague,
  getAuction,
  (app, league, auction) => {
    const faPeriod = getFreeAgentPeriod(league.adate)
    const now = dayjs()
    const adate = league.adate ? dayjs.unix(league.adate) : null
    const auction_is_ended = now.isAfter(faPeriod.end)
    const auction_is_started = adate && adate.isBefore(now)

    return {
      isPending: app.isPending,
      isHosted: Boolean(league.hosted),
      isCommish: app.userId === league.commishid,
      is_auction_live:
        auction_is_started && !(auction.isComplete || auction_is_ended)
    }
  }
)

const mapDispatchToProps = {
  init: appActions.init
}

export default connect(mapStateToProps, mapDispatchToProps)(App)
