import React from 'react'
import PropTypes from 'prop-types'

import './player-row-opponent.styl'

export default class PlayerRowOpponent extends React.Component {
  render = () => {
    const { game, team } = this.props

    if (!game) {
      return <div className='player__row-opponent' />
    }

    const isHome = game.h === team
    const opp = isHome ? game.v : game.h

    return (
      <div className='player__row-opponent'>{(isHome ? 'v' : '@') + opp}</div>
    )
  }
}

PlayerRowOpponent.propTypes = {
  game: PropTypes.object,
  team: PropTypes.string
}
