import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_transactions, get_teams_for_current_league } from '@core/selectors'

import TransactionTeamFilter from './transaction-team-filter'

const map_state_to_props = createSelector(
  get_transactions,
  get_teams_for_current_league,
  (transactions, leagueTeams) => ({
    teams: transactions.teams,
    leagueTeams: leagueTeams.toList()
  })
)

export default connect(map_state_to_props)(TransactionTeamFilter)
