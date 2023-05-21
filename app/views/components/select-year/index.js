import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { appActions } from '@core/app'
import { get_app, getCurrentLeague } from '@core/selectors'

import SelectYear from './select-year'

const mapStateToProps = createSelector(
  get_app,
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
