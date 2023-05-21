import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app } from '@core/selectors'

import LeagueSettingsPage from './league-settings'

const mapStateToProps = createSelector(get_app, (app) => ({
  leagueId: app.leagueId
}))

export default connect(mapStateToProps)(LeagueSettingsPage)
