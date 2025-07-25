import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { team_actions } from '@core/teams'
import {
  get_team_by_id_for_current_year,
  get_current_league
} from '@core/selectors'

import SettingsTeam from './settings-team'

const map_state_to_props = createSelector(
  get_team_by_id_for_current_year,
  get_current_league,
  (team, league) => ({ team, is_hosted: Boolean(league.hosted) })
)

const map_dispatch_to_props = {
  update: team_actions.update
}

export default connect(map_state_to_props, map_dispatch_to_props)(SettingsTeam)
