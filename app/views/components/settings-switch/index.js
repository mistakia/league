import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { settingActions } from '@core/settings'

import SettingsSwitch from './settings-switch'

const mapStateToProps = createSelector(
  getApp,
  (app) => ({ app })
)

const mapDispatchToProps = {
  update: settingActions.update
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SettingsSwitch)
