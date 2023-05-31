import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamById, getPlayerById } from '@core/selectors'

import DraftPick from './draft-pick'

const mapStateToProps = createSelector(
  getPlayerById,
  getTeamById,
  (playerMap, team) => ({ playerMap, team })
)

export default connect(mapStateToProps)(DraftPick)
