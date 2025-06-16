import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import PlayerLabel from '@components/player-label'

export default class PlayerNameText extends React.Component {
  render = () => {
    const { playerMap } = this.props

    return (
      <div className='player__name'>
        <div className='player__name-main'>
          <span>{playerMap.get('pname')}</span>
          {constants.year === playerMap.get('nfl_draft_year') && (
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
