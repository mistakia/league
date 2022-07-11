import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStandingsYear, standingsActions } from '@core/standings'
import { getCurrentLeague } from '@core/leagues'

import StandingsSelectYear from './standings-select-year'

const mapStateToProps = createSelector(
  getStandingsYear,
  getCurrentLeague,
  (year, league) => ({
    year,
    league
  })
)

const mapDispatchToProps = {
  selectYear: standingsActions.selectYear
}

export default connect(mapStateToProps, mapDispatchToProps)(StandingsSelectYear)
