import React from 'react'
import PropTypes from 'prop-types'

import GameOpponent from '@components/game-opponent'

export default function PlayerRowOpponent({ game, nfl_team }) {
  if (!game) {
    return <div className='game-opponent' />
  }

  const is_home = game.home_nfl_team === nfl_team
  const opponent = is_home ? game.away_nfl_team : game.home_nfl_team

  return <GameOpponent {...{ is_home, opponent }} />
}

PlayerRowOpponent.propTypes = {
  game: PropTypes.object,
  nfl_team: PropTypes.string
}
