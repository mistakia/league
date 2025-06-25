import { connect } from 'react-redux'

import { roster_actions } from '@core/rosters'
import { confirmationActions } from '@core/confirmations'

import SettingsTeamsTeamPlayer from './settings-teams-team-player'

const mapDispatchToProps = {
  remove: roster_actions.remove,
  showConfirmation: confirmationActions.show
}

export default connect(null, mapDispatchToProps)(SettingsTeamsTeamPlayer)
