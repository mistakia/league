import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/players'

import CollegeDivisionFilter from './college-division-filter'

const mapStateToProps = createSelector(
  getPlayers,
  (players) => ({
    collegeDivisions: players.get('collegeDivisions')
  })
)

export default connect(
  mapStateToProps
)(CollegeDivisionFilter)
