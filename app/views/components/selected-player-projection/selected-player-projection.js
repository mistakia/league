import React from 'react'
import PropTypes from 'prop-types'

import Source from '@components/source'
import SelectedPlayerProjectionRow from '@components/selected-player-projection-row'
import SelectedPlayerProjectionRowHeader from '@components/selected-player-projection-row-header'
import { current_season } from '#constants'

export default function SelectedPlayerProjection({
  week,
  projections,
  projection,
  pos
}) {
  const rows = projections.map((p, index) => (
    <SelectedPlayerProjectionRow
      key={index}
      stats={p}
      title={<Source sourceId={p.source_id} />}
      pos={pos}
      fixed={1}
    />
  ))

  if (projection) {
    rows.push(
      <SelectedPlayerProjectionRow
        className='average__row'
        key='average'
        stats={projection}
        title='Average'
        pos={pos}
        fixed={1}
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
      </div>
      {rows}
    </div>
  )
}

SelectedPlayerProjection.propTypes = {
  pos: PropTypes.string,
  week: PropTypes.number,
  projections: PropTypes.array,
  projection: PropTypes.object
}
