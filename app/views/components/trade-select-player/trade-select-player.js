import React from 'react'

import Position from '@components/position'
import Team from '@components/team'
import { constants } from '@common'

import './trade-select-player.styl'

export default class TradeSelectPlayer extends React.Component {
  render = () => {
    const { player, isSelected } = this.props
    const classNames = ['trade__select-player']
    if (isSelected) classNames.push('selected')
    return (
      <div className={classNames.join(' ')}>
        <div className='player__name-position'>
          <Position pos={player.pos} />
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
