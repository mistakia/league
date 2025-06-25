import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { List } from 'immutable'

import {
  getSelectedPlayer,
  getCurrentLeague,
  isBeforeExtensionDeadline
} from '@core/selectors'
import { constants, getExtensionAmount } from '@libs-shared'
import { player_actions } from '@core/players'

import SelectedPlayerTransactions from './selected-player-transactions'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getCurrentLeague,
  isBeforeExtensionDeadline,
  (player_map, league, is_before_extension_deadline) => {
    const transactions = player_map.get('transactions', new List())
    const teams = {}
    let max_transaction = { value: 0 }

    // Process transactions to find max per team and overall max
    for (const transaction of transactions.valueSeq()) {
      if (
        !teams[transaction.tid] ||
        transaction.value > teams[transaction.tid].value
      ) {
        teams[transaction.tid] = transaction
      }
      if (
        !max_transaction.timestamp ||
        transaction.value > max_transaction.value
      ) {
        max_transaction = transaction
      }
    }

    // Find draft transaction
    const draft_transaction = transactions.find(
      (t) => t.type === constants.transactions.DRAFT
    )

    // Calculate extension salaries
    const extensions = player_map.get('extensions', 0)
    const value = player_map.get('value')
    const extension_salaries = []
    const extended_salary = is_before_extension_deadline
      ? getExtensionAmount({
          pos: player_map.get('pos'),
          tag: player_map.get('tag'),
          extensions,
          league,
          value
        })
      : value
    extension_salaries.push({
      year: constants.year,
      extended_salary
    })

    let salary = extended_salary
    let year = constants.year
    for (let i = extensions; extension_salaries.length < 4; i++) {
      salary = getExtensionAmount({
        pos: player_map.get('pos'),
        extensions: i,
        league,
        value: salary
      })
      year += 1
      extension_salaries.push({
        year,
        extended_salary: salary
      })
    }

    return {
      league,
      playerMap: player_map,
      teams,
      maxTransaction: max_transaction,
      isBeforeExtensionDeadline: is_before_extension_deadline,
      draft_transaction,
      extension_salaries,
      extensions,
      value,
      loadingTransactions: player_map.get('loadingTransactions', false)
    }
  }
)

const mapDispatchToProps = {
  load: player_actions.load_player_transactions
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerTransactions)
