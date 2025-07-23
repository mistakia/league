import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, getCurrentLeague, getPlayers } from '@core/selectors'

import Roster from './roster'

const mapStateToProps = createSelector(
  getCurrentLeague,
  get_app,
  getPlayers,
  (league, app, players) => ({
    league,
    team_id: app.teamId,
    players
  })
)

export default connect(mapStateToProps)(Roster)
