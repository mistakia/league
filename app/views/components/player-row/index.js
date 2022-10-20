import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import {
  getPlayers,
  playerActions,
  getPlayerStatus,
  getSelectedViewGroupedFields
} from '@core/players'
import { getTeams } from '@core/teams'

import PlayerRow from './player-row'

const mapStateToProps = createSelector(
  getPlayers,
  getApp,
  getPlayerStatus,
  getTeams,
  getSelectedViewGroupedFields,
  (players, app, status, teams, selected_view_grouped_fields) => ({
    selected_view_grouped_fields,
    status,
    teams,
    teamId: app.teamId,
    isLoggedIn: Boolean(app.userId),
    highlight_teamIds: players.get('highlight_teamIds'),
    selectedPlayer: players.get('selected'),
    week: players.get('week').get(0)
  })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerRow)
