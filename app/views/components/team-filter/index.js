import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers, getTeamsForCurrentLeague } from '@core/selectors'

import TeamFilter from './team-filter'

const mapStateToProps = createSelector(
  getPlayers,
  getTeamsForCurrentLeague,
  (players, teams) => ({ teamIds: players.get('teamIds'), teams })
)

export default connect(mapStateToProps)(TeamFilter)
