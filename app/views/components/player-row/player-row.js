import React from 'react'

import Source from '@components/source'
import EditableProjection from '@components/editable-projection'
import Position from '@components/position'

import './player-row.styl'

export default class PlayerRow extends React.Component {
  onclick = () => {
    this.props.select(this.props.player.player)
  }

  render = () => {
    const { player, style, selected, stats } = this.props

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
        const item = (
          <div key={index} className='expanded__row'>
            <div className='row__name'>
              {p.sourceid ? <Source sourceId={p.sourceid} /> : 'User'}
            </div>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='player__row-metric'>{p.py}</div>
                <div className='player__row-metric'>{p.tdp}</div>
                <div className='player__row-metric'>{p.ints}</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='player__row-metric'>{p.ra}</div>
                <div className='player__row-metric'>{p.ry}</div>
                <div className='player__row-metric'>{p.tdr}</div>
                <div className='player__row-metric'>{p.fuml}</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='player__row-metric'>{p.trg}</div>
                <div className='player__row-metric'>{p.rec}</div>
                <div className='player__row-metric'>{p.recy}</div>
                <div className='player__row-metric'>{p.tdrec}</div>
              </div>
            </div>
          </div>
        )
        projections.push(item)
      })

      for (const year in stats.overall) {
        const p = stats.overall[year]
        console.log(p)
        const item = (
          <div key={year} className='expanded__row'>
            <div className='row__name'>
              {year}
            </div>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='player__row-metric'>{p.py}</div>
                <div className='player__row-metric'>{p.tdp}</div>
                <div className='player__row-metric'>{p.ints}</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='player__row-metric'>{p.ra}</div>
                <div className='player__row-metric'>{p.ry}</div>
                <div className='player__row-metric'>{p.tdr}</div>
                <div className='player__row-metric'>{p.fuml}</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='player__row-metric'>{p.trg}</div>
                <div className='player__row-metric'>{p.rec}</div>
                <div className='player__row-metric'>{p.recy}</div>
                <div className='player__row-metric'>{p.tdrec}</div>
              </div>
            </div>
          </div>
        )
        years.push(item)
      }
    }

    const expanded = (
      <div className='player__row-expanded'>
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
          <div className='player__row-main' onClick={this.onclick}>
            <div className='player__row-pos'>
              <Position pos={player.pos1} />
            </div>
            <div className='player__row-name'>{player.name}</div>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='player__row-metric'>
                  ${player.values.available}
                </div>
                <div className='player__row-metric'>
                  {Math.round(player.vorp.available || 0)}
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
