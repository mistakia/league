import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import dayjs from 'dayjs'

import { app_actions } from '@core/app'
import { get_app, get_current_league, get_auction_state } from '@core/selectors'
import { get_free_agent_period } from '@libs-shared'

import App from './app'

App.propTypes = {
  children: PropTypes.element
}

const map_state_to_props = createSelector(
  get_app,
  get_current_league,
  get_auction_state,
  (app, league, auction) => {
    const faPeriod = get_free_agent_period(league)
    const now = dayjs()
    const free_agency_live_auction_start = league.free_agency_live_auction_start
      ? dayjs.unix(league.free_agency_live_auction_start)
      : null
    const auction_is_ended = now.isAfter(faPeriod.end)
    const auction_is_started =
      free_agency_live_auction_start &&
      free_agency_live_auction_start.isBefore(now)

    return {
      isPending: app.isPending,
      is_hosted: Boolean(league.hosted),
      isCommish: app.userId === league.commishid,
      is_auction_live:
        auction_is_started &&
        !(auction.isComplete || auction_is_ended) &&
        !league.free_agency_live_auction_end,
      is_logged_in: Boolean(app.userId)
    }
  }
)

const map_dispatch_to_props = {
  init: app_actions.init
}

export default connect(map_state_to_props, map_dispatch_to_props)(App)
