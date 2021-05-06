import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'

import Roster from './roster'

const mapStateToProps = createSelector(getCurrentLeague, (league) => ({
  league
}))

export default connect(mapStateToProps)(Roster)
