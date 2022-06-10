import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerName from '@components/player-name'
import NFLTeamBye from '@components/nfl-team-bye'

import './auction-nominated-player.styl'

export default class AuctionNominatedPlayer extends React.Component {
  render = () => {
    const { playerMap } = this.props

    return (
      <div className='auction__nominated-player'>
        <div className='nominated__player'>
          <PlayerName playerId={playerMap.get('player')} headshot />
        </div>
        <div className='nominated__player-details'>
          <div className='nominated__player-detail'>
            Retail: ${playerMap.getIn(['market_salary', '0'], 0)}
          </div>
          <div className='nominated__player-detail'>
            Inflation: ${playerMap.getIn(['market_salary', 'inflation'], 0)}
          </div>
          <div className='nominated__player-detail'>
            Bye: <NFLTeamBye team={playerMap.get('team')} />
          </div>
        </div>
      </div>
    )
  }
}

AuctionNominatedPlayer.propTypes = {
  playerMap: ImmutablePropTypes.map
}
