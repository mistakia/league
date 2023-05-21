import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTransactions, getTeamsForCurrentLeague } from '@core/selectors'

import TransactionTeamFilter from './transaction-team-filter'

const mapStateToProps = createSelector(
  getTransactions,
  getTeamsForCurrentLeague,
  (transactions, leagueTeams) => ({ teams: transactions.teams, leagueTeams })
)

export default connect(mapStateToProps)(TransactionTeamFilter)
