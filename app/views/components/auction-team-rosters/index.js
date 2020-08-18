import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getRostersForCurrentLeague } from '@core/rosters'
import { getTeamsForCurrentLeague } from '@core/teams'

import AuctionTeamRosters from './auction-team-rosters'

const mapStateToProps = createSelector(
  getRostersForCurrentLeague,
  getTeamsForCurrentLeague,
  (rosters, teams) => ({ rosters, teams })
)

export default connect(
  mapStateToProps
)(AuctionTeamRosters)
