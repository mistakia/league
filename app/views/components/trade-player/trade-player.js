import React from 'react'

import Position from '@components/position'
import Team from '@components/team'
import { constants } from '@common'

import './trade-player.styl'

export default class TradePlayer extends React.Component {
  render = () => {
    const { player, handleClick, isSelected } = this.props
    const classNames = ['trade__player']
    if (isSelected) classNames.push('selected')
    return (
      <div className={classNames.join(' ')} onClick={handleClick}>
        <div className='player__name-position'>
          <Position pos={player.pos1} />
        </div>
        <div className='player__name-main'>
          <span>{player.pname}</span>
          {(constants.season.year === player.draft_year) &&
            <sup className='player__label-rookie'>
              R
            </sup>}
          <Team team={player.team} />
        </div>
      </div>
    )
  }
}
