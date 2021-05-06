import { Map } from 'immutable'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getPlayers } from '@core/players'

import SettingsValue from './settings-value'

const mapStateToProps = createSelector(getApp, getPlayers, (app, players) => ({
  vbaseline: app.vbaseline,
  baselines: players.getIn(['baselines', '0'], new Map()).toJS()
}))

export default connect(mapStateToProps)(SettingsValue)
