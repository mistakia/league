import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamById, getPlayerById, getCurrentLeague } from '@core/selectors'

import DraftPick from './draft-pick'

const mapStateToProps = createSelector(
  getPlayerById,
  getTeamById,
  getCurrentLeague,
  (playerMap, team, league) => ({ playerMap, team, league })
)

export default connect(mapStateToProps)(DraftPick)
