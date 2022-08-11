import React from 'react'
import PropTypes from 'prop-types'

import './nfl-team.styl'

export default function NFLTeam({ team }) {
  return <span className='nfl__team'>{team}</span>
}

NFLTeam.propTypes = {
  team: PropTypes.string
}
