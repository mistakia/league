import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getCurrentLeague,
  getDraftPickById,
  getTeamsForCurrentLeague
} from '@core/selectors'

import TradeSelectPick from './trade-select-pick'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getDraftPickById,
  getTeamsForCurrentLeague,
  (league, pick, teams) => ({ league, pick, teams })
)

export default connect(mapStateToProps)(TradeSelectPick)
