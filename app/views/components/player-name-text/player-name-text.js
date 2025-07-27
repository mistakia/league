import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import PlayerLabel from '@components/player-label'

export default class PlayerNameText extends React.Component {
  render = () => {
    const { player_map } = this.props

    return (
      <div className='player__name'>
        <div className='player__name-main'>
          <span>{player_map.get('pname')}</span>
          {constants.year === player_map.get('nfl_draft_year') && (
            <PlayerLabel label='R' type='rookie' description='Rookie' />
          )}
        </div>
      </div>
    )
  }
}

PlayerNameText.propTypes = {
  player_map: ImmutablePropTypes.map
}
