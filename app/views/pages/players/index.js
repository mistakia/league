import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { playerActions, getPlayers } from '@core/players'

import render from './players'

class PlayersPage extends React.Component {
  componentDidMount () {
    this.props.load()
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
  load: playerActions.load
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayersPage)
