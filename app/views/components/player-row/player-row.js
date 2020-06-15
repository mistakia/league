import React from 'react'
import EditableProjection from '@components/editable-projection'
import Position from '@components/position'

import './player-row.styl'

export default class PlayerRow extends React.Component {
  onclick = () => {
    this.props.select(this.props.player.player)
  }

  render = () => {
    const { player, style, selected } = this.props

    const isSelected = selected === player.player

    const passing = (
      <div className='player__row-group'>
        <div className='player__row-group-body'>
          <div className='player__row-metric'><EditableProjection player={player} type='py' /></div>
          <div className='player__row-metric'><EditableProjection player={player} type='tdp' /></div>
          <div className='player__row-metric'><EditableProjection player={player} type='ints' /></div>
        </div>
      </div>
    )

    const rushing = (
      <div className='player__row-group'>
        <div className='player__row-group-body'>
          <div className='player__row-metric'><EditableProjection player={player} type='ra' /></div>
          <div className='player__row-metric'><EditableProjection player={player} type='ry' /></div>
          <div className='player__row-metric'><EditableProjection player={player} type='tdr' /></div>
          <div className='player__row-metric'><EditableProjection player={player} type='fuml' /></div>
        </div>
      </div>
    )

    const receiving = (
      <div className='player__row-group'>
        <div className='player__row-group-body'>
          <div className='player__row-metric'><EditableProjection player={player} type='trg' /></div>
          <div className='player__row-metric'><EditableProjection player={player} type='rec' /></div>
          <div className='player__row-metric'><EditableProjection player={player} type='recy' /></div>
          <div className='player__row-metric'><EditableProjection player={player} type='tdrec' /></div>
        </div>
      </div>
    )

    const expanded = (
      <div className='player__row-expanded'>
      </div>
    )

    return (
      <div style={style}>
        <div className='player__row'>
          <div className='player__row-main' onClick={this.onclick}>
            <div className='player__row-pos'><Position pos={player.pos1} /></div>
            <div className='player__row-name'>{player.name}</div>
            <div className='player__row-group'>
              <div className='player__row-group-body'>
                <div className='player__row-metric'>${player.values.available}</div>
                <div className='player__row-metric'>{Math.round(player.vorp.available || 0)}</div>
                <div className='player__row-metric'>{(player.points.total || 0).toFixed(1)}</div>
              </div>
            </div>
            {passing}
            {rushing}
            {receiving}
          </div>
          {isSelected && expanded}
        </div>
      </div>
    )
  }
}
