import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getSources } from '@core/sources'
import { getPlayers } from '@core/players'

import SettingsPage from './settings'

const mapStateToProps = createSelector(
  getApp,
  getSources,
  getPlayers,
  (app, sources, players) => ({
    teamIds: app.teamIds,
    userId: app.userId,
    vbaseline: app.vbaseline,
    leagueIds: app.leagueIds,
    sourceIds: sources.toList().map(s => s.uid),
    baselines: players.get('baselines').toJS()
  })
)

export default connect(
  mapStateToProps
)(SettingsPage)
