import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getDraftPickById, getTeamsForCurrentLeague } from '@core/selectors'

import TradeSelectPick from './trade-select-pick'

const mapStateToProps = createSelector(
  getDraftPickById,
  getTeamsForCurrentLeague,
  (pick, teams) => ({ pick, teams })
)

export default connect(mapStateToProps)(TradeSelectPick)
