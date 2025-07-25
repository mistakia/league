import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { constants } from '@libs-shared'
import { get_transactions } from '@core/selectors'

import LeagueRecentTransactions from './league-recent-transactions'

const signing_types = [
  constants.transactions.ROSTER_ADD,
  constants.transactions.POACHED,
  constants.transactions.AUCTION_PROCESSED,
  constants.transactions.DRAFT,
  constants.transactions.PRACTICE_ADD
]

const map_state_to_props = createSelector(get_transactions, (transactions) => {
  const items = transactions.get('items')
  const signings = items.filter((i) => signing_types.includes(i.type))
  const releases = items.filter(
    (i) => i.type === constants.transactions.ROSTER_RELEASE
  )

  return {
    signings,
    releases
  }
})

export default connect(map_state_to_props)(LeagueRecentTransactions)
