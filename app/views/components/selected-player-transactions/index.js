import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { List } from 'immutable'

import {
  getSelectedPlayer,
  getCurrentLeague,
  isBeforeExtensionDeadline
} from '@core/selectors'
import { playerActions } from '@core/players'

import SelectedPlayerTransactions from './selected-player-transactions'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getCurrentLeague,
  isBeforeExtensionDeadline,
  (playerMap, league, isBeforeExtensionDeadline) => {
    const transactions = playerMap.get('transactions', new List())
    const teams = {}
    let maxTransaction = { value: 0 }
    for (const transaction of transactions.valueSeq()) {
      if (
        !teams[transaction.tid] ||
        transaction.value > teams[transaction.tid].value
      ) {
        teams[transaction.tid] = transaction
      }
      if (
        !maxTransaction.timestamp ||
        transaction.value > maxTransaction.value
      ) {
        maxTransaction = transaction
      }
    }
    return {
      league,
      playerMap,
      teams,
      maxTransaction,
      isBeforeExtensionDeadline
    }
  }
)

const mapDispatchToProps = {
  load: playerActions.getPlayerTransactions
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerTransactions)
