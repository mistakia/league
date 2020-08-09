import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getSources } from '@core/sources'
import { getPlayers } from '@core/players'
import { getCurrentLeague } from '@core/leagues'

import SettingsPage from './settings'

const mapStateToProps = createSelector(
  getApp,
  getSources,
  getPlayers,
  getCurrentLeague,
  (app, sources, players, league) => ({
    teamId: app.teamId,
    leagueId: app.leagueId,
    userId: app.userId,
    vbaseline: app.vbaseline,
    sourceIds: sources.toList().map(s => s.uid),
    baselines: players.get('baselines').toJS(),
    isHosted: !!league.hosted
  })
)

export default connect(
  mapStateToProps
)(SettingsPage)
