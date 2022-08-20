import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerName from '@components/player-name'
import NFLTeamBye from '@components/nfl-team-bye'

import './auction-nominated-player.styl'

export default function AuctionNominatedPlayer({
  playerMap,
  market_salary_adjusted
}) {
  return (
    <div className='auction__nominated-player'>
      <div className='nominated__player'>
        <PlayerName pid={playerMap.get('pid')} headshot />
      </div>
      <div className='nominated__player-details'>
        <div className='nominated__player-detail'>
          Market: ${playerMap.getIn(['market_salary', '0'], 0)}
        </div>
        <div className='nominated__player-detail'>
          Adjusted: ${market_salary_adjusted}
        </div>
        <div className='nominated__player-detail'>
          Bye: <NFLTeamBye team={playerMap.get('team')} />
        </div>
      </div>
    </div>
  )
}

AuctionNominatedPlayer.propTypes = {
  playerMap: ImmutablePropTypes.map,
  market_salary_adjusted: PropTypes.number
}
