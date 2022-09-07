import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/players'
import { getTeamsForCurrentLeague } from '@core/teams'

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
