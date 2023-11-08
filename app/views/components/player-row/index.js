import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeams,
  getPlayers,
  get_app,
  getPlayerStatus,
  getSelectedViewGroupedFields
} from '@core/selectors'
import { playerActions } from '@core/players'

import PlayerRow from './player-row'

const mapStateToProps = createSelector(
  getPlayers,
  get_app,
  getPlayerStatus,
  getTeams,
  getSelectedViewGroupedFields,
  (players, app, status, teams, selected_view_grouped_fields) => ({
    selected_view_grouped_fields,
    status,
    teams,
    teamId: app.teamId,
    is_logged_in: Boolean(app.userId),
    highlight_teamIds: players.get('highlight_teamIds'),
    selectedPlayer: players.get('selected'),
    week: players.get('week').get(0)
  })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerRow)
