import React from 'react'

import { constants } from '@common'
import TransactionsFilter from '@components/transactions-filter'

export default class TransactionTypeFilter extends React.Component {
  render = () => {
    const state = {
      type: 'types',
      label: 'TYPE',
      values: []
    }

    for (const tran in constants.transactions) {
      const value = constants.transactions[tran]
      const label = constants.transactionsDetail[value]
      state.values.push({
        value,
        label,
        selected: this.props.types.includes(value)
      })
    }

    return <TransactionsFilter {...state} />
  }
}
