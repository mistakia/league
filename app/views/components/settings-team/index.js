import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { teamActions } from '@core/teams'
import {
  get_team_by_id_for_current_year,
  getCurrentLeague
} from '@core/selectors'

import SettingsTeam from './settings-team'

const mapStateToProps = createSelector(
  get_team_by_id_for_current_year,
  getCurrentLeague,
  (team, league) => ({ team, is_hosted: Boolean(league.hosted) })
)

const mapDispatchToProps = {
  update: teamActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(SettingsTeam)
