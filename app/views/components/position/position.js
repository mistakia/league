import React from 'react'
import PropTypes from 'prop-types'

import './position.styl'

const Position = ({ pos }) => {
  return <span className={'position ' + pos}>{pos}</span>
}

Position.propTypes = {
  pos: PropTypes.string
}

export default Position
