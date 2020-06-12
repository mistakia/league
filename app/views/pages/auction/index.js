import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { auctionActions } from '@core/auction'
import { getPlayers } from '@core/players'

import render from './auction'

class AuctionPage extends React.Component {
  componentDidMount () {
    this.props.join()
  }

  render () {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getPlayers,
  (players) => ({ players })
)

const mapDispatchToProps = {
  join: auctionActions.join
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AuctionPage)
