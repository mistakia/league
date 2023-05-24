import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeams, getPlayers, get_app, getPlayerStatus } from '@core/selectors'
import { playerActions } from '@core/players'

import PlayerRow from './player-row'

const mapStateToProps = createSelector(
  getPlayers,
  get_app,
  getPlayerStatus,
  getTeams,
  (players, app, status, teams) => ({
    status,
    teams,
    teamId: app.teamId,
    isLoggedIn: Boolean(app.userId),
    highlight_teamIds: players.get('highlight_teamIds'),
    selectedPlayer: players.get('selected')
  })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerRow)
