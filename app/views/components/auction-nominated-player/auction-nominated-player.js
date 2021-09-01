import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerName from '@components/player-name'
import NFLTeamBye from '@components/nfl-team-bye'

import './auction-nominated-player.styl'

export default class AuctionNominatedPlayer extends React.Component {
  render = () => {
    const { player, vbaseline, valueType } = this.props

    const inflationType = valueType === 'ros' ? 'inflation' : 'inflationSeason'

    return (
      <div className='auction__nominated-player'>
        <div className='nominated__player'>
          <PlayerName playerId={player.player} headshot />
        </div>
        <div className='nominated__player-details'>
          <div className='nominated__player-detail'>
            Retail: ${player.getIn(['values', valueType, vbaseline], 0)}
          </div>
          <div className='nominated__player-detail'>
            Inflation: ${player.getIn(['values', inflationType, vbaseline], 0)}
          </div>
          <div className='nominated__player-detail'>
            Bye: <NFLTeamBye team={player.team} />
          </div>
        </div>
      </div>
    )
  }
}

AuctionNominatedPlayer.propTypes = {
  player: ImmutablePropTypes.record,
  vbaseline: PropTypes.string,
  valueType: PropTypes.string
}
