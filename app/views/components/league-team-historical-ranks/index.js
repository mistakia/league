import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_league_historical_ranks_by_team_id } from '@core/selectors'

import LeagueTeamHistoricalRanks from './league-team-historical-ranks'

const map_state_to_props = createSelector(
  get_league_historical_ranks_by_team_id,
  (historical_ranks) => ({
    historical_ranks
  })
)

export default connect(map_state_to_props, null)(LeagueTeamHistoricalRanks)
