import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerNameExpanded from '@components/player-name-expanded'

import './trade-player.styl'
import { current_season } from '#constants'

export default class TradePlayer extends React.Component {
  render = () => {
    const { player_map } = this.props
    const pts_added_type = current_season.isOffseason
      ? 'season'
      : 'rest_of_season'
    return (
      <div className='trade__player'>
        <div className='trade__player-name'>
          <PlayerNameExpanded pid={player_map.get('pid')} hideActions />
        </div>
        <div className='trade__player-metric metric'>
          <label>Sal</label>${player_map.getIn(['player_salary'], 0)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Pts+</label>
          {player_map.getIn(['lineups', 'starter_plus_points'], 0).toFixed(1)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Be+</label>
          {player_map.getIn(['lineups', 'bench_plus_points'], 0).toFixed(1)}
        </div>
        <div className='trade__player-metric metric'>
          <label>Adj Val</label>
          {player_map
            .getIn(
              [
                'projected_points_added_positive_including_cap_savings',
                pts_added_type
              ],
              0
            )
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
