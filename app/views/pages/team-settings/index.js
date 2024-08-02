import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app } from '@core/selectors'

import TeamSettingsPage from './team-settings'

const mapStateToProps = createSelector(get_app, (app) => ({
  teamId: app.teamId
}))

export default connect(mapStateToProps)(TeamSettingsPage)
