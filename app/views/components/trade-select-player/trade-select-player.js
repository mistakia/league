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
          {constants.year === playerMap.get('nfl_draft_year') && (
            <PlayerLabel label='R' type='rookie' description='Rookie' />
          )}
          <NFLTeam team={playerMap.get('team')} />
        </div>
      </div>
    )
  }
}

TradeSelectPlayer.propTypes = {
  playerMap: ImmutablePropTypes.map,
  isSelected: PropTypes.bool
}
