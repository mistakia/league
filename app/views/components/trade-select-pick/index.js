import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getDraftPickById } from '@core/teams'

import TradeSelectPick from './trade-select-pick'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getDraftPickById,
  (league, pick) => ({ league, pick })
)

export default connect(
  mapStateToProps
)(TradeSelectPick)
