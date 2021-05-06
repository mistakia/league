import { connect } from 'react-redux'

import { rosterActions } from '@core/rosters'
import { confirmationActions } from '@core/confirmations'

import SettingsTeamsTeamPlayer from './settings-teams-team-player'

const mapDispatchToProps = {
  update: rosterActions.updateValue,
  remove: rosterActions.remove,
  showConfirmation: confirmationActions.show
}

export default connect(null, mapDispatchToProps)(SettingsTeamsTeamPlayer)
