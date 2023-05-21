import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getCurrentLeague,
  getTeamsForCurrentLeague,
  getDraftPickValueByPick
} from '@core/selectors'

import TradePick from './trade-pick'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getTeamsForCurrentLeague,
  getDraftPickValueByPick,
  (league, teams, draft_value) => ({ league, teams, draft_value })
)

export default connect(mapStateToProps)(TradePick)
