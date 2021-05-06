import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getDraftPickById, getTeamsForCurrentLeague } from '@core/teams'

import TradeSelectPick from './trade-select-pick'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getDraftPickById,
  getTeamsForCurrentLeague,
  (league, pick, teams) => ({ league, pick, teams })
)

export default connect(mapStateToProps)(TradeSelectPick)
