import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { constants } from '@common'
import { getTransactions } from '@core/selectors'

import LeagueRecentTransactions from './league-recent-transactions'

const signing_types = [
  constants.transactions.ROSTER_ADD,
  constants.transactions.POACHED,
  constants.transactions.AUCTION_PROCESSED,
  constants.transactions.DRAFT,
  constants.transactions.PRACTICE_ADD
]

const mapStateToProps = createSelector(getTransactions, (transactions) => {
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

export default connect(mapStateToProps)(LeagueRecentTransactions)
