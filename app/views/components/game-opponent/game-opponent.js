import React from 'react'
import PropTypes from 'prop-types'

import NFLTeamLogo from '@components/nfl-team-logo'

import './game-opponent.styl'

export default function GameOpponent({ is_home, opponent }) {
  if (!opponent) return null

  return (
    <div className='game-opponent'>
      {(is_home ? '' : '@') + opponent}
      <NFLTeamLogo abbrv={opponent} size={24} />
    </div>
  )
}

GameOpponent.propTypes = {
  is_home: PropTypes.bool,
  opponent: PropTypes.string
}
