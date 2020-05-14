import React from 'react'

import render from './transactions'

class TransactionsPage extends React.Component {
  render () {
    return render.call(this)
  }
}

export default TransactionsPage
