import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getByeByTeam } from '@core/selectors'

import NFLTeamBye from './nfl-team-bye'

const mapStateToProps = createSelector(getByeByTeam, (bye) => ({ bye }))

export default connect(mapStateToProps)(NFLTeamBye)
