import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@common'
import PlayerNameExpanded from '@components/player-name-expanded'

import './trade-player.styl'

export default class TradePlayer extends React.Component {
  render = () => {
    const { playerMap } = this.props
    const vorpType = constants.season.isOffseason ? '0' : 'ros'
    return (
      <div className='trade__player'>
        <div className='trade__player-name'>
          <PlayerNameExpanded pid={playerMap.get('pid')} hideActions />
        </div>
        <div className='trade__player-metric metric'>
          <label>Sal</label>${playerMap.getIn(['value'], 0)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Val</label>
          {playerMap.getIn(['vorp', vorpType], 0).toFixed(1)}
        </div>
        <div className='trade__player-metric metric'>
          <label>aVal</label>
          {playerMap.getIn(['vorp_adj', vorpType], 0).toFixed(1)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Pts+</label>
          {playerMap.getIn(['lineups', 'sp'], 0).toFixed(1)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Be+</label>
          {playerMap.getIn(['lineups', 'bp'], 0).toFixed(1)}
        </div>
      </div>
    )
  }
}

TradePlayer.propTypes = {
  playerMap: ImmutablePropTypes.map
}
