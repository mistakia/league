import React from 'react'

import Icon from '@components/icon'
import { weightProjections } from '@common'
import Source from '@components/source'
import PlayerSelectedRow from '@components/player-selected-row'

export default class SelectedPlayerProjection extends React.Component {
  handleClearClick = () => {
    const { playerId, week } = this.props
    this.props.delete({ playerId, week })
  }

  render = () => {
    const { week, projections, projection } = this.props

    const rows = []
    projections.forEach((p, index) => {
      const isUser = !p.sourceid
      const title = (isUser ? 'User' : <Source sourceId={p.sourceid} />)
      const action = (
        <div className='row__action'>
          {isUser && <div onClick={this.handleClearClick}><Icon name='clear' /></div>}
        </div>
      )

      const item = (
        <PlayerSelectedRow
          key={index}
          stats={p}
          title={title}
          action={action}
        />
      )
      rows.push(item)
    })

    const projAvg = weightProjections({
      projections: projections.filter(p => p.sourceid),
      week,
      userId: 0
    })

    rows.push(
      <PlayerSelectedRow
        className='average__row'
        key='average'
        stats={projAvg}
        title='Average'
        action={(<div className='row__action' />)}
      />
    )

    rows.push(
      <PlayerSelectedRow
        className='average__row'
        key='weighted'
        stats={projection}
        title='Weighted'
        action={(<div className='row__action' />)}
      />
    )

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>
            {week === 0 ? 'Season Projections' : `Week ${week} Projections`}
          </div>
        </div>
        <div className='selected__section-header'>
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
        {rows}
      </div>
    )
  }
}
