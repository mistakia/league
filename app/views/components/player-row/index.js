import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_teams_for_current_year,
  get_players_state,
  get_app,
  getPlayerStatus
} from '@core/selectors'
import { player_actions } from '@core/players'
import { getSelectedViewGroupedFields } from '@core/players/selectors'

import PlayerRow from './player-row'

const map_state_to_props = createSelector(
  get_players_state,
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

const map_dispatch_to_props = {
  select: player_actions.select_player
}

export default connect(map_state_to_props, map_dispatch_to_props)(PlayerRow)
