import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getFilteredPlayers } from '@core/players'

import render from './players'

class PlayersPage extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      order: 'desc',
      orderBy: 'vorp.available'
    }
  }

  render () {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getFilteredPlayers,
  (players) => ({ players })
)

export default connect(
  mapStateToProps
)(PlayersPage)
