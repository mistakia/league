import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers, getTeamsForCurrentLeague } from '@core/selectors'

import HighlightTeam from './highlight-team'

const mapStateToProps = createSelector(
  getPlayers,
  getTeamsForCurrentLeague,
  (players, teams) => ({
    highlight_teamIds: players.get('highlight_teamIds'),
    teams
  })
)

export default connect(mapStateToProps)(HighlightTeam)
