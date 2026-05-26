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

    return (
      <div className='team__image'>
        {url ? (
          <img
            className='team__image-img'
            src={url}
            alt={team.name || ''}
            loading='lazy'
            decoding='async'
            onError={this.handleError}
          />
        ) : null}
      </div>
    )
  }
}

TeamImage.propTypes = {
  team: ImmutablePropTypes.record
}
