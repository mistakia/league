import { connect } from 'react-redux'

import { roster_actions } from '@core/rosters'
import { confirmation_actions } from '@core/confirmations'

import SettingsTeamsTeamPlayer from './settings-teams-team-player'

const map_dispatch_to_props = {
  remove: roster_actions.remove,
  showConfirmation: confirmation_actions.show
}

export default connect(null, map_dispatch_to_props)(SettingsTeamsTeamPlayer)
