import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Position from '@components/position'
import Team from '@components/team'
import { constants } from '@common'
import PlayerLabel from '@components/player-label'

import './trade-select-player.styl'

export default class TradeSelectPlayer extends React.Component {
  render = () => {
    const { playerMap, isSelected } = this.props
    const classNames = ['trade__select-player']
    if (isSelected) classNames.push('selected')
    return (
      <div className={classNames.join(' ')}>
        <div className='player__name-position'>
          <Position pos={playerMap.get('pos')} />
        </div>
        <div className='player__name-main'>
          <span>{playerMap.get('pname')}</span>
          {constants.season.year === playerMap.get('draft_year') && (
            <PlayerLabel label='R' type='rookie' description='Rookie' />
          )}
          <Team team={playerMap.get('team')} />
        </div>
      </div>
    )
  }
}

TradeSelectPlayer.propTypes = {
  playerMap: ImmutablePropTypes.map,
  isSelected: PropTypes.bool
}
