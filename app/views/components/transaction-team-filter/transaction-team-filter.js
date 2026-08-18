import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import TransactionsFilter from '@components/transactions-filter'

export default class TransactionTeamFilter extends React.Component {
  render = () => {
    const state = {
      type: 'teams',
      label: 'TEAMS',
      values: []
    }

    for (const team of this.props.leagueTeams) {
      state.values.push({
        value: team.team_id,
        label: team.name,
        selected: this.props.teams.includes(team.team_id)
      })
    }

    return <TransactionsFilter {...state} />
  }
}

TransactionTeamFilter.propTypes = {
  teams: ImmutablePropTypes.list,
  leagueTeams: ImmutablePropTypes.list
}
