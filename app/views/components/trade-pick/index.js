import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getTeamsForCurrentLeague } from '@core/teams'

import TradePick from './trade-pick'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getTeamsForCurrentLeague,
  (league, teams) => ({ league, teams })
)

export default connect(mapStateToProps)(TradePick)
