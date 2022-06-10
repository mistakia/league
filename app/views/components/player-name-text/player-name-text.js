import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@common'
import PlayerLabel from '@components/player-label'

export default class PlayerNameText extends React.Component {
  render = () => {
    const { playerMap } = this.props

    return (
      <div className='player__name'>
        <div className='player__name-main'>
          <span>{playerMap.get('pname')}</span>
          {constants.season.year === playerMap.get('draft_year') && (
            <PlayerLabel label='R' type='rookie' description='Rookie' />
          )}
        </div>
      </div>
    )
  }
}

PlayerNameText.propTypes = {
  playerMap: ImmutablePropTypes.map
}
