import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@common'
import PlayerNameExpanded from '@components/player-name-expanded'

import './trade-player.styl'

export default class TradePlayer extends React.Component {
  render = () => {
    const { player } = this.props
    const vorpType = constants.season.isOffseason ? '0' : 'ros'
    return (
      <div className='trade__player'>
        <div className='trade__player-name'>
          <PlayerNameExpanded playerId={player.player} hideActions />
        </div>
        <div className='trade__player-metric metric'>
          <label>Sal</label>${player.getIn(['value'], 0)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Val</label>
          {player.getIn(['vorp', vorpType], 0).toFixed(1)}
        </div>
        <div className='trade__player-metric metric'>
          <label>aVal</label>
          {player.getIn(['vorp_adj', vorpType], 0).toFixed(1)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Pts+</label>
          {player.getIn(['lineups', 'sp'], 0).toFixed(1)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Be+</label>
          {player.getIn(['lineups', 'bp'], 0).toFixed(1)}
        </div>
      </div>
    )
  }
}

TradePlayer.propTypes = {
  player: ImmutablePropTypes.record
}
