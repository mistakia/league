import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_transactions } from '@core/selectors'

import LeagueRecentTransactions from './league-recent-transactions'
import { transaction_types } from '@constants'

const signing_types = [
  transaction_types.ROSTER_ADD,
  transaction_types.POACHED,
  transaction_types.AUCTION_PROCESSED,
  transaction_types.DRAFT,
  transaction_types.PRACTICE_ADD
]

const map_state_to_props = createSelector(get_transactions, (transactions) => {
  const items = transactions.get('items')
  const signings = items.filter((i) => signing_types.includes(i.type))
  const releases = items.filter(
    (i) => i.type === transaction_types.ROSTER_RELEASE
  )

  return {
    signings,
    releases
  }
})

export default connect(map_state_to_props)(LeagueRecentTransactions)
