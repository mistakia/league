import React from 'react'

import Source from '@components/source'
import EditableProjection from '@components/editable-projection'
import Position from '@components/position'
import Icon from '@components/icon'
import { weightProjections } from '@common'
import PlayerExpandedRow from '@components/player-expanded-row'

import './player-row.styl'

export default class PlayerRow extends React.Component {
  handleClick = () => {
    this.props.select(this.props.player.player)
  }

  handleDeselectClick = () => {
    this.props.deselect()
  }

  handleClearClick = () => {
    this.props.delete(this.props.player.player)
  }

  render = () => {
    const { player, style, selected, stats, vbaseline } = this.props

    const isSelected = selected === player.player

    const passing = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='py' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='tdp' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='ints' />
          </div>
        </div>
      </div>
    )

    const rushing = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='ra' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='ry' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='tdr' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='fuml' />
          </div>
        </div>
      </div>
    )

    const receiving = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='trg' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='rec' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='recy' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='tdrec' />
          </div>
        </div>
      </div>
    )

    const projections = []
    const years = []
    if (isSelected) {
      player.projections.forEach((p, index) => {
        const isUser = !!p.userid
        const title = (isUser ? 'User' : <Source sourceId={p.sourceid} />)
        const action = (
          <div className='row__action'>
            {isUser && <div onClick={this.handleClearClick}><Icon name='clear' /></div>}
          </div>
        )

        const item = (
          <PlayerExpandedRow
            key={index}
            stats={p}
            title={title}
            action={action}
          />
        )
        projections.push(item)
      })

      const projAvg = weightProjections({
        projections: player.projections.filter(p => !p.userid),
        userId: 0
      })

      projections.push(
        <PlayerExpandedRow
          className='average__row'
          key='average'
          stats={projAvg}
          title='Average'
          action={(<div className='row__action' />)}
        />
      )

      for (const year in stats.overall) {
        const p = stats.overall[year]
        const item = (
          <PlayerExpandedRow key={year} title={year} stats={p} />
        )
        years.push(item)
      }

      // TODO year average
    }

    const expanded = (
      <div className='player__row-expanded'>
        <div className='expanded__action' onClick={this.handleDeselectClick}>
          <Icon name='clear' />
        </div>
        <div className='expanded__section'>
          <div className='expanded__section-header'>
            <div className='row__group-head'>
              Season Projections
            </div>
          </div>
          <div className='expanded__section-header'>
            <div className='row__name'>Source</div>
            <div className='row__group'>
              <div className='row__group-head'>Passing</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
                <div className='player__row-metric'>INT</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-head'>Rushing</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>CAR</div>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
                <div className='player__row-metric'>FUM</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-head'>Receiving</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>TAR</div>
                <div className='player__row-metric'>REC</div>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
              </div>
            </div>
            <div className='row__action' />
          </div>
          {projections}
        </div>
        <div className='expanded__section'>
          <div className='expanded__section-header'>
            <div className='row__group-head'>
              Season Stats
            </div>
          </div>
          <div className='expanded__section-header'>
            <div className='row__name'>Year</div>
            <div className='row__group'>
              <div className='row__group-head'>Passing</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
                <div className='player__row-metric'>INT</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-head'>Rushing</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>CAR</div>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
                <div className='player__row-metric'>FUM</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-head'>Receiving</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>TAR</div>
                <div className='player__row-metric'>REC</div>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
              </div>
            </div>
          </div>
          {years}
        </div>
      </div>
    )

    const classNames = ['player__row']
    if (isSelected) classNames.push('selected')

    return (
      <div style={style}>
        <div className={classNames.join(' ')}>
          <div className='player__row-main' onClick={this.handleClick}>
            <div className='player__row-pos'>
              <Position pos={player.pos1} />
            </div>
            <div className='player__row-name'>{player.name}</div>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='player__row-metric'>
                  ${Math.round(player.values[vbaseline])}
                </div>
                <div className='player__row-metric'>
                  {Math.round(player.vorp[vbaseline] || 0)}
                </div>
                <div className='player__row-metric'>
                  {(player.points.total || 0).toFixed(1)}
                </div>
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
