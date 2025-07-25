import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getByeByTeam } from '@core/selectors'

import NFLTeamBye from './nfl-team-bye'

const map_state_to_props = createSelector(getByeByTeam, (bye) => ({ bye }))

export default connect(map_state_to_props)(NFLTeamBye)
