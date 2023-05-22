import React from 'react'
import PropTypes from 'prop-types'

import Icon from '@components/icon'
import Source from '@components/source'
import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'
import { constants } from '@common'

export default class SelectedPlayerProjection extends React.Component {
  handleClearClick = () => {
    const { pid, week } = this.props
    this.props.delete({ pid, week })
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
          fixed={1}
        />
      )
      rows.push(item)
    })

    if (projection) {
      rows.push(
        <PlayerSelectedRow
          className='average__row'
          key='average'
          stats={projection}
          title='Average'
          pos={pos}
          fixed={1}
          action={<div className='row__action' />}
        />
      )
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header sticky__column'>
          <div className='row__group-head'>
            {week === 0 ? `${constants.year} Regular Season Projections` : `Week ${week} Projections`}
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='table__cell text'>Source</div>
          <PlayerSelectedRowHeader pos={pos} />
          <div className='row__action' />
        </div>
        {rows}
      </div>
    )
  }
}

SelectedPlayerProjection.propTypes = {
  pid: PropTypes.string,
  delete: PropTypes.func,
  pos: PropTypes.string,
  week: PropTypes.number,
  projections: PropTypes.array,
  projection: PropTypes.object
}
