import React from 'react'
import PropTypes from 'prop-types'

import NFLTeamLogo from '@components/nfl-team-logo'

import './player-row-opponent.styl'

export default function PlayerRowOpponent({ game, team }) {
  if (!game) {
    return <div className='player__row-opponent' />
  }

  const isHome = game.h === team
  const opp = isHome ? game.v : game.h

  return (
    <div className='player__row-opponent'>
      {(isHome ? '' : '@') + opp}
      <NFLTeamLogo abbrv={opp} size={24} />
    </div>
  )
}

PlayerRowOpponent.propTypes = {
  game: PropTypes.object,
  team: PropTypes.string
}
