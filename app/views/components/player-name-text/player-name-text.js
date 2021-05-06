import React from 'react'

import { constants } from '@common'
import PlayerLabel from '@components/player-label'

export default class PlayerNameText extends React.Component {
  render = () => {
    const { player } = this.props

    return (
      <div className='player__name'>
        <div className='player__name-main'>
          <span>{player.pname}</span>
          {constants.season.year === player.draft_year && (
            <PlayerLabel label='R' type='rookie' description='Rookie' />
          )}
        </div>
      </div>
    )
  }
}
