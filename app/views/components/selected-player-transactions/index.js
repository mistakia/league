import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { playerActions, getSelectedPlayer } from '@core/players'

import SelectedPlayerTransactions from './selected-player-transactions'

const mapStateToProps = createSelector(getSelectedPlayer, (player) => {
  const transactions = player.get('transactions')
  const teams = {}
  let maxTransaction = { value: 0 }
  for (const transaction of transactions.valueSeq()) {
    if (
      !teams[transaction.tid] ||
      transaction.value > teams[transaction.tid].value
    ) {
      teams[transaction.tid] = transaction
    }
    if (!maxTransaction.timestamp || transaction.value > maxTransaction.value) {
      maxTransaction = transaction
    }
  }
  return {
    player,
    teams,
    maxTransaction
  }
})

const mapDispatchToProps = {
  load: playerActions.getPlayerTransactions
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerTransactions)
