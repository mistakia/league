import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import TeamImage from '@components/team-image'

import './team-name.styl'

export default class TeamName extends React.Component {
  render = () => {
    const { team, abbrv, color, image } = this.props

    const style = { color: `#${team.pc || '00000'}` }
    const name = (
      <div className='team__name' style={style}>
        {abbrv ? team.abbrv : team.name}
      </div>
    )

    const colorEl = (
      <div
        className='team__color'
        style={{ backgroundColor: `#${team.pc || '666666'}` }}
      />
    )

    const imageEl = <TeamImage tid={team.uid} />

    return (
      <>
        {Boolean(color) && colorEl}
        {Boolean(image) && imageEl}
        {name}
      </>
    )
  }
}

TeamName.propTypes = {
  team: ImmutablePropTypes.record,
  abbrv: PropTypes.bool,
  color: PropTypes.bool,
  image: PropTypes.bool
}
