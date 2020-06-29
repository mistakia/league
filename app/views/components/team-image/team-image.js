import React from 'react'

import './team-image.styl'

export default class TeamImage extends React.Component {
  handleError = (event) => {
    event.target.style.opacity = '0'
  }

  render = () => {
    const { url, background } = this.props

    const style = (background && url) && {
      backgroundImage: `url("${url}")`
    }

    return (
      <div className='team__image'>
        <div className='team_image-img' style={style}>
          {(url && !background) && <img src={url} onError={this.handleError} />}
        </div>
      </div>
    )
  }
}
