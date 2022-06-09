import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getPlayerById } from '@core/players'
import { getTeamById } from '@core/teams'

import DraftPick from './draft-pick'

const mapStateToProps = createSelector(
  getPlayerById,
  getTeamById,
  getCurrentLeague,
  (playerMap, team, league) => ({ playerMap, team, league })
)

export default connect(mapStateToProps)(DraftPick)
