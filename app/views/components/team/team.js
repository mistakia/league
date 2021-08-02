import React from 'react'
import PropTypes from 'prop-types'

import './team.styl'

export default function Team({ team }) {
  return <span className='team'>{team}</span>
}

Team.propTypes = {
  team: PropTypes.string
}
