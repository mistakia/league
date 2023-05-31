import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeamsForCurrentLeague,
  getDraftPickValueByPick
} from '@core/selectors'

import TradePick from './trade-pick'

const mapStateToProps = createSelector(
  getTeamsForCurrentLeague,
  getDraftPickValueByPick,
  (teams, draft_value) => ({ teams, draft_value })
)

export default connect(mapStateToProps)(TradePick)
