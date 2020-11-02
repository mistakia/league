import React from 'react'

import { constants } from '@common'

export default class PlayerNameText extends React.Component {
  render = () => {
    const { player } = this.props

    return (
      <div className='player__name'>
        <div className='player__name-main'>
          <span>{player.pname}</span>
          {(constants.season.year === player.draft_year) &&
            <sup className='player__label-rookie'>
              R
            </sup>}
        </div>
      </div>
    )
  }
}
