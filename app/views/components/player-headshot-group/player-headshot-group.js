import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import AvatarGroup from '@mui/material/AvatarGroup'
import Tooltip from '@mui/material/Tooltip'
import Avatar from '@mui/material/Avatar'

import { get_player_image_url } from '@core/utils'

export default class PlayerHeadshotGroup extends React.Component {
  render() {
    const { players, width = 48 } = this.props
    const height = Math.round((width * 70) / 96)
    const items = []
    players.forEach((player_map, index) => {
      const src = get_player_image_url({ player_map, width, height })

      items.push(
        <Tooltip key={index} title={player_map.get('name')}>
          <Avatar src={src} className='player__headshot'>
            {player_map.get('fname', '').charAt(0)}
            {player_map.get('lname', '').charAt(0)}
          </Avatar>
        </Tooltip>
      )
    })
    return <AvatarGroup max={4}>{items}</AvatarGroup>
  }
}

PlayerHeadshotGroup.propTypes = {
  players: ImmutablePropTypes.list,
  width: PropTypes.number
}
