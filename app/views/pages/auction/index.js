import React from 'react'

import render from './auction'

class AuctionPage extends React.Component {
  render () {
    return render.call(this)
  }
}

export default AuctionPage
