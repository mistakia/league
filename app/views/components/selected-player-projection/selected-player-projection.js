import React from 'react'
import PropTypes from 'prop-types'

import Icon from '@components/icon'
import Source from '@components/source'
import SelectedPlayerProjectionRow from '@components/selected-player-projection-row'
import SelectedPlayerProjectionRowHeader from '@components/selected-player-projection-row-header'
import { current_season } from '@constants'

export default function SelectedPlayerProjection({
  pid,
  week,
  projections,
  projection,
  pos,
  delete_projection
}) {
  const handle_clear_click = () => {
    delete_projection({ pid, week })
  }

  const rows = []
  let has_action = false
  projections.forEach((p, index) => {
    const isUser = !p.sourceid
    const title = isUser ? 'User' : <Source sourceId={p.sourceid} />
    const action = isUser && (
      <div className='row__action'>
        <div onClick={handle_clear_click}>
          <Icon name='clear' />
        </div>
      </div>
    )
    has_action = Boolean(has_action || action)

    const item = (
      <SelectedPlayerProjectionRow
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
      <SelectedPlayerProjectionRow
        className='average__row'
        key='average'
        stats={projection}
        title='Average'
        pos={pos}
        fixed={1}
        action={has_action ? <div className='row__action' /> : null}
      />
    )
  }

  return (
    <div className='selected__section'>
      <div className='selected__table-header sticky__column'>
        <div className='row__group-head'>
          {week === 0
            ? `${current_season.year} Regular Season Projections`
            : `Week ${week} Projections`}
        </div>
      </div>
      <div className='selected__table-header'>
        <div className='table__cell text'>Source</div>
        <SelectedPlayerProjectionRowHeader pos={pos} />
        {has_action ? <div className='row__action' /> : null}
      </div>
      {rows}
    </div>
  )
}

SelectedPlayerProjection.propTypes = {
  pid: PropTypes.string,
  delete_projection: PropTypes.func,
  pos: PropTypes.string,
  week: PropTypes.number,
  projections: PropTypes.array,
  projection: PropTypes.object
}
