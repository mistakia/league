import React from 'react'
import PropTypes from 'prop-types'

import Icon from '@components/icon'
import { weightProjections } from '@common'
import Source from '@components/source'
import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'

export default class SelectedPlayerProjection extends React.Component {
  handleClearClick = () => {
    const { playerId, week } = this.props
    this.props.delete({ playerId, week })
  }

  render = () => {
    const { week, projections, projection, pos } = this.props

    const rows = []
    projections.forEach((p, index) => {
      const isUser = !p.sourceid
      const title = isUser ? 'User' : <Source sourceId={p.sourceid} />
      const action = (
        <div className='row__action'>
          {isUser && (
            <div onClick={this.handleClearClick}>
              <Icon name='clear' />
            </div>
          )}
        </div>
      )

      const item = (
        <PlayerSelectedRow
          key={index}
          stats={p}
          title={title}
          action={action}
          pos={pos}
        />
      )
      rows.push(item)
    })

    const projAvg = weightProjections({
      projections: projections.filter((p) => p.sourceid),
      week,
      userId: 0
    })

    rows.push(
      <PlayerSelectedRow
        className='average__row'
        key='average'
        stats={projAvg}
        title='Average'
        pos={pos}
        action={<div className='row__action' />}
      />
    )

    rows.push(
      <PlayerSelectedRow
        className='average__row'
        key='weighted'
        stats={projection}
        title='Weighted'
        pos={pos}
        action={<div className='row__action' />}
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
          <PlayerSelectedRowHeader pos={pos} />
          <div className='row__action' />
        </div>
        {rows}
      </div>
    )
  }
}

SelectedPlayerProjection.propTypes = {
  playerId: PropTypes.string,
  delete: PropTypes.func,
  pos: PropTypes.string,
  week: PropTypes.number,
  projections: PropTypes.array,
  projection: PropTypes.object
}
