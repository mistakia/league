import React from 'react'

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
        value: team.uid,
        label: team.name,
        selected: this.props.teams.includes(team.uid)
      })
    }

    return (
      <TransactionsFilter {...state} />
    )
  }
}
