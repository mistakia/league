import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import './team-name.styl'

export default class TeamName extends React.Component {
  render = () => {
    const { team, abbrv } = this.props

    const style = { background: `#${team.pc}`, color: `#${team.ac}` }
    return (
      <div className='team__name' style={style}>
        {abbrv ? team.abbrv : team.name}
      </div>
    )
  }
}

TeamName.propTypes = {
  team: ImmutablePropTypes.record,
  abbrv: PropTypes.bool
}
