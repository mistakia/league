import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp, appActions } from '@core/app'
import { getCurrentLeague } from '@core/leagues'

import SelectYear from './select-year'

const mapStateToProps = createSelector(
  getApp,
  getCurrentLeague,
  (app, league) => ({
    year: app.year,
    league
  })
)

const mapDispatchToProps = {
  selectYear: appActions.selectYear
}

export default connect(mapStateToProps, mapDispatchToProps)(SelectYear)
