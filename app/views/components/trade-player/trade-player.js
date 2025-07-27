import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import PlayerNameExpanded from '@components/player-name-expanded'

import './trade-player.styl'

export default class TradePlayer extends React.Component {
  render = () => {
    const { player_map } = this.props
    const pts_added_type = constants.isOffseason ? '0' : 'ros'
    return (
      <div className='trade__player'>
        <div className='trade__player-name'>
          <PlayerNameExpanded pid={player_map.get('pid')} hideActions />
        </div>
        <div className='trade__player-metric metric'>
          <label>Sal</label>${player_map.getIn(['value'], 0)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Pts+</label>
          {player_map.getIn(['lineups', 'sp'], 0).toFixed(1)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Be+</label>
          {player_map.getIn(['lineups', 'bp'], 0).toFixed(1)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Adj Val</label>
          {player_map
            .getIn(['salary_adj_pts_added', pts_added_type], 0)
            .toFixed(1)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Val</label>
          {player_map.getIn(['pts_added', pts_added_type], 0).toFixed(1)}
        </div>
      </div>
    )
  }
}

TradePlayer.propTypes = {
  player_map: ImmutablePropTypes.map
}
