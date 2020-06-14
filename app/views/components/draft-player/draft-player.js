import React from 'react'

import Position from '@components/position'

import './draft-player.styl'

export default class DraftPlayer extends React.Component {
  constructor (props) {
    super(props)

    this.onclick = this.onclick.bind(this)
  }

  onclick () {
    this.props.select(this.props.player.player)
  }

  render () {
    const { player, selected, isDrafted } = this.props

    const classNames = ['player-draft__item']
    if (selected === player.player) {
      classNames.push('selected')
    }

    if (isDrafted) {
      classNames.push('drafted')
    }

    return (
      <div className={classNames.join(' ')} onClick={this.onclick}>
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
