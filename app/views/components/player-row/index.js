import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_teams_for_current_year,
  getPlayers,
  get_app,
  getPlayerStatus
} from '@core/selectors'
import { playerActions } from '@core/players'
import { getSelectedViewGroupedFields } from '@core/players/selectors'

import PlayerRow from './player-row'

const mapStateToProps = createSelector(
  getPlayers,
  get_app,
  getPlayerStatus,
  get_teams_for_current_year,
  getSelectedViewGroupedFields,
  (players, app, status, teams, selected_view_grouped_fields) => ({
    selected_view_grouped_fields,
    status,
    teams,
    teamId: app.teamId,
    is_logged_in: Boolean(app.userId),
    highlight_teamIds: players.get('highlight_teamIds'),
    week: players.get('week').get(0),
    selectedPlayer: players.get('selected')
  })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerRow)
