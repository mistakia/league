import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/players'

import render from './draft'

class DraftPage extends React.Component {
  render () {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getPlayers,
  (players) => ({ players })
)

export default connect(
  mapStateToProps
)(DraftPage)
