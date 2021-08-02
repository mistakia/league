import React from 'react'
import PropTypes from 'prop-types'

import './position.styl'

const Position = ({ pos }) => {
  return <div className={'position ' + pos}>{pos}</div>
}

Position.propTypes = {
  pos: PropTypes.string
}

export default Position
