import React from 'react'
import PropTypes from 'prop-types'

export default class NFLTeamBye extends React.Component {
  render = () => {
    const { bye } = this.props
    return <span className='bye'>{bye || '-'}</span>
  }
}

NFLTeamBye.propTypes = {
  bye: PropTypes.number
}
