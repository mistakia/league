import React from 'react'

import './position.styl'

const Position = ({ pos }) => {
  return (
    <div className={'position ' + pos}>{pos}</div>
  )
}

export default Position
