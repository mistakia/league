import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/selectors'

import NFLTeamsFilter from './nfl-teams-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  nflTeams: players.get('nflTeams')
}))

export default connect(mapStateToProps)(NFLTeamsFilter)
