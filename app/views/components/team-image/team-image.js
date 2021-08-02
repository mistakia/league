import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import './team-image.styl'

export default class TeamImage extends React.Component {
  handleError = (event) => {
    event.target.style.opacity = '0'
  }

  render = () => {
    const { team } = this.props
    const url = team.image

    const style = url
      ? {
          backgroundImage: `url("${url}")`
        }
      : {}

    return (
      <div className='team__image'>
        <div className='team__image-img' style={style} />
      </div>
    )
  }
}

TeamImage.propTypes = {
  team: ImmutablePropTypes.record
}
