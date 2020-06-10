import React from 'react'

import Position from '@components/position'

import './draft-player.styl'

export default class DraftPlayer extends React.Component {
  render () {
    const { player } = this.props

    return (
      <div className='player-draft__item'>
        <div className='player-draft__item-metric'>
          ${Math.round(player.values.get('available'))}
        </div>
        <div className='player-draft__item-name'>
          {player.pname} <small>({player.team})</small>
        </div>
      </div>
    )
  }
}
