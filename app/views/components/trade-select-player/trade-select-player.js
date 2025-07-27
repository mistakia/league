import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import { constants } from '@libs-shared'
import PlayerLabel from '@components/player-label'

import './trade-select-player.styl'

export default class TradeSelectPlayer extends React.Component {
  render = () => {
    const { player_map, isSelected } = this.props
    const classNames = ['trade__select-player']
    if (isSelected) classNames.push('selected')
    return (
      <div className={classNames.join(' ')}>
        <div className='player__name-position'>
          <Position pos={player_map.get('pos')} />
        </div>
        <div className='player__name-main'>
          <span>{player_map.get('pname')}</span>
          {constants.year === player_map.get('nfl_draft_year') && (
            <PlayerLabel label='R' type='rookie' description='Rookie' />
          )}
          <NFLTeam team={player_map.get('team')} />
        </div>
      </div>
    )
  }
}

TradeSelectPlayer.propTypes = {
  player_map: ImmutablePropTypes.map,
  isSelected: PropTypes.bool
}
