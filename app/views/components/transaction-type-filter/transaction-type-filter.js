import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import TransactionsFilter from '@components/transactions-filter'
import { transaction_types, transaction_type_display_names } from '@constants'

export default class TransactionTypeFilter extends React.Component {
  render = () => {
    const state = {
      type: 'types',
      label: 'TYPE',
      values: []
    }

    for (const tran in transaction_types) {
      const value = transaction_types[tran]
      const label = transaction_type_display_names[value]
      state.values.push({
        value,
        label,
        selected: this.props.types.includes(value)
      })
    }

    return <TransactionsFilter {...state} />
  }
}

TransactionTypeFilter.propTypes = {
  types: ImmutablePropTypes.list
}
