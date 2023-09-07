import React from 'react'
import PropTypes from 'prop-types'

export default function Source({ source }) {
  return <span className='source'>{source?.name}</span>
}

Source.propTypes = {
  source: PropTypes.object
}
