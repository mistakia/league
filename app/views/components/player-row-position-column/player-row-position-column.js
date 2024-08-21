import React from 'react'
import PropTypes from 'prop-types'

import Position from '@components/position'

export default function PlayerRowPositionColumn({ row }) {
  const pos = row.original.pos
  return <Position pos={pos} />
}

PlayerRowPositionColumn.propTypes = {
  row: PropTypes.object.isRequired
}
