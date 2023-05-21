import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/selectors'
import PlayerRosterTotal from './player-roster-total'

const mapStateToProps = createSelector(getCurrentLeague, (league) => ({
  league
}))

export default connect(mapStateToProps)(PlayerRosterTotal)
