import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getTeamsForCurrentLeague } from '@core/teams'
import { getDraftPickValueByPick } from '@core/draft-pick-value'

import TradePick from './trade-pick'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getTeamsForCurrentLeague,
  getDraftPickValueByPick,
  (league, teams, draft_value) => ({ league, teams, draft_value })
)

export default connect(mapStateToProps)(TradePick)
