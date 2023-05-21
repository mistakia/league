import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app } from '@core/selectors'
import { settingActions } from '@core/settings'

import SettingsSwitch from './settings-switch'

const mapStateToProps = createSelector(get_app, (app) => ({ app }))

const mapDispatchToProps = {
  update: settingActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(SettingsSwitch)
